<p align="center">
  <img src="docs/logo.svg" width="128" height="128" alt="MuxLayer Logo">
</p>

<h1 align="center">MuxLayer</h1>

<p align="center">
  <b>Coding Agent 的本地模型控制层。</b><br>
  MuxLayer 位于 Coding Agent 与 AI 模型供应商之间，在本地完成路由、协议转换、故障转移和请求追踪。
</p>

<p align="center">
  Codex · Claude Code · Gemini CLI · OpenCode · CodeLeveler<br>
  DeepSeek · Kimi · MiMo · OpenAI · Anthropic · OpenRouter · Ollama · 25+ 家模型供应商
</p>

> MuxLayer — formerly AgentGate

<p align="center">
  <a href="https://github.com/dengmengmian/muxlayer/releases"><img src="https://img.shields.io/github/v/release/dengmengmian/muxlayer?style=flat-square&color=blue" alt="Release"></a>
  <a href="https://github.com/dengmengmian/muxlayer/stargazers"><img src="https://img.shields.io/github/stars/dengmengmian/muxlayer?style=flat-square&cacheSeconds=3600" alt="Stars"></a>
  <a href="https://github.com/dengmengmian/muxlayer/releases"><img src="https://img.shields.io/github/downloads/dengmengmian/muxlayer/total?style=flat-square&color=green&cacheSeconds=3600" alt="Downloads"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License"></a>
</p>

<p align="center">
  <a href="./README.md">English</a> · <a href="https://github.com/dengmengmian/muxlayer/releases">下载安装</a> · <a href="#5-分钟跑通">5 分钟跑通</a> · <a href="./docs/full-reference.md">完整参考</a> · <a href="https://github.com/dengmengmian/muxlayer/discussions">💬 社区讨论</a>
</p>

<p align="center">
  GitHub：<a href="https://github.com/dengmengmian/muxlayer">dengmengmian/muxlayer</a>
</p>

<p align="center">
  <img src="docs/demo-header-v2.gif" width="800" alt="MuxLayer 在本地网关截获 Claude Code、Codex、Gemini CLI 的请求——在 25+ 家模型供应商之间转换、直连、路由或故障转移，每条请求都在本地可追踪">
</p>

> **v2.0.0 品牌迁移 + 老用户自动接管：** 现有桌面安装继续沿用原更新身份和数据目录；新的无界面安装使用 `~/.muxlayer`，并自动接管已有的 `~/.agentgate` 数据库或 token。[查看 v2.0.0 更新说明](./docs/release-notes/2.0.0.md)。

## 下载

