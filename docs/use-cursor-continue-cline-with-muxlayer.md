# Use Cursor / Continue / Cline with MuxLayer

MuxLayer exposes a local OpenAI-compatible entry point. Editor plugins that only need `base_url` + API key can route through MuxLayer without deep integration.

## Prerequisites

1. Install and open MuxLayer.
2. Add at least one provider and start the gateway (default `http://127.0.0.1:9090`).
3. Copy the local access token from **Settings → Security** (or Gateway connection card for the Base URL).

## Endpoints

| Protocol | URL |
|---|---|
| Base (OpenAI-compatible root) | `http://127.0.0.1:9090/v1` |
| Chat Completions | `http://127.0.0.1:9090/v1/chat/completions` |
| Responses | `http://127.0.0.1:9090/v1/responses` |
| Anthropic Messages | `http://127.0.0.1:9090/v1/messages` |

Auth: `Authorization: Bearer <ag_local_… token>` (same value as API key in most UIs).

Model: use a virtual name such as `muxlayer` if your client allows custom models, or map to the provider model MuxLayer routes to. Legacy `agentgate` still works.

## Cursor

1. Open Cursor Settings → Models / OpenAI-compatible provider.
2. Base URL: `http://127.0.0.1:9090/v1`
3. API Key: paste the MuxLayer local token.
4. Pick or add a model id that your route profile understands.

## Continue (VS Code)

1. Open Continue config (`~/.continue/config.json` or via the extension UI).
2. Add a custom OpenAI-compatible model:

```json
{
  "models": [
    {
      "title": "MuxLayer",
      "provider": "openai",
      "model": "muxlayer",
      "apiBase": "http://127.0.0.1:9090/v1",
      "apiKey": "ag_local_YOUR_TOKEN"
    }
  ]
}
```

3. Reload Continue and select **MuxLayer**.

## Cline / Roo Code

1. Open the extension settings for OpenAI-compatible providers.
2. Base URL: `http://127.0.0.1:9090/v1`
3. API Key: MuxLayer local token.
4. Model: `muxlayer` (or legacy `agentgate`) or a concrete upstream id.

## Limits

- MuxLayer guarantees the **OpenAI Chat Completions** (and where applicable Responses / Anthropic) shapes it implements. Plugin-specific protocols are not rewritten.
- Keep the gateway running while the editor is in use.
- Logs and cost appear in MuxLayer → **Logs** / **Overview**.

## Chinese

见 [中文版](./use-cursor-continue-cline-with-muxlayer-zh.md)。
