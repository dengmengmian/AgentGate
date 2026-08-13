//! Shared upstream HTTP client: timeouts, pool, optional outbound proxy.
//!
//! Loopback (`127.0.0.1` / `localhost` / `::1`) is always excluded from the
//! configured proxy so pet / local probes stay on-box. When the UI proxy is
//! off, reqwest still honours `HTTP(S)_PROXY` from the environment.

use reqwest::{Client, Proxy};
use std::time::Duration;

use crate::errors::AppError;
use crate::models::gateway::GatewaySettings;

const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
const POOL_IDLE: Duration = Duration::from_secs(30);
const TCP_KEEPALIVE: Duration = Duration::from_secs(20);
const NO_PROXY_HOSTS: &str = "localhost,127.0.0.1,::1";

/// Normalize and reject non-http(s) proxy URLs. Empty / whitespace → None.
pub fn parse_proxy_url(raw: &str) -> Result<Option<String>, AppError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(None);
    }
    let url = reqwest::Url::parse(trimmed).map_err(|e| {
        AppError::validation(format!("Invalid outbound proxy URL: {e}"))
            .with_suggestion("Use http://127.0.0.1:7890 or https://proxy.example:8080")
    })?;
    if url.scheme() != "http" && url.scheme() != "https" {
        return Err(AppError::validation(format!(
            "Outbound proxy must be http:// or https://, got {}",
            url.scheme()
        ))
        .with_suggestion("SOCKS is not supported; point at a local HTTP proxy (Clash / V2Ray)."));
    }
    if url.host_str().is_none() {
        return Err(AppError::validation("Outbound proxy URL is missing a host"));
    }
    Ok(Some(trimmed.to_string()))
}

pub fn proxy_from_settings(settings: &GatewaySettings) -> Result<Option<Proxy>, AppError> {
    if !settings.outbound_proxy_enabled {
        return Ok(None);
    }
    let Some(url) = parse_proxy_url(settings.outbound_proxy_url.as_deref().unwrap_or(""))? else {
        return Ok(None);
    };
    let proxy = Proxy::all(&url)
        .map_err(|e| AppError::validation(format!("Cannot apply outbound proxy: {e}")))?
        .no_proxy(reqwest::NoProxy::from_string(NO_PROXY_HOSTS));
    Ok(Some(proxy))
}

pub fn build_upstream_client(proxy: Option<Proxy>) -> Result<Client, AppError> {
    let mut builder = Client::builder()
        .read_timeout(Duration::from_secs(
            crate::gateway::sse_bootstrap::STREAM_READ_IDLE_HINT_SECS,
        ))
        .connect_timeout(CONNECT_TIMEOUT)
        .pool_idle_timeout(POOL_IDLE)
        .tcp_keepalive(TCP_KEEPALIVE);
    if let Some(proxy) = proxy {
        builder = builder.proxy(proxy);
    }
    builder
        .build()
        .map_err(|e| AppError::internal(format!("Failed to create HTTP client: {e}")))
}

pub fn build_upstream_client_from_settings(settings: &GatewaySettings) -> Result<Client, AppError> {
    build_upstream_client(proxy_from_settings(settings)?)
}

pub fn apply_optional_proxy(
    builder: reqwest::ClientBuilder,
    proxy: Option<Proxy>,
) -> reqwest::ClientBuilder {
    match proxy {
        Some(proxy) => builder.proxy(proxy),
        None => builder,
    }
}

pub fn proxy_from_db(db: &crate::storage::db::DbPool) -> Option<Proxy> {
    let conn = db.get().ok()?;
    let settings = crate::storage::gateway_settings::get(&conn).ok()?;
    proxy_from_settings(&settings).ok().flatten()
}

pub fn build_upstream_client_from_db(db: &crate::storage::db::DbPool) -> Result<Client, AppError> {
    let settings = db
        .get()
        .ok()
        .and_then(|conn| crate::storage::gateway_settings::get(&conn).ok());
    match settings {
        Some(s) => build_upstream_client_from_settings(&s),
        None => build_upstream_client(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_url_is_none() {
        assert_eq!(parse_proxy_url("").unwrap(), None);
        assert_eq!(parse_proxy_url("   ").unwrap(), None);
    }

    #[test]
    fn accepts_http_and_https() {
        assert_eq!(
            parse_proxy_url("http://127.0.0.1:7890").unwrap().as_deref(),
            Some("http://127.0.0.1:7890")
        );
        assert!(parse_proxy_url("https://proxy.local:8080")
            .unwrap()
            .is_some());
    }

    #[test]
    fn rejects_socks_and_garbage() {
        assert!(parse_proxy_url("socks5://127.0.0.1:1080").is_err());
        assert!(parse_proxy_url("not a url").is_err());
        assert!(parse_proxy_url("ftp://x").is_err());
    }

    #[test]
    fn disabled_settings_yield_no_proxy() {
        let mut s = sample_settings();
        s.outbound_proxy_enabled = false;
        s.outbound_proxy_url = Some("http://127.0.0.1:7890".into());
        assert!(proxy_from_settings(&s).unwrap().is_none());
    }

    #[test]
    fn enabled_settings_build_proxy() {
        let mut s = sample_settings();
        s.outbound_proxy_enabled = true;
        s.outbound_proxy_url = Some("http://127.0.0.1:7890".into());
        assert!(proxy_from_settings(&s).unwrap().is_some());
    }

    fn sample_settings() -> GatewaySettings {
        GatewaySettings {
            id: 1,
            host: "127.0.0.1".into(),
            port: 9090,
            active_provider_id: None,
            input_protocol: "responses".into(),
            output_protocol: "chat".into(),
            auto_start: false,
            log_retention_days: 14,
            body_filter_global: false,
            thinking_rectifier_global: false,
            error_mapper_global: false,
            health_probe_enabled: false,
            codex_compact_enabled: true,
            codex_compact_summary_max_tokens: 1500,
            request_body_limit_mb: 32,
            cost_alert_enabled: false,
            cost_alert_threshold: None,
            cost_budget_enabled: false,
            cost_budget_threshold: None,
            cost_budget_strategy: "notify_only".into(),
            auto_compact_enabled: true,
            auto_compact_usage_percent: 85,
            wake_enabled: true,
            wake_request_control: false,
            wake_cooldown_seconds: 900,
            wake_keep_display_awake: false,
            outbound_proxy_enabled: false,
            outbound_proxy_url: None,
            updated_at: "now".into(),
        }
    }
}
