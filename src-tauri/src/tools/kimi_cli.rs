//! Kimi Code CLI (`kimi`) 一键接入 MuxLayer。
//!
//! 配置文件：当前 Kimi Code CLI 读 `$KIMI_CODE_HOME`（未设时 `~/.kimi-code`）。
//! 旧版 `$KIMI_SHARE_DIR` / `~/.kimi` 仍兼容。
//! 官方文档：https://moonshotai.github.io/kimi-cli/en/configuration/config-files.html
//!
//! apply 只动三处，其它 provider / model / mcp 不动：
//!   - 顶级 `default_model = "muxlayer"`
//!   - `[providers.muxlayer]` type=openai（Chat Completions 兼容）
//!   - `[models.muxlayer]` 指向网关虚拟模型 `muxlayer`（旧配置里的 `agentgate` 仍可用）

use std::fs;
use std::path::PathBuf;

use serde::Serialize;

use crate::errors::AppError;
use crate::security::local_token;

const PROVIDER: &str = "muxlayer";
const MODEL_ALIAS: &str = "muxlayer";
const UPSTREAM_MODEL: &str = "muxlayer";
const MAX_CONTEXT_SIZE: u32 = 1_048_576;

fn home() -> PathBuf {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_default()
}

pub fn data_dir() -> PathBuf {
    if let Some(dir) = std::env::var("KIMI_CODE_HOME")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .map(PathBuf::from)
    {
        return dir;
    }
    if let Some(dir) = std::env::var("KIMI_SHARE_DIR")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .map(PathBuf::from)
    {
        return dir;
    }
    let kimi_code = home().join(".kimi-code");
    if kimi_code.is_dir() {
        kimi_code
    } else {
        home().join(".kimi")
    }
}

pub fn config_path() -> PathBuf {
    data_dir().join("config.toml")
}

pub fn snapshot_paths() -> Vec<(&'static str, PathBuf)> {
    vec![("config.toml", config_path())]
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct KimiCliConfigStatus {
    pub config_path: String,
    pub exists: bool,
    pub has_agentgate: bool,
    pub current_model: Option<String>,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
#[specta(rename = "KimiCliApplyConfigResult")]
pub struct ApplyConfigResult {
    pub success: bool,
    pub config_path: String,
    pub changed_keys: Vec<String>,
    pub warnings: Vec<String>,
}

pub fn detect() -> KimiCliConfigStatus {
    let path = config_path();
    let path_str = path.to_string_lossy().to_string();
    let exists = path.exists();
    let (has_agentgate, current_model) = if exists {
        let content = fs::read_to_string(&path).unwrap_or_default();
        let has_ag = content.contains("[providers.muxlayer]")
            || content.contains("ag_local_")
            || content.contains("agentgate");
        let model = content
            .lines()
            .find(|l| l.trim().starts_with("default_model") && l.contains('='))
            .and_then(|l| l.split('=').nth(1))
            .map(|v| v.trim().trim_matches('"').to_string());
        (has_ag, model)
    } else {
        (false, None)
    };
    KimiCliConfigStatus {
        config_path: path_str,
        exists,
        has_agentgate,
        current_model,
    }
}

pub fn apply(host: &str, port: i64) -> Result<ApplyConfigResult, AppError> {
    let token = local_token::ensure_token()?;
    let path = config_path();
    let path_str = path.to_string_lossy().to_string();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            AppError::new(
                crate::errors::codes::KIMI_CONFIG_WRITE_FAILED,
                format!("Cannot create directory: {e}"),
            )
        })?;
    }
    let existing = if path.exists() {
        fs::read_to_string(&path).unwrap_or_default()
    } else {
        String::new()
    };
    let mut merged = existing;
    merged = crate::tools::toml_merge::upsert_top_level_key(
        &merged,
        "default_model",
        &format!("\"{MODEL_ALIAS}\""),
    );
    let provider_body = format!(
        "type = \"openai\"\nbase_url = \"http://{host}:{port}/v1\"\napi_key = \"{token}\"\n"
    );
    merged = crate::tools::toml_merge::upsert_section(
        &merged,
        &format!("providers.{PROVIDER}"),
        &provider_body,
    );
    let model_body = format!(
        "provider = \"{PROVIDER}\"\nmodel = \"{UPSTREAM_MODEL}\"\nmax_context_size = {MAX_CONTEXT_SIZE}\ndisplay_name = \"MuxLayer\"\n"
    );
    merged = crate::tools::toml_merge::upsert_section(
        &merged,
        &format!("models.{MODEL_ALIAS}"),
        &model_body,
    );
    write_toml(&path, &merged)?;
    Ok(ApplyConfigResult {
        success: true,
        config_path: path_str,
        changed_keys: vec![
            "default_model".into(),
            format!("providers.{PROVIDER}"),
            format!("models.{MODEL_ALIAS}"),
        ],
        warnings: vec![],
    })
}

