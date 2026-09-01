# 用 Cursor / Continue / Cline 接入 MuxLayer

MuxLayer 在本机提供 OpenAI 兼容入口。编辑器插件只需配置 `base_url` + API key，即可走 MuxLayer 的路由、failover 与日志，无需深集成。

## 前提

1. 安装并打开 MuxLayer。
2. 配置至少一个供应商并启动网关（默认 `http://127.0.0.1:9090`）。
3. 在 **设置 → 安全** 复制本地 access token（Gateway 页也有 Base URL 一键复制）。

## 端点

| 协议 | URL |
|---|---|
| OpenAI 兼容根路径 | `http://127.0.0.1:9090/v1` |
| Chat Completions | `http://127.0.0.1:9090/v1/chat/completions` |
| Responses | `http://127.0.0.1:9090/v1/responses` |
| Anthropic Messages | `http://127.0.0.1:9090/v1/messages` |

鉴权：`Authorization: Bearer <ag_local_…>`（多数 UI 的 API key 填同一值）。

模型：可用虚拟名 `muxlayer`（仍兼容 `agentgate`），或映射到 MuxLayer 路由目标模型。

## Cursor

1. Settings → Models / OpenAI-compatible。
2. Base URL：`http://127.0.0.1:9090/v1`
3. API Key：本地 token。
4. 选择/添加路由认识的模型 id。

## Continue（VS Code）

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

## Cline / Roo

OpenAI 兼容设置中填同样的 Base URL + token + 模型。

## 边界

- 只保证 MuxLayer 实现的 OpenAI / Responses / Anthropic 形态；插件私有协议不转换。
- 使用期间保持网关运行。
- 请求与费用在 MuxLayer **日志 / 概览** 查看。
