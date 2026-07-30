//! Minimal offline quirk regression matrix for high-traffic providers.
//! Each test exercises a real transform path (not a re-implementation).

#[cfg(test)]
mod tests {
    use crate::protocol::chat_completions::{ChatCompletionsRequest, ChatMessage};
    use crate::providers::adapter::ProviderConfig;
    use crate::transform::providers::for_config;
    use serde_json::json;

    fn cfg(provider_type: &str) -> ProviderConfig {
        ProviderConfig {
            name: provider_type.into(),
            provider_type: provider_type.into(),
            base_url: "http://127.0.0.1".into(),
            api_keys: vec!["k".into()],
            default_model: "m".into(),
            reasoning_model: None,
            timeout_seconds: 30,
            extra_headers: Default::default(),
            anthropic_base_url: None,
            responses_base_url: None,
            model_context_windows: Default::default(),
        }
    }

    fn base_req(model: &str) -> ChatCompletionsRequest {
        ChatCompletionsRequest {
            model: model.into(),
            messages: vec![ChatMessage {
                role: "user".into(),
                content: Some(json!([
                    {"type": "text", "text": "hi"},
                    {"type": "image_url", "image_url": {"url": "data:image/png;base64,abc"}}
                ])),
                reasoning_content: None,
                tool_calls: None,
                tool_call_id: None,
                name: None,
            }],
            tools: None,
            tool_choice: None,
            stream: false,
            temperature: Some(0.7),
            top_p: None,
            max_tokens: Some(64),
            max_completion_tokens: None,
            thinking: None,
            stream_options: None,
            response_format: None,
            reasoning_effort: None,
            seed: None,
            stop: None,
            frequency_penalty: None,
            presence_penalty: None,
            parallel_tool_calls: None,
            diagnostic_events: Vec::new(),
        }
    }

    #[test]
    fn deepseek_strips_images_with_notice() {
        let t = for_config(&cfg("deepseek"));
        let mut req = base_req("deepseek-chat");
        t.finalize_request(&mut req, &None);
        assert!(
            !req.diagnostic_events.is_empty(),
            "deepseek must record vision degradation"
        );
        let joined = req
            .diagnostic_events
            .iter()
            .map(|e| e.message.as_str())
            .collect::<Vec<_>>()
            .join(" ");
        assert!(
            joined.to_ascii_lowercase().contains("image")
                || joined.contains("vision")
                || joined.contains("strip"),
            "notice={joined}"
        );
    }

    #[test]
    fn minimax_transform_exists_and_runs() {
        let t = for_config(&cfg("minimax"));
        let mut req = base_req("MiniMax-Text");
        req.reasoning_effort = Some("high".into());
        t.finalize_request(&mut req, &None);
        let _ = req.messages;
    }

    #[test]
    fn kimi_transform_runs_on_k3() {
        let t = for_config(&cfg("kimi"));
        let mut req = base_req("kimi-k3");
        t.finalize_request(&mut req, &None);
        assert_eq!(req.model, "kimi-k3");
    }

    #[test]
    fn mimo_transform_runs() {
        let t = for_config(&cfg("mimo"));
        let mut req = base_req("mimo-v2.5");
        t.finalize_request(&mut req, &None);
    }

    #[test]
    fn anthropic_openai_copilot_transforms_exist() {
        let _ = for_config(&cfg("anthropic"));
        let _ = for_config(&cfg("openai"));
        let _ = for_config(&cfg("copilot"));
    }

    #[test]
    fn sensenova_transform_runs() {
        let t = for_config(&cfg("sensenova"));
        let mut req = base_req("SenseChat");
        t.finalize_request(&mut req, &None);
    }
}