| 你的机器 | 下载 |
|---|---|
| macOS Apple 芯片 | [MuxLayer 2.0.0](https://github.com/dengmengmian/muxlayer/releases/download/v2.0.0/MuxLayer_2.0.0_aarch64.dmg) |
| macOS Intel 芯片 | [MuxLayer 2.0.0](https://github.com/dengmengmian/muxlayer/releases/download/v2.0.0/MuxLayer_2.0.0_x64.dmg) |
| Windows 10 / 11 | [MuxLayer 2.0.0](https://github.com/dengmengmian/muxlayer/releases/download/v2.0.0/MuxLayer_2.0.0_x64-setup.exe) |
| Debian / Ubuntu | [MuxLayer 2.0.0](https://github.com/dengmengmian/muxlayer/releases/download/v2.0.0/MuxLayer_2.0.0_amd64.deb) |
| 其他 Linux 发行版 | [MuxLayer 2.0.0](https://github.com/dengmengmian/muxlayer/releases/download/v2.0.0/MuxLayer_2.0.0_amd64.AppImage) |

**Windows 安装提示：** Edge/Chrome 可能提示「通常不会下载」，SmartScreen 可能提示「Windows 已保护你的电脑」。这是预期行为：安装包目前**未做 Authenticode 代码签名**。业界没有像 Let’s Encrypt 那样「免费且被 Windows 默认信任」的代码签名证书（免费证书只管 HTTPS 网站，不能签 `.exe`），开源项目常见先发未签名包——**不是病毒报错**。请只从 [GitHub Releases](https://github.com/dengmengmian/muxlayer/releases) 下载；浏览器里选 **保留 / 仍要保留**，运行时点 **更多信息** → **仍要运行**。

macOS 也可以用 Homebrew 安装：

```bash
brew install --cask dengmengmian/tap/muxlayer
```

通过旧 `agentgate` cask 安装的用户仍可继续升级并获得同一个 MuxLayer 应用；新安装统一使用 `muxlayer`。

无界面 CLI（`agentgate-serve`）压缩包和历史版本在 [Releases](https://github.com/dengmengmian/muxlayer/releases) 页面。

## 为什么用 MuxLayer

| 官方体验不变 | 模型路由归你管 | 每次请求看得见 |
|:---|:---|:---|
| 保留 Codex / Claude Code / Gemini CLI / OpenCode / AtomCode 原有使用方式，并支持一键恢复官方配置。 | 官方客户端请求先进入 MuxLayer，再由本地决定协议转换、原生直连、Provider 和模型。 | 每次请求的路由、转换、上游错误、Token、成本、延迟和失败转移都在本地可追踪。 |

MuxLayer 不是托管 API 分发平台，也不是普通代理。它是 AI 模型请求的本地入口——每一次模型请求都先进入 MuxLayer，再由你决定路由、转换、故障转移还是原生直连。

## 三个专注的工具，一套工作流

**CodeLeveler 负责写代码，ReviewGate 负责代码 Review，MuxLayer 负责连接和
适配模型 API。** 三个工具都可以独立使用，也可以配合工作：

| 工具 | 专注于 |
|---|---|
| **MuxLayer** | 通过一个本地网关适配不同模型 API |
| [CodeLeveler](https://github.com/dengmengmian/CodeLeveler) | 在终端中理解、修改、运行并验证代码 |
| [ReviewGate](https://github.com/dengmengmian/ReviewGate) | 审查代码改动并筛出高置信问题 |

## 5 分钟跑通

1. 下载并安装 MuxLayer。
2. 打开 **快速配置** 或 **供应商**，粘贴你的 Provider API Key。
3. 在 **概览** 或 **网关** 点击 **启动网关**。默认端点是 `127.0.0.1:9090`。
4. 进入 **客户端**，对 Codex、Claude Code、OpenCode、Gemini CLI 或 AtomCode 点击 **应用配置**。
5. 回到对应客户端发一句话测试。需要恢复官方配置时，用 **切换到官方** 或配置历史回滚。

Provider 预设会填好常见 base URL、协议、默认模型和能力矩阵。新手通常不用先碰模型映射或高级端点字段。

## 常见用途

| 目标 | MuxLayer 做什么 |
|---|---|
| 让 Codex 使用 DeepSeek 或 MiMo | Codex 继续发送官方 Responses API 请求，MuxLayer 再转换或直连到你选的上游。 |
| 保留 Codex Desktop 插件能力 | 保持官方 OpenAI 登录态和 provider 识别路径，同时让模型请求走 MuxLayer。 |
| 让 Claude Code 使用 DeepSeek / MiMo / Copilot | 支持 Anthropic 兼容直通、模型名映射，以及可选 GitHub Copilot Provider。 |
| 避免 Provider 挂掉或额度卡住 | 按状态码、错误关键词、超时和冷却状态尝试故障转移 Provider。 |
| 防止长时间 AI 任务被系统休眠打断 | macOS 和 Windows 默认防休眠，也可按 AI 请求智能控制，并通过系统托盘快速切换。 |
| 看清每一次请求 | 记录原始/转换后请求、路由决策、上游错误、Token、延迟和预估成本；可对比原始与转换后 body，并导出脱敏复现包用于提 issue。 |
| 控制每天花多少钱 | 可选日预算闸，支持仅提醒 / 拦截 / 强制最便宜三种策略；只卡新请求，不会把正在跑的流式响应掐断。 |
| 让一轮对话固定走同一个上游 | 会话亲和让多轮对话粘在最初命中的上游，缓存命中和模型表现更稳定；故障转移与强制最便宜仍可覆盖。 |
| 跑本地模型 | 扫描 Ollama / LM Studio 及常见本地 OpenAI 兼容端口，一键添加为 Provider。 |
| 让上游请求走本机代理 | 设置 → 出站 HTTP 代理。只支持 `http://` / `https://`（Clash / V2Ray）。回环地址仍直连。地址为空时开关不生效；关闭则继续尊重环境变量 `HTTP(S)_PROXY`。 |
| 按请求内容选路 | 输入长度、是否有图、是否有工具、系统关键词、模型名匹配，现在 Chat Completions / Anthropic Messages / Gemini 也会评估，不再只对 Codex Responses 生效。 |

<details>
<summary>支持的 Provider</summary>

<!-- PROVIDER_CATALOG_TABLE:START -->
| Provider | 类型 | 原生协议 | 专属处理 |
|---|---|---|---|
| 小米 MiMo | `mimo` | Chat + Anthropic | 多轮 `reasoning_content` 回环、`tp-*` host 按区域自动切换、思考态剥 temperature、tool_choice 非 auto 剥除、omni web_search 剥除、web_search builtin 按矩阵翻译、Web Search Plugin 自动降级 / 重试 |
| DeepSeek | `deepseek` | Chat + Anthropic | 图片剥离并注入可解释提示、DeepSeek V4 thinking 历史 reasoning 回填、schema 清洗、消息重排 |
| Anthropic（Claude） | `anthropic` | Anthropic | `tool_use`/`tool_result`、`input_schema`、thinking budget、原生 cache_control |
| GitHub Copilot | `copilot` | Chat + Anthropic | GitHub token → Copilot bearer 交换、`x-initiator` 计费分类、Claude 模型 dash→dot 归一化 |
| OpenAI | `openai` | Chat + Responses | 无（Responses 透传或 Chat 转换） |
| Google Gemini | `google_gemini` | Chat | 无 |
| Kimi / Moonshot | `kimi` | Chat + Anthropic | `web_search` → `builtin_function`/`$web_search`；K3 使用 `reasoning_effort:max`（不用 K2 的 `thinking` 参数）；Coding 模型保留 thinking 开关控制 |
| MiniMax | `minimax` | Chat | 去 reasoning_effort / response_format、`<think>` 提取 |
| 智谱 GLM | `glm` | Chat | 通用 |
| 通义千问 DashScope | `dashscope` | Chat | 通用 |
| 硅基流动 SiliconFlow | `siliconflow` | Chat | 通用 |
| 火山引擎（豆包） | `volcengine` | Chat | 通用 |
| 百川 | `baichuan` | Chat | 通用 |
| 阶跃星辰 StepFun | `stepfun` | Chat | 通用 |
| 商汤日日新 SenseNova | `sensenova` | Chat | 清理 strict:null / response_format / 非 function 工具,合并 system 消息 |
| 零一万物 Yi | `yi` | Chat | 通用 |
| 魔搭 ModelScope | `modelscope` | Chat | 通用 |
| xAI（Grok） | `xai` | Chat | 通用 |
| Mistral | `mistral` | Chat | 通用 |
| Groq | `groq` | Chat | 通用 |
| Together | `together` | Chat | 通用 |
| Fireworks | `fireworks` | Chat | 通用 |
| Cerebras | `cerebras` | Chat | 通用 |
| Perplexity | `perplexity` | Chat | 通用 |
| Cohere | `cohere` | Chat | 通用 |
| OpenRouter | `openrouter` | Chat | 无 |
| 自定义 | `custom_openai_compatible` | Chat | 无（Base URL 用户自己填） |
<!-- PROVIDER_CATALOG_TABLE:END -->

</details>

## 教程

- [Codex Desktop 插件兼容](./docs/use-codex-desktop-with-third-party-api-and-plugins.md)
- [Codex + DeepSeek](./docs/use-codex-with-deepseek.md)
- [Codex + 小米 MiMo](./docs/use-codex-with-mimo.md)
- [Claude Code + DeepSeek](./docs/use-claude-code-with-deepseek.md)
- [Claude Code + GitHub Copilot](./docs/use-claude-code-with-github-copilot.md)
- [Gemini CLI](./docs/use-gemini-cli-with-muxlayer-zh.md)
- [OpenCode](./docs/use-opencode-with-muxlayer-zh.md)
- [Cursor / Continue / Cline](./docs/use-cursor-continue-cline-with-muxlayer-zh.md)
- [本地模型（Ollama / LM Studio）](./docs/use-local-models-with-muxlayer-zh.md)
- [完整参考](./docs/full-reference.md)

## 截图

| Dashboard | Providers |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Providers](docs/screenshots/providers.png) |

| Routes | Logs |
|---|---|
| ![Routes](docs/screenshots/routes.png) | ![Logs](docs/screenshots/logs.png) |

## 注意

- 品牌迁移和兼容边界：[MuxLayer 品牌迁移方案](./docs/brand-migration.md)
- GitHub Copilot Provider 是可选功能。在官方客户端之外使用 Copilot 订阅可能存在账号风险，启用前请阅读专门教程。
- 网关端点是 `127.0.0.1:9090`；`localhost:1420` 只是开发 UI 端口。
- MuxLayer 是本地优先、单用户工具。如果你要运营共享 API 服务或计费平台，one-api、new-api、LiteLLM 可能更合适。

## 开发

```bash
pnpm install
pnpm tauri dev
```

常用检查：

```bash
pnpm test
pnpm build
cd src-tauri && cargo test
```

## 社区

- 问题和安装帮助：[Discussions](https://github.com/dengmengmian/muxlayer/discussions)
- Bug 和 Provider 请求：[Issues](https://github.com/dengmengmian/muxlayer/issues)
- 贡献指南：[CONTRIBUTING.md](./CONTRIBUTING.md)

## License

MIT
