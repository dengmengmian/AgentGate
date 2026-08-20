# 用本地模型（Ollama / LM Studio）接入 MuxLayer

MuxLayer 可以把 Codex / Claude Code 等客户端路由到**本机**模型，用法与云供应商相同。

## 最短路径

1. 启动 Ollama（`ollama serve`）或 LM Studio 本地服务。
2. MuxLayer → **供应商**。
3. 在 **本地模型** 点 **扫描**。
4. 对在线端点点 **添加**（离线也可先添加，稍后启动服务）。
5. **启动网关**，客户端应用配置后即可对话。

默认端口：

| 服务 | Base URL |
|---|---|
| Ollama | `http://127.0.0.1:11434/v1` |
| LM Studio | `http://127.0.0.1:1234/v1` |
| vLLM 常见端口 | `http://127.0.0.1:8000/v1` |

本地服务若不鉴权，API key 可填任意非空字符串（如 `local`）。

## 可选：草稿本地 / 主对话云端

1. 同时添加本地与云供应商。
2. 在 **路由** 用失败转移顺序或模型名匹配，把便宜/后台任务导向本地。
3. 本地模型无目录价时成本按 0 展示。

## 说明

- 类型为 `custom_openai_compatible`，走 Chat Completions。
- 长会话仍可用设置里的 **长会话自压缩**。
