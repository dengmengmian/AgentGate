# Use Gemini CLI with MuxLayer

中文：[让 Gemini CLI 通过 MuxLayer 使用多供应商模型](./use-gemini-cli-with-muxlayer-zh.md)

MuxLayer gives Gemini CLI a local model entry so its requests can be routed, traced, and managed alongside Codex, Claude Code, OpenCode, and AtomCode.

## When to use this

Use this guide if you want:

- Gemini CLI to share the same local model entry and provider list as your other AI agent clients.
- Gemini-style requests routed through MuxLayer with model mapping and cost tracking.
- One-click client configuration instead of editing CLI config files by hand.
- Failover from one provider to another when the primary provider rate-limits or fails.

## Quick Setup

1. Download MuxLayer from [Releases](../../releases) and open the app.
2. Add at least one provider in **Quick Setup** or **Providers**.
3. Start the gateway from **Overview** or **Gateway**. The default endpoint is `http://127.0.0.1:9090`.
4. Open **Clients** and click **Apply Config** on the Gemini CLI card.
5. Send a test prompt from Gemini CLI.
6. Check MuxLayer **Logs** to confirm the selected provider and route.

## What MuxLayer configures

| Gemini CLI side | MuxLayer side | Provider side |
|---|---|---|
| Gemini API style request | Local gateway route | Chat-compatible upstream selected by route profile |
| Gemini model names | Model Mapping or `muxlayer` virtual model (`agentgate` still works) | Provider-specific model ID |
| Request logs | Client and route attribution | Token and cost estimation where available |

## Troubleshooting

| Symptom | Check |
|---|---|
| Gemini CLI still uses its old provider | Apply the Gemini CLI config again from **Clients**. |
| Gateway is unreachable | Make sure MuxLayer is running on `127.0.0.1:9090`. |
| Model name is rejected | Check the provider default model and Model Mapping. |
| Cost is missing | Confirm the model has a known or custom price in **Settings**. |

## Related

- [Use Codex with DeepSeek](./use-codex-with-deepseek.md)
- [Use OpenCode with MuxLayer](./use-opencode-with-muxlayer.md)
- [Main README](../README.md)
- [中文 README](../README_ZH.md)
