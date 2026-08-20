# Use local models (Ollama / LM Studio) with MuxLayer

MuxLayer can route Codex / Claude Code / OpenAI-compatible clients to **local** models the same way it routes to cloud providers.

## Quick path

1. Start Ollama (`ollama serve`) or LM Studio local server.
2. Open MuxLayer → **Providers**.
3. Click **Scan** under **Local models**.
4. Click **Add** on a reachable endpoint (or add offline and start the server later).
5. **Start Gateway**, apply a client config, chat as usual.

Default ports:

| Server | Base URL |
|---|---|
| Ollama | `http://127.0.0.1:11434/v1` |
| LM Studio | `http://127.0.0.1:1234/v1` |
| vLLM (common) | `http://127.0.0.1:8000/v1` |

API key can be any non-empty string (e.g. `local`) if the server does not require auth.

## Optional: draft local / main cloud

1. Add both a local provider and a cloud provider.
2. On **Routes**, set failover order or model-name match so background/cheap models go local.
3. Costs for local models stay $0 when priced as free / no catalog price.

## Notes

- Local providers use `custom_openai_compatible` + Chat Completions.
- Long sessions still benefit from auto-compact (Settings → Long-session auto-compact).
- Chinese guide: [中文](./use-local-models-with-agentgate-zh.md).
