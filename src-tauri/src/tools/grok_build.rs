//! Grok Build (`grok`) 一键接入 MuxLayer。
//!
//! 配置文件：`$GROK_HOME/config.toml`，未设时是 `~/.grok/config.toml`。
//! 官方自定义模型写法：https://docs.x.ai/build/overview#custom-models
//!
//! apply 只动：
//!   - `[models] default = "muxlayer"`（保留 web_search 等其它键）
//!   - `[model.muxlayer]` 指向网关 `/v1`，`api_backend = "responses"`

use std::fs;
use std::path::PathBuf;

use serde::Serialize;

use crate::errors::AppError;
use crate::security::local_token;

const MODEL_ID: &str = "muxlayer";
const UPSTREAM_MODEL: &str = "muxlayer";

fn home() -> PathBuf {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_default()
}

pub fn data_dir() -> PathBuf {
    std::env::var("GROK_HOME")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .map(PathBuf::from)
        .unwrap_or_else(|| home().join(".grok"))
}

pub fn config_path() -> PathBuf {
    data_dir().join("config.toml")
}

pub fn snapshot_paths() -> Vec<(&'static str, PathBuf)> {
    vec![("config.toml", config_path())]
}

#[derive(Debug, Clone, Serialize, specta::Type)]
pub struct GrokBuildConfigStatus {
    pub config_path: String,
    pub exists: bool,
    pub has_agentgate: bool,
    pub current_model: Option<String>,
}

#[derive(Debug, Clone, Serialize, specta::Type)]
#[specta(rename = "GrokBuildApplyConfigResult")]
pub struct ApplyConfigResult {
    pub success: bool,
    pub config_path: String,
    pub changed_keys: Vec<String>,
    pub warnings: Vec<String>,
}

pub fn detect() -> GrokBuildConfigStatus {
    let path = config_path();
    let path_str = path.to_string_lossy().to_string();
    let exists = path.exists();
    let (has_agentgate, current_model) = if exists {
        let content = fs::read_to_string(&path).unwrap_or_default();
        let has_ag = content.contains("[model.muxlayer]")
            || content.contains("ag_local_")
            || content.contains("agentgate");
        let model = content.lines().find_map(|l| {
            let t = l.trim();
            if t.starts_with("default") && t.contains('=') && !t.starts_with("default_") {
                t.split('=')
                    .nth(1)
                    .map(|v| v.trim().trim_matches('"').to_string())
            } else {
                None
            }
        });
        (has_ag, model)
    } else {
        (false, None)
    };
    GrokBuildConfigStatus {
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
                crate::errors::codes::GROK_CONFIG_WRITE_FAILED,
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
    merged = crate::tools::toml_merge::upsert_section_key(
        &merged,
        "models",
        "default",
        &format!("\"{MODEL_ID}\""),
    );
    let body = format!(
        "model = \"{UPSTREAM_MODEL}\"\n\
         base_url = \"http://{host}:{port}/v1\"\n\
         name = \"MuxLayer\"\n\
         description = \"Local MuxLayer gateway\"\n\
         api_key = \"{token}\"\n\
         api_backend = \"responses\"\n"
    );
    merged = crate::tools::toml_merge::upsert_section(&merged, &format!("model.{MODEL_ID}"), &body);
    write_toml(&path, &merged)?;
    Ok(ApplyConfigResult {
        success: true,
        config_path: path_str,
        changed_keys: vec!["models.default".into(), format!("model.{MODEL_ID}")],
        warnings: vec![],
    })
}

fn write_toml(path: &std::path::Path, content: &str) -> Result<(), AppError> {
    let tmp = path.with_extension("toml.tmp");
    fs::write(&tmp, content).map_err(|e| {
        AppError::new(
            crate::errors::codes::GROK_CONFIG_WRITE_FAILED,
            format!("Failed to write: {e}"),
        )
    })?;
    fs::rename(&tmp, path).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        AppError::new(
            crate::errors::codes::GROK_CONFIG_WRITE_FAILED,
            format!("Failed to replace: {e}"),
        )
    })?;
    crate::tools::config_verify::verify_written(path, content.as_bytes())
        .map_err(|e| AppError::new(crate::errors::codes::GROK_CONFIG_WRITE_FAILED, e))?;
    Ok(())
}

pub fn open_config() -> Result<(), AppError> {
    let path = config_path();
    if !path.exists() {
        return Err(AppError::new(
            crate::errors::codes::GROK_CONFIG_NOT_FOUND,
            "Grok Build config.toml does not exist",
        ));
    }
    open::that(&path).map_err(|e| {
        AppError::new(
            crate::errors::codes::GROK_CONFIG_OPEN_FAILED,
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
        r#"[models]
default = "{MODEL_ID}"

[model.{MODEL_ID}]
model = "{UPSTREAM_MODEL}"
base_url = "http://{host}:{port}/v1"
name = "MuxLayer"
api_key = "{masked}"
api_backend = "responses""#
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
        assert!(content.contains("[models]"));
        assert!(content.contains("default = \"muxlayer\""));
        assert!(content.contains("[model.muxlayer]"));
        assert!(content.contains("model = \"muxlayer\""));
        assert!(
            !content.contains("agentgate"),
            "new apply must not write legacy virtual model agentgate"
        );
        assert!(content.contains("api_backend = \"responses\""));
        assert!(content.contains("127.0.0.1:9090/v1"));
        assert!(content.contains("ag_local_"));
        assert!(detect().has_agentgate);
        cleanup(&temp);
    }

    #[test]
    fn test_apply_keeps_web_search_default() {
        let _guard = FS_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let temp = setup_temp_home();
        std::fs::create_dir_all(config_path().parent().unwrap()).unwrap();
        std::fs::write(
            config_path(),
            "[models]\ndefault = \"grok-build\"\nweb_search = \"grok-4.6\"\n",
        )
        .unwrap();
        apply("127.0.0.1", 9090).unwrap();
        let content = std::fs::read_to_string(config_path()).unwrap();
        assert!(content.contains("web_search = \"grok-4.6\""));
        assert!(content.contains("default = \"muxlayer\""));
        cleanup(&temp);
    }
}
