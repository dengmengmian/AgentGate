//! Per-provider refiner recommendations (never force-on; UI/docs only).

/// Returns a short bilingual-friendly hint for which refiner to enable, if any.
pub fn suggestion_for(provider_type: &str) -> Option<&'static str> {
    match provider_type {
        "deepseek" => Some(
            "DeepSeek: enable Request field filter if you see 400 on images/tools; thinking rectifier for budget_tokens mismatches.",
        ),
        "kimi" | "moonshot" => Some(
            "Kimi: enable thinking rectifier for reasoning_effort / thinking shape; field filter if coding models reject temperature.",
        ),
        "mimo" => Some(
            "MiMo: field filter helps with web_search / tool_choice quirks; leave off if native path is stable.",
        ),
        "minimax" => Some(
            "MiniMax: field filter strips reasoning_effort / response_format that often 400.",
        ),
        "sensenova" => Some(
            "SenseNova: field filter merges system messages and drops unsupported tool fields.",
        ),
        "glm" | "dashscope" | "volcengine" | "baichuan" | "stepfun" | "yi" => Some(
            "Generic Chat providers: enable field filter only if upstream returns 400 on extra fields.",
        ),
        "anthropic" | "openai" | "copilot" | "google_gemini" => None,
        _ => Some(
            "Custom/OpenAI-compatible: try Request field filter if the server rejects unknown fields.",
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn known_quirky_providers_have_hints() {
        assert!(suggestion_for("deepseek").is_some());
        assert!(suggestion_for("kimi").is_some());
        assert!(suggestion_for("minimax").is_some());
    }

    #[test]
    fn first_class_natives_skip_hint() {
        assert!(suggestion_for("openai").is_none());
        assert!(suggestion_for("anthropic").is_none());
    }
}