fn write_toml(path: &std::path::Path, content: &str) -> Result<(), AppError> {
    let tmp = path.with_extension("toml.tmp");
    fs::write(&tmp, content).map_err(|e| {
        AppError::new(
            crate::errors::codes::KIMI_CONFIG_WRITE_FAILED,
            format!("Failed to write: {e}"),
        )
    })?;
    fs::rename(&tmp, path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        AppError::new(
            crate::errors::codes::KIMI_CONFIG_WRITE_FAILED,
            format!("Failed to replace: {e}"),
        )
    })?;
    crate::tools::config_verify::verify_written(path, content.as_bytes())
        .map_err(|e| AppError::new(crate::errors::codes::KIMI_CONFIG_WRITE_FAILED, e))?;
    Ok(())
}

pub fn open_config() -> Result<(), AppError> {
    let path = config_path();
    if !path.exists() {
        return Err(AppError::new(
            crate::errors::codes::KIMI_CONFIG_NOT_FOUND,
            "Kimi CLI config.toml does not exist",
        ));
    }
    open::that(&path).map_err(|e| {
        AppError::new(
            crate::errors::codes::KIMI_CONFIG_OPEN_FAILED,
            format!("Failed to open: {e}"),
        )
    })
}

pub fn generate_snippet(host: &str, port: i64) -> String {
    let masked = match local_token::read_token() {
        Ok(t) => local_token::mask_token(&t),
        Err(_) => "ag_local_<not_generated>".to_string(),
    };
    format!(
        r#"default_model = "{MODEL_ALIAS}"

[providers.{PROVIDER}]
type = "openai"
base_url = "http://{host}:{port}/v1"
api_key = "{masked}"

[models.{MODEL_ALIAS}]
provider = "{PROVIDER}"
model = "{UPSTREAM_MODEL}"
max_context_size = {MAX_CONTEXT_SIZE}
display_name = "MuxLayer""#
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::{cleanup, setup_temp_home, FS_LOCK};

    #[test]
    fn test_detect_no_config() {
        let _guard = FS_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp = setup_temp_home();
        let status = detect();
        assert!(!status.exists);
        assert!(!status.has_agentgate);
        cleanup(&temp);
    }

    #[test]
    fn test_apply_creates_config() {
        let _guard = FS_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp = setup_temp_home();
        let result = apply("127.0.0.1", 9090).unwrap();
        assert!(result.success);
        let content = std::fs::read_to_string(config_path()).unwrap();
        assert!(content.contains("default_model = \"muxlayer\""));
        assert!(content.contains("[providers.muxlayer]"));
        assert!(content.contains("type = \"openai\""));
        assert!(content.contains("127.0.0.1:9090/v1"));
        assert!(content.contains("ag_local_"));
        assert!(content.contains("[models.muxlayer]"));
        assert!(content.contains("model = \"muxlayer\""));
        assert!(
            content.contains("max_context_size = 1048576"),
            "Kimi CLI refuses models without a positive max_context_size"
        );
        assert!(
            !content.contains("agentgate"),
            "new apply must not write legacy virtual model agentgate"
        );
        assert!(detect().has_agentgate);
        cleanup(&temp);
    }

    #[test]
    fn test_apply_preserves_other_providers() {
        let _guard = FS_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp = setup_temp_home();
        std::fs::create_dir_all(config_path().parent().unwrap()).unwrap();
        std::fs::write(
            config_path(),
            r#"default_model = "kimi-for-coding"

[providers.kimi-for-coding]
type = "kimi"
base_url = "https://api.kimi.com/coding/v1"
api_key = "sk-user"

[models.kimi-for-coding]
provider = "kimi-for-coding"
model = "kimi-for-coding"
"#,
        )
        .unwrap();
        apply("127.0.0.1", 9090).unwrap();
        let content = std::fs::read_to_string(config_path()).unwrap();
        assert!(content.contains("[providers.kimi-for-coding]"));
        assert!(content.contains("sk-user"));
        assert!(content.contains("[providers.muxlayer]"));
        assert!(content.contains("default_model = \"muxlayer\""));
        cleanup(&temp);
    }

    #[test]
    fn test_apply_writes_kimi_code_home_when_present() {
        let _guard = FS_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp = setup_temp_home();
        std::env::remove_var("KIMI_CODE_HOME");
        std::env::remove_var("KIMI_SHARE_DIR");
        let kimi_code = temp.join(".kimi-code");
        std::fs::create_dir_all(&kimi_code).unwrap();
        apply("127.0.0.1", 9090).unwrap();
        let new_path = kimi_code.join("config.toml");
        let old_path = temp.join(".kimi").join("config.toml");
        assert!(new_path.exists(), "current kimi CLI reads ~/.kimi-code");
        assert!(
            !old_path.exists(),
            "must not write the migrated ~/.kimi path"
        );
        let content = std::fs::read_to_string(&new_path).unwrap();
        assert!(content.contains("default_model = \"muxlayer\""));
        assert!(content.contains("[providers.muxlayer]"));
        cleanup(&temp);
    }
}
