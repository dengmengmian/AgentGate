//! 路由场景模板：任务分流（主对话 / 思考 / 后台）和本地+云（后台走本地）。
//!
//! 用户确认后写入当前（或全部默认）route profile：切到 failover，按优先级挂
//! think → background → main。同一 provider 不能出现两次（表约束），思考槽与
//! 主对话相同则跳过思考槽并给出 warning，不假成功。
//!
//! 回滚只恢复「第一次套用模板前」的成员；再次套用不会覆盖这份快照。

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};

use crate::errors::{codes, AppError};
use crate::models::route_profile::{AddProviderToRouteInput, RouteProfileView};
use crate::storage::{providers, route_profiles};

pub const TEMPLATE_TASK_SPLIT: &str = "task_split";
pub const TEMPLATE_LOCAL_CLOUD: &str = "local_cloud";

const ROLE_THINK: &str = "think";
const ROLE_BACKGROUND: &str = "background";
const ROLE_MAIN: &str = "main";

/// Claude Code 后台/子任务常用 haiku；Gemini 用 flash；Codex mini 档是 luna。
/// 不用 mini：会误伤 MiniMax。
pub fn background_conditions_json() -> String {
    serde_json::json!({ "model_name_match": ["haiku", "flash", "nano", "luna"] }).to_string()
}

/// Claude 思考槽常用 opus；DeepSeek 推理是 reasoner。
pub fn think_conditions_json() -> String {
    serde_json::json!({ "model_name_match": ["opus", "reasoner"] }).to_string()
}

