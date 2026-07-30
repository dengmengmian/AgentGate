//! Discover local OpenAI-compatible servers (Ollama, LM Studio, etc.).
//! Best-effort TCP + optional /v1/models probe. Never errors loudly to UI —
//! missing services just return empty or status=unreachable.

use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct LocalEndpoint {
    /// Display name, e.g. "Ollama".
    pub name: String,
    /// Suggested provider_type (usually custom_openai_compatible).
    pub provider_type: String,
    pub base_url: String,
    pub host: String,
    pub port: u16,
    /// true if TCP connect succeeded.
    pub reachable: bool,
    /// Models from GET /v1/models when reachable and JSON-shaped.
    pub models: Vec<String>,
    pub hint: String,
}

const PROBE_TIMEOUT: Duration = Duration::from_millis(400);

/// Well-known local AI ports. Order is display order.
fn catalog() -> Vec<(&'static str, &'static str, u16, &'static str)> {
    vec![
        (
            "Ollama",
            "http://127.0.0.1:11434/v1",
            11434,
            "Local models via Ollama OpenAI-compatible API",
        ),
        (
            "LM Studio",
            "http://127.0.0.1:1234/v1",
            1234,
            "LM Studio local server (OpenAI-compatible)",
        ),
        (
            "vLLM / OpenAI-compatible",
            "http://127.0.0.1:8000/v1",
            8000,
            "Common default for vLLM / local OpenAI proxies",
        ),
    ]
}

fn tcp_open(host: &str, port: u16) -> bool {
    use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
    let addr = format!("{host}:{port}");
    let Ok(mut addrs) = addr.to_socket_addrs() else {
        return false;
    };
    let Some(sa): Option<SocketAddr> = addrs.next() else {
        return false;
    };
    TcpStream::connect_timeout(&sa, PROBE_TIMEOUT).is_ok()
}

fn fetch_models(base_url: &str) -> Vec<String> {
    let url = format!("{}/models", base_url.trim_end_matches('/'));
    let client = match reqwest::blocking::Client::builder()
        .timeout(PROBE_TIMEOUT)
        .build()
    {
        Ok(c) => c,
        Err(_) => return vec![],
    };
    let Ok(resp) = client.get(&url).send() else {
        return vec![];
    };
    if !resp.status().is_success() {
        return vec![];
    }
    let Ok(v) = resp.json::<serde_json::Value>() else {
        return vec![];
    };
    v.get("data")
        .and_then(|d| d.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|m| m.get("id").and_then(|i| i.as_str()).map(str::to_string))
                .take(32)
                .collect()
        })
        .unwrap_or_default()
}

/// Probe catalog endpoints. Safe to call from UI; returns all candidates with reachability.
pub fn discover() -> Vec<LocalEndpoint> {
    catalog()
        .into_iter()
        .map(|(name, base_url, port, hint)| {
            let host = "127.0.0.1";
            let reachable = tcp_open(host, port);
            let models = if reachable {
                fetch_models(base_url)
            } else {
                vec![]
            };
            LocalEndpoint {
                name: name.to_string(),
                provider_type: "custom_openai_compatible".to_string(),
                base_url: base_url.to_string(),
                host: host.to_string(),
                port,
                reachable,
                models,
                hint: hint.to_string(),
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_has_ollama_and_lmstudio() {
        let c = catalog();
        assert!(c.iter().any(|x| x.2 == 11434));
        assert!(c.iter().any(|x| x.2 == 1234));
    }

    #[test]
    fn discover_returns_entries_without_panic() {
        // Offline CI: may all be unreachable — still returns 3 rows.
        let found = discover();
        assert_eq!(found.len(), 3);
        assert!(found
            .iter()
            .all(|e| e.provider_type == "custom_openai_compatible"));
    }
}