pub fn is_local_base_url(base_url: &str) -> bool {
    let lower = base_url.to_ascii_lowercase();
    lower.contains("127.0.0.1")
        || lower.contains("localhost")
        || lower.contains("[::1]")
        || lower.contains("://::1")
}

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct RouteTemplateInput {
    pub template_id: String,
    pub profile_id: String,
    pub main_provider_id: Option<String>,
    pub think_provider_id: Option<String>,
    pub background_provider_id: Option<String>,
    #[serde(default)]
    pub apply_to_all_defaults: bool,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct RouteTemplateRole {
    pub role: String,
    pub provider_id: String,
    pub provider_name: String,
    pub is_local: bool,
    pub routing_conditions: Option<String>,
    pub priority: i64,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct RouteTemplatePreview {
    pub template_id: String,
    pub profile_ids: Vec<String>,
    pub profile_names: Vec<String>,
    pub roles: Vec<RouteTemplateRole>,
    pub warnings: Vec<String>,
    pub can_apply: bool,
    pub can_rollback: bool,
    pub switches_to_failover: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct MemberSnapshot {
    provider_id: String,
    priority: i64,
    enabled: bool,
    model_override: Option<String>,
    cooldown_seconds: i64,
    failover_on_status_codes: Option<String>,
    failover_on_error_keywords: Option<String>,
    routing_conditions: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ProfileSnapshot {
    mode: String,
    selection_strategy: String,
    active_provider_id: Option<String>,
    members: Vec<MemberSnapshot>,
}

pub fn preview(
    conn: &Connection,
    input: &RouteTemplateInput,
) -> Result<RouteTemplatePreview, AppError> {
    resolve(conn, input)
}

pub fn apply(
    conn: &Connection,
    input: &RouteTemplateInput,
) -> Result<RouteTemplatePreview, AppError> {
    let preview = resolve(conn, input)?;
    if !preview.can_apply {
        let reason = preview
            .warnings
            .iter()
            .find(|w| {
                matches!(
                    w.as_str(),
                    "need_two_providers"
                        | "need_local_provider"
                        | "background_must_be_local"
                        | "main_must_not_be_local"
                        | "roles_not_distinct"
                        | "provider_not_found"
                )
            })
            .cloned()
            .unwrap_or_else(|| "invalid".into());
        return Err(AppError::new(
            codes::ROUTE_TEMPLATE_INVALID,
            template_error_message(&reason),
        )
        .with_suggestion("Pick distinct providers that match the template, then confirm."));
    }

    let tx = conn.unchecked_transaction()?;
    for profile_id in &preview.profile_ids {
        if !snapshot_exists(&tx, profile_id)? {
            save_snapshot(&tx, profile_id, &preview.template_id)?;
        }
        replace_members(&tx, profile_id, &preview.roles)?;
        route_profiles::update(
            &tx,
            profile_id,
            crate::models::route_profile::UpdateRouteProfileInput {
                name: None,
                mode: Some("failover".into()),
                selection_strategy: None,
                enabled: None,
            },
        )?;
        if let Some(main) = preview.roles.iter().find(|r| r.role == ROLE_MAIN) {
            let _ = route_profiles::set_active_provider(&tx, profile_id, &main.provider_id);
        }
    }
    tx.commit()?;
    let mut out = preview;
    out.can_rollback = true;
    Ok(out)
}

pub fn rollback(conn: &Connection, profile_id: &str) -> Result<(), AppError> {
    let snap = load_snapshot(conn, profile_id)?.ok_or_else(|| {
        AppError::new(
            codes::ROUTE_TEMPLATE_NOTHING_TO_ROLLBACK,
            "No route template snapshot to restore",
        )
        .with_suggestion("Apply a template first, then rollback.")
    })?;
    let parsed: ProfileSnapshot = serde_json::from_str(&snap.snapshot_json)
        .map_err(|e| AppError::internal(format!("corrupt route template snapshot: {e}")))?;

    let tx = conn.unchecked_transaction()?;
    restore_snapshot(&tx, profile_id, &parsed)?;
    tx.execute(
        "DELETE FROM route_template_snapshots WHERE route_profile_id = ?1",
        [profile_id],
    )?;
    tx.commit()?;
    Ok(())
}

pub fn has_rollback(conn: &Connection, profile_id: &str) -> Result<bool, AppError> {
    snapshot_exists(conn, profile_id)
}

fn resolve(
    conn: &Connection,
    input: &RouteTemplateInput,
) -> Result<RouteTemplatePreview, AppError> {
    if input.template_id != TEMPLATE_TASK_SPLIT && input.template_id != TEMPLATE_LOCAL_CLOUD {
        return Err(AppError::new(
            codes::ROUTE_TEMPLATE_INVALID,
            format!("Unknown route template '{}'", input.template_id),
        )
        .with_suggestion("Use task_split or local_cloud."));
    }

    let current = route_profiles::get_by_id(conn, &input.profile_id)?;
    let targets = if input.apply_to_all_defaults {
        route_profiles::list_all(conn)?
            .into_iter()
            .filter(|p| p.is_default)
            .collect::<Vec<_>>()
    } else {
        vec![RouteProfileView {
            id: current.id.clone(),
            name: current.name.clone(),
            input_protocol: current.input_protocol.clone(),
            mode: current.mode.clone(),
            selection_strategy: current.selection_strategy.clone(),
            active_provider_id: current.active_provider_id.clone(),
            active_provider_name: None,
            enabled: current.enabled,
            is_default: current.is_default,
            providers_count: 0,
            created_at: current.created_at.clone(),
            updated_at: current.updated_at.clone(),
        }]
    };

    let all_providers = providers::list_all(conn)?;
    let enabled: Vec<_> = all_providers.into_iter().filter(|p| p.enabled).collect();

    let mut warnings = Vec::new();
    let mut can_apply = true;

    let suggested = suggest_roles(&enabled, &input.template_id);
    let main_id = nonempty(input.main_provider_id.as_deref()).or(suggested.main);
    let background_id = nonempty(input.background_provider_id.as_deref()).or(suggested.background);
    let think_id = nonempty(input.think_provider_id.as_deref()).or(suggested.think);

    let Some(main_id) = main_id else {
        warnings.push("need_two_providers".into());
        return Ok(unusable_preview(input, &targets, warnings));
    };
    let Some(background_id) = background_id else {
        if input.template_id == TEMPLATE_LOCAL_CLOUD {
            warnings.push("need_local_provider".into());
        } else {
            warnings.push("need_two_providers".into());
        }
        return Ok(unusable_preview(input, &targets, warnings));
    };

    if main_id == background_id {
        warnings.push("roles_not_distinct".into());
        can_apply = false;
    }

    let find = |id: &str| enabled.iter().find(|p| p.id == id);
    let Some(main) = find(&main_id) else {
        warnings.push("provider_not_found".into());
        return Ok(unusable_preview(input, &targets, warnings));
    };
    let Some(background) = find(&background_id) else {
        warnings.push("provider_not_found".into());
        return Ok(unusable_preview(input, &targets, warnings));
    };

    let main_local = is_local_base_url(&main.base_url);
    let background_local = is_local_base_url(&background.base_url);

    if input.template_id == TEMPLATE_LOCAL_CLOUD {
        if !background_local {
            warnings.push("background_must_be_local".into());
            can_apply = false;
        }
        if main_local {
            warnings.push("main_must_not_be_local".into());
            can_apply = false;
        }
    }

    let mut roles = Vec::new();
    let mut next_priority = 1i64;

    let think = think_id.as_ref().and_then(|id| find(id));
    match think {
        Some(tp) if tp.id == main.id || tp.id == background.id => {
            warnings.push(if tp.id == main.id {
                "think_skipped_same_as_main".into()
            } else {
                "think_skipped_same_as_background".into()
            });
        }
        Some(tp) => {
            roles.push(RouteTemplateRole {
                role: ROLE_THINK.into(),
                provider_id: tp.id.clone(),
                provider_name: tp.name.clone(),
                is_local: is_local_base_url(&tp.base_url),
                routing_conditions: Some(think_conditions_json()),
                priority: next_priority,
            });
            next_priority += 1;
        }
        None => {}
    }

    roles.push(RouteTemplateRole {
        role: ROLE_BACKGROUND.into(),
        provider_id: background.id.clone(),
        provider_name: background.name.clone(),
        is_local: background_local,
        routing_conditions: Some(background_conditions_json()),
        priority: next_priority,
    });
    next_priority += 1;

    roles.push(RouteTemplateRole {
        role: ROLE_MAIN.into(),
        provider_id: main.id.clone(),
        provider_name: main.name.clone(),
        is_local: main_local,
        routing_conditions: None,
        priority: next_priority,
    });

    if targets.iter().any(|p| p.mode != "failover") {
        warnings.push("will_enable_failover".into());
    }

    Ok(RouteTemplatePreview {
        template_id: input.template_id.clone(),
        profile_ids: targets.iter().map(|p| p.id.clone()).collect(),
        profile_names: targets.iter().map(|p| p.name.clone()).collect(),
        roles,
        warnings,
        can_apply,
        can_rollback: snapshot_exists(conn, &input.profile_id)?,
        switches_to_failover: true,
    })
}

struct Suggested {
    main: Option<String>,
    think: Option<String>,
    background: Option<String>,
}

fn suggest_roles(enabled: &[crate::models::provider::Provider], template_id: &str) -> Suggested {
    let locals: Vec<_> = enabled
        .iter()
        .filter(|p| is_local_base_url(&p.base_url))
        .collect();
    let clouds: Vec<_> = enabled
        .iter()
        .filter(|p| !is_local_base_url(&p.base_url))
        .collect();

    if template_id == TEMPLATE_LOCAL_CLOUD {
        let main = clouds
            .iter()
            .find(|p| p.is_active)
            .or_else(|| clouds.first())
            .map(|p| p.id.clone());
        let background = locals.first().map(|p| p.id.clone());
        return Suggested {
            main,
            think: None,
            background,
        };
    }

    // task_split: 主对话走当前云端；后台走另一个（本地优先，否则第二家云端）。
    let main = clouds
        .iter()
        .copied()
        .find(|p| p.is_active)
        .or_else(|| clouds.first().copied())
        .or_else(|| enabled.first())
        .map(|p| p.id.clone());
    let background = locals
        .first()
        .map(|p| p.id.clone())
        .or_else(|| {
            clouds
                .iter()
                .find(|p| Some(p.id.as_str()) != main.as_deref())
                .map(|p| p.id.clone())
        })
        .or_else(|| {
            enabled
                .iter()
                .find(|p| Some(p.id.as_str()) != main.as_deref())
                .map(|p| p.id.clone())
        });
    let think = clouds
        .iter()
        .find(|p| {
            Some(p.id.as_str()) != main.as_deref() && Some(p.id.as_str()) != background.as_deref()
        })
        .map(|p| p.id.clone());
    Suggested {
        main,
        think,
        background,
    }
}

fn nonempty(s: Option<&str>) -> Option<String> {
    s.map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
}

fn unusable_preview(
    input: &RouteTemplateInput,
    targets: &[RouteProfileView],
    warnings: Vec<String>,
) -> RouteTemplatePreview {
    RouteTemplatePreview {
        template_id: input.template_id.clone(),
        profile_ids: targets.iter().map(|p| p.id.clone()).collect(),
        profile_names: targets.iter().map(|p| p.name.clone()).collect(),
        roles: vec![],
        warnings,
        can_apply: false,
        can_rollback: false,
        switches_to_failover: true,
    }
}

fn template_error_message(code: &str) -> String {
    match code {
        "need_two_providers" => "Task split needs two different providers".into(),
        "need_local_provider" => "Local+cloud needs a local provider (Ollama / LM Studio)".into(),
        "background_must_be_local" => "Background provider must be a local endpoint".into(),
        "main_must_not_be_local" => {
            "Main conversation should use a remote API provider, not a local endpoint".into()
        }
        "roles_not_distinct" => "Main and background must be different providers".into(),
        "provider_not_found" => "One of the selected providers is missing or disabled".into(),
        _ => "Route template cannot be applied".into(),
    }
}

fn snapshot_exists(conn: &Connection, profile_id: &str) -> Result<bool, AppError> {
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM route_template_snapshots WHERE route_profile_id = ?1",
        [profile_id],
        |r| r.get(0),
    )?;
    Ok(n > 0)
}

struct StoredSnapshot {
    snapshot_json: String,
}

fn load_snapshot(conn: &Connection, profile_id: &str) -> Result<Option<StoredSnapshot>, AppError> {
    let result = conn.query_row(
        "SELECT snapshot_json FROM route_template_snapshots WHERE route_profile_id = ?1",
        [profile_id],
        |r| {
            Ok(StoredSnapshot {
                snapshot_json: r.get(0)?,
            })
        },
    );
    match result {
        Ok(s) => Ok(Some(s)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(AppError::database(e)),
    }
}

fn save_snapshot(conn: &Connection, profile_id: &str, template_id: &str) -> Result<(), AppError> {
    let profile = route_profiles::get_by_id(conn, profile_id)?;
    let members = route_profiles::list_providers(conn, profile_id)?;
    let snap = ProfileSnapshot {
        mode: profile.mode,
        selection_strategy: profile.selection_strategy,
        active_provider_id: profile.active_provider_id,
        members: members
            .into_iter()
            .map(|m| MemberSnapshot {
                provider_id: m.provider_id,
                priority: m.priority,
                enabled: m.enabled,
                model_override: m.model_override,
                cooldown_seconds: m.cooldown_seconds,
                failover_on_status_codes: m.failover_on_status_codes,
                failover_on_error_keywords: m.failover_on_error_keywords,
                routing_conditions: m.routing_conditions,
            })
            .collect(),
    };
    let json = serde_json::to_string(&snap).map_err(|e| AppError::internal(e.to_string()))?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO route_template_snapshots (route_profile_id, template_id, snapshot_json, applied_at)
         VALUES (?1, ?2, ?3, ?4)",
        params![profile_id, template_id, json, now],
    )?;
    Ok(())
}

fn replace_members(
    conn: &Connection,
    profile_id: &str,
    roles: &[RouteTemplateRole],
) -> Result<(), AppError> {
    conn.execute(
        "DELETE FROM route_profile_providers WHERE route_profile_id = ?1",
        [profile_id],
    )?;
    for role in roles {
        route_profiles::add_provider(
            conn,
            profile_id,
            &role.provider_id,
            AddProviderToRouteInput {
                priority: Some(role.priority),
                model_override: None,
                cooldown_seconds: None,
                failover_on_status_codes: None,
                failover_on_error_keywords: None,
                routing_conditions: role.routing_conditions.clone(),
            },
        )?;
    }
    Ok(())
}

fn restore_snapshot(
    conn: &Connection,
    profile_id: &str,
    snap: &ProfileSnapshot,
) -> Result<(), AppError> {
    conn.execute(
        "DELETE FROM route_profile_providers WHERE route_profile_id = ?1",
        [profile_id],
    )?;
    let now = chrono::Utc::now().to_rfc3339();
    for m in &snap.members {
        conn.execute(
            "INSERT INTO route_profile_providers (
                id, route_profile_id, provider_id, priority, enabled, model_override,
                cooldown_seconds, failover_on_status_codes, failover_on_error_keywords,
                routing_conditions, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)",
            params![
                uuid::Uuid::new_v4().to_string(),
                profile_id,
                m.provider_id,
                m.priority,
                m.enabled,
                m.model_override,
                m.cooldown_seconds,
                m.failover_on_status_codes,
                m.failover_on_error_keywords,
                m.routing_conditions,
                &now,
            ],
        )?;
    }
    route_profiles::update(
        conn,
        profile_id,
        crate::models::route_profile::UpdateRouteProfileInput {
            name: None,
            mode: Some(snap.mode.clone()),
            selection_strategy: Some(snap.selection_strategy.clone()),
            enabled: None,
        },
    )?;
    if let Some(active) = &snap.active_provider_id {
        let _ = route_profiles::set_active_provider(conn, profile_id, active);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::provider_selector::select_for_failover;
    use crate::models::provider::CreateProviderInput;
    use crate::storage::db::DbPool;
    use crate::storage::migrations;
    use r2d2::Pool;
    use r2d2_sqlite::SqliteConnectionManager;

    fn conn() -> rusqlite::Connection {
        let c = rusqlite::Connection::open_in_memory().unwrap();
        migrations::run_migrations(&c).unwrap();
        c
    }

    fn add_provider(conn: &Connection, name: &str, base_url: &str, active: bool) -> String {
        let p = providers::create(
            conn,
            CreateProviderInput {
                name: name.into(),
                provider_type: if is_local_base_url(base_url) {
                    "custom_openai_compatible".into()
                } else {
                    "openai".into()
                },
                base_url: base_url.into(),
                api_key: Some("sk-test".into()),
                default_model: "gpt-4o".into(),
                protocol: r#"["openai_chat_completions","openai_responses","anthropic_messages"]"#
                    .into(),
                timeout_seconds: Some(120),
                enabled: Some(true),
                ..Default::default()
            },
        )
        .unwrap();
        if active {
            let _ = providers::set_active(conn, &p.id);
        }
        p.id
    }

    fn default_responses_id(conn: &Connection) -> String {
        route_profiles::get_default_for_protocol(conn, "openai_responses")
            .unwrap()
            .expect("seeded Codex default")
            .id
    }

    fn input(
        template: &str,
        profile_id: &str,
        main: &str,
        background: &str,
        think: Option<&str>,
        all: bool,
    ) -> RouteTemplateInput {
        RouteTemplateInput {
            template_id: template.into(),
            profile_id: profile_id.into(),
            main_provider_id: Some(main.into()),
            think_provider_id: think.map(|s| s.to_string()),
            background_provider_id: Some(background.into()),
            apply_to_all_defaults: all,
        }
    }

    #[test]
    fn is_local_detects_loopback_only() {
        assert!(is_local_base_url("http://127.0.0.1:11434/v1"));
        assert!(is_local_base_url("http://localhost:1234/v1"));
        assert!(!is_local_base_url("https://api.deepseek.com"));
        assert!(!is_local_base_url("https://openrouter.ai/api/v1"));
    }

    #[test]
    fn task_split_writes_think_background_main_and_enables_failover() {
        let conn = conn();
        let think = add_provider(&conn, "ThinkCloud", "https://api.think.example", false);
        let main = add_provider(&conn, "MainCloud", "https://api.main.example", true);
        let bg = add_provider(&conn, "CheapCloud", "https://api.cheap.example", false);
        let profile_id = default_responses_id(&conn);

        let preview = apply(
            &conn,
            &input(
                TEMPLATE_TASK_SPLIT,
                &profile_id,
                &main,
                &bg,
                Some(&think),
                false,
            ),
        )
        .unwrap();
        assert!(preview.can_apply);
        assert_eq!(preview.roles.len(), 3);
        assert_eq!(preview.roles[0].role, ROLE_THINK);
        assert_eq!(preview.roles[1].role, ROLE_BACKGROUND);
        assert_eq!(preview.roles[2].role, ROLE_MAIN);

        let profile = route_profiles::get_by_id(&conn, &profile_id).unwrap();
        assert_eq!(profile.mode, "failover");
        let members = route_profiles::list_providers(&conn, &profile_id).unwrap();
        assert_eq!(members.len(), 3);
        assert!(members[0]
            .routing_conditions
            .as_ref()
            .unwrap()
            .contains("opus"));
        assert!(members[1]
            .routing_conditions
            .as_ref()
            .unwrap()
            .contains("haiku"));
        assert!(members[2].routing_conditions.is_none());
    }

    #[test]
    fn local_cloud_pins_background_to_loopback() {
        let conn = conn();
        let cloud = add_provider(&conn, "Cloud", "https://api.cloud.example", true);
        let local = add_provider(&conn, "Ollama", "http://127.0.0.1:11434/v1", false);
        let profile_id = default_responses_id(&conn);

        let preview = apply(
            &conn,
            &input(
                TEMPLATE_LOCAL_CLOUD,
                &profile_id,
                &cloud,
                &local,
                None,
                false,
            ),
        )
        .unwrap();
        assert_eq!(preview.roles.len(), 2);
        assert!(preview
            .roles
            .iter()
            .any(|r| r.role == ROLE_BACKGROUND && r.is_local));
        assert!(preview
            .roles
            .iter()
            .any(|r| r.role == ROLE_MAIN && !r.is_local));
    }

    #[test]
    fn local_cloud_rejects_cloud_background() {
        let conn = conn();
        let a = add_provider(&conn, "A", "https://api.a.example", true);
        let b = add_provider(&conn, "B", "https://api.b.example", false);
        let profile_id = default_responses_id(&conn);
        let err = apply(
            &conn,
            &input(TEMPLATE_LOCAL_CLOUD, &profile_id, &a, &b, None, false),
        )
        .unwrap_err();
        assert_eq!(err.code, codes::ROUTE_TEMPLATE_INVALID);
        assert!(err.message.to_lowercase().contains("local"));
    }

    #[test]
    fn think_same_as_main_is_skipped_not_duplicated() {
        let conn = conn();
        let main = add_provider(&conn, "Main", "https://api.main.example", true);
        let bg = add_provider(&conn, "Bg", "https://api.bg.example", false);
        let profile_id = default_responses_id(&conn);
        let preview = apply(
            &conn,
            &input(
                TEMPLATE_TASK_SPLIT,
                &profile_id,
                &main,
                &bg,
                Some(&main),
                false,
            ),
        )
        .unwrap();
        assert_eq!(preview.roles.len(), 2);
        assert!(preview
            .warnings
            .iter()
            .any(|w| w == "think_skipped_same_as_main"));
        assert!(preview.roles.iter().all(|r| r.role != ROLE_THINK));
    }

    #[test]
    fn rollback_restores_original_members_and_mode() {
        let conn = conn();
        let main = add_provider(&conn, "Main", "https://api.main.example", true);
        let bg = add_provider(&conn, "Bg", "http://127.0.0.1:11434/v1", false);
        let profile_id = default_responses_id(&conn);
        let before = route_profiles::list_providers(&conn, &profile_id).unwrap();
        let before_mode = route_profiles::get_by_id(&conn, &profile_id).unwrap().mode;
        assert!(!before.is_empty());

        apply(
            &conn,
            &input(TEMPLATE_LOCAL_CLOUD, &profile_id, &main, &bg, None, false),
        )
        .unwrap();
        assert_eq!(
            route_profiles::list_providers(&conn, &profile_id)
                .unwrap()
                .len(),
            2
        );

        rollback(&conn, &profile_id).unwrap();
        let after = route_profiles::list_providers(&conn, &profile_id).unwrap();
        assert_eq!(after.len(), before.len());
        assert_eq!(
            route_profiles::get_by_id(&conn, &profile_id).unwrap().mode,
            before_mode
        );
        assert!(!has_rollback(&conn, &profile_id).unwrap());
    }

    #[test]
    fn second_apply_keeps_original_snapshot() {
        let conn = conn();
        let main = add_provider(&conn, "Main", "https://api.main.example", true);
        let bg = add_provider(&conn, "Bg", "https://api.bg.example", false);
        let other = add_provider(&conn, "Other", "https://api.other.example", false);
        let profile_id = default_responses_id(&conn);
        let original_count = route_profiles::list_providers(&conn, &profile_id)
            .unwrap()
            .len();

        apply(
            &conn,
            &input(TEMPLATE_TASK_SPLIT, &profile_id, &main, &bg, None, false),
        )
        .unwrap();
        apply(
            &conn,
            &input(TEMPLATE_TASK_SPLIT, &profile_id, &main, &other, None, false),
        )
        .unwrap();
        rollback(&conn, &profile_id).unwrap();
        assert_eq!(
            route_profiles::list_providers(&conn, &profile_id)
                .unwrap()
                .len(),
            original_count
        );
    }

    #[test]
    fn apply_to_all_defaults_writes_every_default_profile() {
        let conn = conn();
        let main = add_provider(&conn, "Main", "https://api.main.example", true);
        let bg = add_provider(&conn, "Bg", "https://api.bg.example", false);
        let profile_id = default_responses_id(&conn);
        apply(
            &conn,
            &input(TEMPLATE_TASK_SPLIT, &profile_id, &main, &bg, None, true),
        )
        .unwrap();
        let defaults = route_profiles::list_all(&conn)
            .unwrap()
            .into_iter()
            .filter(|p| p.is_default)
            .collect::<Vec<_>>();
        assert!(defaults.len() >= 3);
        for p in defaults {
            let members = route_profiles::list_providers(&conn, &p.id).unwrap();
            assert_eq!(members.len(), 2, "{}", p.name);
            assert_eq!(
                route_profiles::get_by_id(&conn, &p.id).unwrap().mode,
                "failover"
            );
        }
    }

    #[test]
    fn failover_sends_haiku_to_background_and_opus_to_think() {
        let manager = SqliteConnectionManager::memory();
        let pool: DbPool = Pool::builder().max_size(1).build(manager).unwrap();
        let think;
        let main;
        let bg;
        {
            let conn = pool.get().unwrap();
            migrations::run_migrations(&conn).unwrap();
            think = add_provider(&conn, "ThinkCloud", "https://api.think.example", false);
            main = add_provider(&conn, "MainCloud", "https://api.main.example", true);
            bg = add_provider(&conn, "CheapCloud", "https://api.cheap.example", false);
            let profile_id = default_responses_id(&conn);
            apply(
                &conn,
                &input(
                    TEMPLATE_TASK_SPLIT,
                    &profile_id,
                    &main,
                    &bg,
                    Some(&think),
                    false,
                ),
            )
            .unwrap();
        }

        let haiku =
            select_for_failover(&pool, "openai_responses", Some("claude-haiku-4-5"), None).unwrap();
        assert_eq!(haiku.provider.id, bg);

        let opus =
            select_for_failover(&pool, "openai_responses", Some("claude-opus-4-6"), None).unwrap();
        assert_eq!(opus.provider.id, think);

        let sonnet =
            select_for_failover(&pool, "openai_responses", Some("claude-sonnet-4-6"), None)
                .unwrap();
        assert_eq!(sonnet.provider.id, main);
    }

    #[test]
    fn local_cloud_haiku_stays_on_loopback() {
        let manager = SqliteConnectionManager::memory();
        let pool: DbPool = Pool::builder().max_size(1).build(manager).unwrap();
        let cloud;
        let local;
        {
            let conn = pool.get().unwrap();
            migrations::run_migrations(&conn).unwrap();
            cloud = add_provider(&conn, "Cloud", "https://api.cloud.example", true);
            local = add_provider(&conn, "Ollama", "http://127.0.0.1:11434/v1", false);
            let profile_id = default_responses_id(&conn);
            apply(
                &conn,
                &input(
                    TEMPLATE_LOCAL_CLOUD,
                    &profile_id,
                    &cloud,
                    &local,
                    None,
                    false,
                ),
            )
            .unwrap();
        }
        let haiku =
            select_for_failover(&pool, "openai_responses", Some("claude-3-5-haiku"), None).unwrap();
        assert_eq!(haiku.provider.id, local);
        let sonnet =
            select_for_failover(&pool, "openai_responses", Some("claude-sonnet-4-6"), None)
                .unwrap();
        assert_eq!(sonnet.provider.id, cloud);
    }

    #[test]
    fn rollback_without_snapshot_errors() {
        let conn = conn();
        let profile_id = default_responses_id(&conn);
        let err = rollback(&conn, &profile_id).unwrap_err();
        assert_eq!(err.code, codes::ROUTE_TEMPLATE_NOTHING_TO_ROLLBACK);
    }

    #[test]
    fn background_model_match_applies_on_chat_and_messages_entries() {
        for protocol in ["openai_chat_completions", "anthropic_messages"] {
            let manager = SqliteConnectionManager::memory();
            let pool: DbPool = Pool::builder().max_size(1).build(manager).unwrap();
            let main;
            let bg;
            {
                let conn = pool.get().unwrap();
                migrations::run_migrations(&conn).unwrap();
                main = add_provider(&conn, "MainCloud", "https://api.main.example", true);
                bg = add_provider(&conn, "CheapCloud", "https://api.cheap.example", false);
                let profile_id = route_profiles::get_default_for_protocol(&conn, protocol)
                    .unwrap()
                    .unwrap_or_else(|| panic!("missing default profile for {protocol}"))
                    .id;
                apply(
                    &conn,
                    &input(TEMPLATE_TASK_SPLIT, &profile_id, &main, &bg, None, false),
                )
                .unwrap();
            }
            let haiku =
                select_for_failover(&pool, protocol, Some("claude-haiku-4-5"), None).unwrap();
            assert_eq!(haiku.provider.id, bg, "{protocol} haiku");
            let sonnet =
                select_for_failover(&pool, protocol, Some("claude-sonnet-4-6"), None).unwrap();
            assert_eq!(sonnet.provider.id, main, "{protocol} sonnet");
        }
    }
}
