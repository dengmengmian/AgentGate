import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siteDir = path.resolve(__dirname, "..");
const docsDir = path.resolve(siteDir, "..", "docs");
const baseUrl = "https://dengmengmian.github.io/muxlayer";
const repoUrl = "https://github.com/dengmengmian/muxlayer";
const releaseUrl = `${repoUrl}/releases/latest`;
// 手工维护的日期,只在对应内容真实变化时更新,不用构建时间冒充更新
const thinPageDates = { published: "2026-06-16", modified: "2026-07-03" };
const goatcounterSnippet =
  '<script data-goatcounter="https://agentgate.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>';

const pagePairs = [
  {
    slug: "use-codex-with-openrouter",
    en: {
      title: "Use Codex with OpenRouter through MuxLayer",
      description:
        "Point Codex at MuxLayer and route requests to OpenRouter or other OpenAI-compatible providers from one local gateway.",
      eyebrow: "Codex + OpenRouter",
      h1: "Use Codex with OpenRouter through MuxLayer.",
      summary:
        "MuxLayer gives Codex one local endpoint and lets you choose OpenRouter, DeepSeek, OpenAI, or another upstream provider per route.",
      keywords:
        "Codex OpenRouter, use Codex with OpenRouter, OpenRouter local gateway, Codex proxy",
      sections: [
        {
          heading: "Why not edit Codex every time",
          body: "Provider experiments are easier when Codex points to one stable local gateway. MuxLayer keeps that local endpoint stable while route profiles decide the upstream provider.",
        },
        {
          heading: "Setup path",
          body: "Create or enable an OpenRouter provider, set the API key, choose a model, then apply the Codex config in MuxLayer. Requests should appear in the logs with the selected upstream.",
        },
        {
          heading: "Routing flexibility",
          body: "You can keep OpenRouter as the default route, add failover providers, or create separate profiles for different clients and tasks.",
        },
      ],
      faq: [
        ["Can I use other OpenAI-compatible providers too?", "Yes. MuxLayer is designed to manage multiple upstream providers from a local gateway."],
        ["Do I need to change Codex again later?", "Usually no. Keep Codex pointed at MuxLayer and change routes inside MuxLayer."],
      ],
    },
    zh: {
      title: "通过 MuxLayer 让 Codex 使用 OpenRouter",
      description:
        "让 Codex 指向 MuxLayer，再从一个本地网关把请求路由到 OpenRouter 或其他 OpenAI 兼容 Provider。",
      eyebrow: "Codex + OpenRouter",
      h1: "通过 MuxLayer 让 Codex 使用 OpenRouter。",
      summary:
        "MuxLayer 给 Codex 一个本地入口，你可以在路由里选择 OpenRouter、DeepSeek、OpenAI 或其他上游。",
      keywords:
        "Codex OpenRouter, Codex 使用 OpenRouter, OpenRouter 本地网关, Codex 代理",
      sections: [
        {
          heading: "为什么不要每次都改 Codex",
          body: "测试不同 Provider 时，让 Codex 指向一个稳定的本地网关更省心。MuxLayer 保持本地入口不变，具体上游由路由策略决定。",
        },
        {
          heading: "接入路径",
          body: "创建或启用 OpenRouter Provider，填写 API key，选择模型，然后在 MuxLayer 里对 Codex 执行 apply。请求进入后，可以在日志里看到实际上游。",
        },
        {
          heading: "路由灵活性",
          body: "你可以把 OpenRouter 设为默认路由，也可以添加故障转移 Provider，或者为不同客户端和任务创建不同路由策略。",
        },
      ],
      faq: [
        ["也能接其他 OpenAI 兼容 Provider 吗？", "可以。MuxLayer 的目标就是用一个本地网关管理多个上游 Provider。"],
        ["之后还需要再改 Codex 吗？", "通常不用。Codex 保持指向 MuxLayer，后续只在 MuxLayer 里改路由。"],
      ],
    },
  },
  {
    slug: "use-claude-code-with-openrouter",
    en: {
      title: "Use Claude Code with OpenRouter through a local gateway",
      description:
        "Route Claude Code traffic through MuxLayer to OpenRouter, with local request logs, rollback, and provider failover.",
      eyebrow: "Claude Code + OpenRouter",
      h1: "Use Claude Code with OpenRouter through MuxLayer.",
      summary:
        "MuxLayer keeps Claude Code configured once, then lets you route model requests to OpenRouter or another provider locally.",
      keywords:
        "Claude Code OpenRouter, use Claude Code with OpenRouter, Claude Code local gateway",
      sections: [
        {
          heading: "One stable local endpoint",
          body: "Instead of repeatedly changing Claude Code settings, point it at MuxLayer. Provider selection, model mapping, and failover live in the local MuxLayer dashboard.",
        },
        {
          heading: "Setup path",
          body: "Enable an OpenRouter provider, choose a model, start the gateway, and apply the Claude Code client config. Verify provider selection in request logs before doing long sessions.",
        },
        {
          heading: "What you gain",
          body: "You get local request history, faster provider experiments, and the ability to return to official client config when needed.",
        },
      ],
      faq: [
        ["Is this a hosted proxy?", "No. MuxLayer runs locally on your machine."],
        ["Can I keep multiple providers?", "Yes. You can configure OpenRouter plus direct providers and route between them."],
      ],
    },
    zh: {
      title: "通过本地网关让 Claude Code 使用 OpenRouter",
      description:
        "用 MuxLayer 把 Claude Code 请求路由到 OpenRouter，保留本地请求日志、配置回滚和 Provider 故障转移。",
      eyebrow: "Claude Code + OpenRouter",
      h1: "通过 MuxLayer 让 Claude Code 使用 OpenRouter。",
      summary:
        "Claude Code 只配置一次指向 MuxLayer，后续由本地路由决定请求去 OpenRouter 还是其他 Provider。",
      keywords:
        "Claude Code OpenRouter, Claude Code 使用 OpenRouter, Claude Code 本地网关",
      sections: [
        {
          heading: "一个稳定的本地入口",
          body: "不用反复修改 Claude Code 设置，只让它指向 MuxLayer。Provider 选择、模型映射和故障切换都在本地面板里完成。",
        },
        {
          heading: "接入路径",
          body: "启用 OpenRouter Provider，选择模型，启动网关，并对 Claude Code 执行 apply。长时间使用前，先在请求日志里确认路由正确。",
        },
        {
          heading: "你能得到什么",
          body: "本地请求历史、更快的 Provider 实验，以及需要时恢复官方客户端配置的能力。",
        },
      ],
      faq: [
        ["这是托管代理吗？", "不是。MuxLayer 运行在你自己的机器上。"],
        ["可以保留多个 Provider 吗？", "可以。你可以同时配置 OpenRouter 和直连 Provider，并在它们之间路由。"],
      ],
    },
  },
  {
    slug: "trace-codex-requests",
    en: {
      title: "Trace Codex model requests locally with MuxLayer",
      description:
        "Use MuxLayer to see where Codex requests went, which provider handled them, token usage, cost, errors, and failover decisions.",
      eyebrow: "Request tracing",
      h1: "Trace Codex model requests locally.",
      summary:
        "MuxLayer records Codex request routing, provider choice, errors, token usage, and cost in a local dashboard.",
      keywords:
        "trace Codex requests, Codex request logs, Codex cost tracking, local AI gateway logs",
      sections: [
        {
          heading: "The problem",
          body: "When a client talks directly to a provider, failed requests and cost spikes are hard to inspect. MuxLayer makes the request path visible before it leaves your machine.",
        },
        {
          heading: "What MuxLayer records",
          body: "You can inspect route profile, upstream provider, model, status, latency, token usage, estimated cost, and failover behavior when available.",
        },
        {
          heading: "How to use it",
          body: "Apply the Codex config, run a request, then open the Logs page. Filter by client or provider to understand which route handled the request.",
        },
      ],
      faq: [
        ["Are logs stored remotely?", "No. MuxLayer is local-first and stores request traces locally."],
        ["Can I debug failed provider calls?", "Yes. The logs and diagnostics pages are designed for exactly that workflow."],
      ],
    },
    zh: {
      title: "用 MuxLayer 本地追踪 Codex 模型请求",
      description:
        "通过 MuxLayer 查看 Codex 请求去了哪里、由哪个 Provider 处理、Token 用量、成本、错误和故障转移决策。",
      eyebrow: "请求追踪",
      h1: "本地追踪 Codex 模型请求。",
      summary:
        "MuxLayer 在本地记录 Codex 请求的路由、Provider、错误、Token 用量和成本。",
      keywords:
        "追踪 Codex 请求, Codex 请求日志, Codex 成本统计, AI 本地网关日志",
      sections: [
        {
          heading: "问题",
          body: "客户端直接连 Provider 时，请求失败、成本异常和路由结果都不容易看清。MuxLayer 让请求离开本机前先变得可观察。",
        },
        {
          heading: "MuxLayer 会记录什么",
          body: "你可以看到路由策略、上游 Provider、模型、状态码、延迟、Token 用量、估算成本，以及可用时的故障转移行为。",
        },
        {
          heading: "怎么用",
          body: "对 Codex 执行 apply，发起一次请求，然后打开日志页。按客户端或 Provider 过滤，就能看清是哪条路由处理了请求。",
        },
      ],
      faq: [
        ["日志会上传吗？", "不会。MuxLayer 是本地优先，追踪数据保存在本地。"],
        ["能排查 Provider 调用失败吗？", "可以。日志和诊断页就是为这类排查准备的。"],
      ],
    },
  },
  {
    slug: "local-ai-gateway",
    en: {
      title: "Local AI gateway for model routing, tracing, and failover",
      description:
        "MuxLayer is a local AI gateway for model requests from AI apps and clients. Route providers, trace requests, fail over, and keep configs reversible.",
      eyebrow: "Local AI gateway",
      h1: "A local AI gateway for model requests.",
      summary:
        "MuxLayer sits on your machine and gives AI apps one local entry for provider routing, protocol conversion, tracing, and rollback.",
      keywords:
        "local AI gateway, AI model gateway, local LLM proxy, OpenAI compatible gateway, Anthropic gateway",
      sections: [
        {
          heading: "What a local AI gateway does",
          body: "It gives your AI apps a stable local endpoint, then decides which upstream provider and model should handle each request.",
        },
        {
          heading: "Why MuxLayer",
          body: "MuxLayer focuses on client compatibility, local logs, provider failover, multi-key rotation, and reversible config changes instead of hiding everything behind a hosted service.",
        },
        {
          heading: "Who it is for",
          body: "Use it when you run multiple AI clients, compare providers, need request history, or want a safer way to switch model backends without breaking client workflows.",
        },
      ],
      faq: [
        ["Is MuxLayer only for coding tools?", "No. It works best with supported clients today, but the goal is broader AI app request routing."],
        ["Does MuxLayer sell API keys?", "No. You bring your own provider keys and run the gateway locally."],
      ],
    },
    zh: {
      title: "用于模型路由、追踪和故障切换的本地 AI 网关",
      description:
        "MuxLayer 是面向 AI 应用和客户端的本地模型请求网关。管理 Provider 路由、请求追踪、故障转移和可回滚配置。",
      eyebrow: "本地 AI 网关",
      h1: "一个管理模型请求的本地 AI 网关。",
      summary:
        "MuxLayer 跑在你的机器上，给 AI 应用一个本地入口，用于 Provider 路由、协议转换、请求追踪和配置回滚。",
      keywords:
        "本地 AI 网关, AI 模型网关, 本地 LLM 代理, OpenAI 兼容网关, Anthropic 网关",
      sections: [
        {
          heading: "本地 AI 网关做什么",
          body: "它给 AI 应用一个稳定的本地入口，再决定每次请求应该交给哪个上游 Provider 和模型处理。",
        },
        {
          heading: "为什么是 MuxLayer",
          body: "MuxLayer 重点做客户端兼容、本地日志、Provider 故障转移、多 key 轮询和可恢复配置，而不是把所有东西藏在托管服务后面。",
        },
        {
          heading: "适合谁",
          body: "如果你同时使用多个 AI 客户端、经常比较 Provider、需要请求历史，或想更安全地切换模型后端，MuxLayer 就适合你。",
        },
      ],
      faq: [
        ["MuxLayer 只给编程工具用吗？", "不是。当前对几个常见客户端支持最好，但目标是更广泛的 AI 应用请求路由。"],
        ["MuxLayer 卖 API key 吗？", "不卖。你使用自己的 Provider key，并在本地运行网关。"],
      ],
    },
  },
  {
    slug: "muxlayer-vs-litellm",
    en: {
      title: "MuxLayer vs LiteLLM: local desktop gateway or API proxy",
      description:
        "Compare MuxLayer and LiteLLM for local AI app routing, client config rollback, request tracing, provider failover, and protocol compatibility.",
      eyebrow: "MuxLayer vs LiteLLM",
      h1: "MuxLayer vs LiteLLM.",
      summary:
        "MuxLayer is better when you want a local desktop gateway for AI apps and reversible client configs. LiteLLM is better when you want a server-side proxy layer for many API consumers.",
      keywords:
        "MuxLayer vs LiteLLM, LiteLLM alternative, local AI gateway, AI proxy comparison, model gateway comparison",
      sections: [
        {
          heading: "The short difference",
          body: "MuxLayer is focused on local app workflows: apply client configs, route model traffic, inspect logs, and roll back safely. LiteLLM is focused on a programmable proxy and gateway layer for teams and services.",
        },
        {
          heading: "Choose MuxLayer when",
          body: "You use AI desktop apps or clients, want local request history, need quick provider switching, and prefer one-click config restore over maintaining a separate proxy service.",
        },
        {
          heading: "Choose LiteLLM when",
          body: "You need a deployed proxy for many applications, advanced server-side policy, or a gateway managed as infrastructure rather than a local desktop tool.",
        },
      ],
      faq: [
        ["Is MuxLayer a LiteLLM replacement?", "Not exactly. They overlap on provider routing, but MuxLayer is more local-client oriented."],
        ["Can they be used together?", "Yes. MuxLayer can sit in a local workflow while another gateway handles upstream infrastructure if that is how you operate."],
      ],
    },
    zh: {
      title: "MuxLayer vs LiteLLM：本地桌面网关还是 API 代理",
      description:
        "对比 MuxLayer 和 LiteLLM 在本地 AI 应用路由、客户端配置回滚、请求追踪、Provider 故障转移和协议兼容上的差异。",
      eyebrow: "MuxLayer vs LiteLLM",
      h1: "MuxLayer vs LiteLLM。",
      summary:
        "如果你需要面向 AI 应用的本地桌面网关和可回滚客户端配置，MuxLayer 更合适；如果你要给多个服务提供统一 API 代理层，LiteLLM 更合适。",
      keywords:
        "MuxLayer vs LiteLLM, LiteLLM 替代, 本地 AI 网关, AI 代理对比, 模型网关对比",
      sections: [
        {
          heading: "一句话区别",
          body: "MuxLayer 更关注本地应用工作流：应用客户端配置、路由模型请求、查看日志、安全回滚。LiteLLM 更关注给团队和服务使用的可编程代理网关。",
        },
        {
          heading: "什么时候选 MuxLayer",
          body: "你使用 AI 桌面应用或客户端，需要本地请求历史、快速 Provider 切换，并且希望一键恢复客户端配置，而不是维护一套独立代理服务。",
        },
        {
          heading: "什么时候选 LiteLLM",
          body: "你需要给多个应用部署统一代理、做更复杂的服务端策略，或者把网关作为基础设施来管理。",
        },
      ],
      faq: [
        ["MuxLayer 是 LiteLLM 替代品吗？", "不完全是。两者在 Provider 路由上有重叠，但 MuxLayer 更偏本地客户端工作流。"],
        ["它们能一起用吗？", "可以。MuxLayer 可以负责本地客户端链路，上游仍然可以接已有的网关基础设施。"],
      ],
    },
  },
  {
    slug: "muxlayer-vs-cc-switch-and-ccr",
    en: {
      title: "MuxLayer vs cc-switch vs CCR",
      description:
        "cc-switch switches client configs. CCR is a multi-agent control plane. MuxLayer is a local protocol gateway with routing, logs, and one-click apply/rollback.",
      eyebrow: "MuxLayer vs cc-switch / CCR",
      h1: "Not a config switcher. Not a multi-agent console.",
      summary:
        "Use cc-switch if you only need to swap API endpoints across many clients. Use CCR if you want a control plane for many agents. Use MuxLayer if the client stays pointed at one local gateway and you need protocol conversion, failover, cost, and request traces.",
      keywords:
        "MuxLayer vs cc-switch, MuxLayer vs CCR, Claude Code Router alternative, local AI gateway comparison",
      sections: [
        {
          heading: "What each one is",
          body: "cc-switch writes provider settings into client config files and switches among them. CCR (Claude Code Router and similar) sits in front of coding agents as a multi-agent / routing control plane. MuxLayer is a local HTTP gateway: Chat Completions, Anthropic Messages, Responses, and Gemini enter one process; mapping, failover, budget, cache, and logs happen there.",
        },
        {
          heading: "Choose MuxLayer when",
          body: "You want Codex, Claude Code, Gemini CLI, OpenCode, Kimi CLI, Grok Build, or DeepSeek Harness to keep one stable local endpoint. Provider changes, model mapping, task-split routes, and debugging stay in MuxLayer. Apply/rollback is included, but the product is the gateway, not the config editor.",
        },
        {
          heading: "Choose the others when",
          body: "cc-switch is enough if you never need a proxy: just rewrite client files and restart. CCR is a better fit if your problem is orchestrating many agents, not converting protocols or inspecting token cost. MuxLayer does not try to copy their client count or agent marketplace.",
        },
      ],
      faq: [
        ["Can MuxLayer replace cc-switch?", "Only the part where you point a client at a local gateway. It does not sync every client format cc-switch knows."],
        ["Can MuxLayer replace CCR?", "No. CCR is a multi-agent control plane. MuxLayer routes model HTTP and keeps traces."],
      ],
    },
    zh: {
      title: "MuxLayer vs cc-switch vs CCR",
      description:
        "cc-switch 负责改客户端配置。CCR 是多 agent 控制面。MuxLayer 是本地协议网关：路由、日志、一键 apply/回滚。",
      eyebrow: "MuxLayer vs cc-switch / CCR",
      h1: "不是配置切换器，也不是多 agent 控制台。",
      summary:
        "只想在很多客户端之间换 API 入口，用 cc-switch。要管一堆 agent，用 CCR。客户端永远指向一个本地网关，需要协议转换、故障转移、成本和请求追踪，用 MuxLayer。",
      keywords:
        "MuxLayer vs cc-switch, MuxLayer vs CCR, Claude Code Router 对比, 本地 AI 网关对比",
      sections: [
        {
          heading: "各自是什么",
          body: "cc-switch 把供应商写进各客户端配置文件并来回切换。CCR（Claude Code Router 一类）挡在编程 agent 前面，当多 agent / 路由控制面。MuxLayer 是本地 HTTP 网关：Chat Completions、Anthropic Messages、Responses、Gemini 进同一个进程，映射、故障转移、预算、缓存和日志都在这里发生。",
        },
        {
          heading: "什么时候选 MuxLayer",
          body: "你希望 Codex、Claude Code、Gemini CLI、OpenCode、Kimi CLI、Grok Build、DeepSeek Harness 一直指向同一个本地入口。换供应商、模型映射、任务分流、排错都在 MuxLayer 里做。一键 apply/回滚是附带的，产品本身是网关，不是配置编辑器。",
        },
        {
          heading: "什么时候选另外两个",
          body: "如果你根本不需要代理、只改客户端文件再重启，cc-switch 就够。如果你的问题是编排很多 agent，而不是转协议、看 token 成本，CCR 更合适。MuxLayer 不去抄它们的客户端数量，也不做 agent 市场。",
        },
      ],
      faq: [
        ["MuxLayer 能替代 cc-switch 吗？", "只能替代「把客户端指到本地网关」这一段。它不会同步 cc-switch 认识的每一种客户端格式。"],
        ["MuxLayer 能替代 CCR 吗？", "不能。CCR 是多 agent 控制面。MuxLayer 路由模型 HTTP，并留下追踪。"],
      ],
    },
  },
  {
    slug: "muxlayer-vs-openrouter",
    en: {
      title: "MuxLayer vs OpenRouter: local gateway or hosted model router",
      description:
        "Compare MuxLayer and OpenRouter for local model routing, provider keys, request tracing, failover, and client configuration.",
      eyebrow: "MuxLayer vs OpenRouter",
      h1: "MuxLayer vs OpenRouter.",
      summary:
        "MuxLayer runs locally and manages your client request path. OpenRouter is a hosted model routing provider. You can use either one, or use MuxLayer to route a client to OpenRouter.",
      keywords:
        "MuxLayer vs OpenRouter, OpenRouter alternative, local AI gateway vs hosted router, AI model routing",
      sections: [
        {
          heading: "The short difference",
          body: "OpenRouter gives you a hosted entry to many models. MuxLayer gives your local AI apps a local entry, then lets you choose direct providers, OpenRouter, or failover routes.",
        },
        {
          heading: "Choose MuxLayer when",
          body: "You want local logs, reversible client configuration, direct provider keys, and the ability to keep one stable endpoint for AI apps on your machine.",
        },
        {
          heading: "Choose OpenRouter when",
          body: "You want a hosted provider marketplace and prefer one upstream account to access many models without managing direct provider configs locally.",
        },
      ],
      faq: [
        ["Does MuxLayer replace OpenRouter?", "No. MuxLayer can route to OpenRouter, direct providers, or both."],
        ["Which one owns my logs?", "MuxLayer stores request traces locally. OpenRouter is a hosted upstream provider when you choose to use it."],
      ],
    },
    zh: {
      title: "MuxLayer vs OpenRouter：本地网关还是托管模型路由",
      description:
        "对比 MuxLayer 和 OpenRouter 在本地模型路由、Provider key、请求追踪、故障转移和客户端配置上的差异。",
      eyebrow: "MuxLayer vs OpenRouter",
      h1: "MuxLayer vs OpenRouter。",
      summary:
        "MuxLayer 运行在本地，管理你的客户端请求链路；OpenRouter 是托管模型路由 Provider。两者可以二选一，也可以让 MuxLayer 把客户端请求路由到 OpenRouter。",
      keywords:
        "MuxLayer vs OpenRouter, OpenRouter 替代, 本地 AI 网关 vs 托管路由, AI 模型路由",
      sections: [
        {
          heading: "一句话区别",
          body: "OpenRouter 给你一个托管入口访问多种模型。MuxLayer 给本地 AI 应用一个本地入口，再由你选择直连 Provider、OpenRouter 或故障转移路线。",
        },
        {
          heading: "什么时候选 MuxLayer",
          body: "你想要本地日志、可恢复客户端配置、直接管理 Provider key，并让本机 AI 应用始终指向一个稳定入口。",
        },
        {
          heading: "什么时候选 OpenRouter",
          body: "你想用托管模型市场，并希望通过一个上游账号访问多种模型，而不是在本地管理多个 Provider 配置。",
        },
      ],
      faq: [
        ["MuxLayer 会替代 OpenRouter 吗？", "不会。MuxLayer 可以路由到 OpenRouter，也可以路由到直连 Provider。"],
        ["日志归谁管？", "MuxLayer 的请求追踪保存在本地；当你选择 OpenRouter 时，它是托管上游 Provider。"],
      ],
    },
  },
  {
    slug: "muxlayer-vs-direct-provider-config",
    en: {
      title: "MuxLayer vs direct provider config for AI apps",
      description:
        "Compare using MuxLayer with editing each AI app provider config directly. Learn when a local gateway is simpler and safer.",
      eyebrow: "Gateway vs direct config",
      h1: "MuxLayer vs direct provider config.",
      summary:
        "Direct provider config is fine for one app and one provider. MuxLayer is better when you switch providers, need request logs, want failover, or care about safe rollback.",
      keywords:
        "AI app provider config, local AI gateway vs direct config, MuxLayer comparison, model provider switching",
      sections: [
        {
          heading: "The short difference",
          body: "Direct config changes each client separately. MuxLayer keeps clients pointed at one local endpoint and moves provider decisions into one local dashboard.",
        },
        {
          heading: "Choose MuxLayer when",
          body: "You have multiple AI apps, multiple providers, cost tracking needs, or a workflow where breaking a client config would waste time.",
        },
        {
          heading: "Choose direct config when",
          body: "You only use one client with one provider and do not need request tracing, failover, local history, or quick rollback.",
        },
      ],
      faq: [
        ["Is direct config wrong?", "No. It is the simplest path for a single stable setup."],
        ["Why add a gateway?", "A gateway becomes useful when provider choice, logs, failover, and rollback matter."],
      ],
    },
    zh: {
      title: "MuxLayer vs 直接修改 AI 应用 Provider 配置",
      description:
        "对比使用 MuxLayer 和直接编辑每个 AI 应用 Provider 配置。了解什么时候本地网关更简单、更安全。",
      eyebrow: "网关 vs 直接配置",
      h1: "MuxLayer vs 直接修改 Provider 配置。",
      summary:
        "如果只有一个应用、一个 Provider，直接配置就够了；如果你经常切 Provider、需要请求日志、故障转移或安全回滚，MuxLayer 更合适。",
      keywords:
        "AI 应用 Provider 配置, 本地 AI 网关 vs 直接配置, MuxLayer 对比, 模型 Provider 切换",
      sections: [
        {
          heading: "一句话区别",
          body: "直接配置是分别修改每个客户端；MuxLayer 让客户端统一指向一个本地入口，把 Provider 决策集中到本地面板里。",
        },
        {
          heading: "什么时候选 MuxLayer",
          body: "你有多个 AI 应用、多个 Provider、成本统计需求，或者不希望客户端配置被改坏后浪费时间排查。",
        },
        {
          heading: "什么时候直接配置就够了",
          body: "你只用一个客户端和一个 Provider，并且不需要请求追踪、故障转移、本地历史或快速回滚。",
        },
      ],
      faq: [
        ["直接配置是错的吗？", "不是。单一稳定场景下，直接配置是最简单的路径。"],
        ["为什么还要加网关？", "当 Provider 选择、日志、故障转移和回滚变重要时，网关才有价值。"],
      ],
    },
  },
];

const legacyGuideSlugs = {
  "agentgate-vs-litellm": "muxlayer-vs-litellm",
  "agentgate-vs-openrouter": "muxlayer-vs-openrouter",
  "agentgate-vs-direct-provider-config": "muxlayer-vs-direct-provider-config",
  "use-gemini-cli-with-agentgate": "use-gemini-cli-with-muxlayer",
  "use-opencode-with-agentgate": "use-opencode-with-muxlayer",
};

// 完整教程页:正文来自 docs/<slug>.md 与 docs/<slug>-zh.md,标题和首段摘要从 md 提取。
// lastmod 手工同步 docs 文件的最后实质修改日期。
const docPages = [
  {
    slug: "use-codex-with-deepseek",
    published: "2026-06-13",
    lastmod: "2026-09-01",
    en: {
      eyebrow: "Codex + DeepSeek",
      navTitle: "Use Codex with DeepSeek",
      description:
        "Step-by-step guide: add DeepSeek in MuxLayer and route Codex Responses API requests locally, with model mapping, failover, request logs, cost tracking, and troubleshooting.",
      keywords:
        "Codex DeepSeek, use Codex with DeepSeek, Codex local gateway, OpenAI Responses API proxy, MuxLayer",
    },
    zh: {
      eyebrow: "Codex + DeepSeek",
      navTitle: "让 Codex 使用 DeepSeek",
      description:
        "手把手教程：在 MuxLayer 添加 DeepSeek，把 Codex 的 Responses API 请求在本地路由到 DeepSeek，含模型映射、故障转移、请求日志、成本统计和故障排查。",
      keywords:
        "Codex DeepSeek, Codex 使用 DeepSeek, Codex 本地网关, OpenAI Responses API 代理, MuxLayer",
    },
  },
  {
    slug: "use-claude-code-with-deepseek",
    published: "2026-06-13",
    lastmod: "2026-09-01",
    en: {
      eyebrow: "Claude Code + DeepSeek",
      navTitle: "Use Claude Code with DeepSeek",
      description:
        "Step-by-step guide: connect Claude Code to DeepSeek through MuxLayer with Anthropic-compatible pass-through or conversion, model mapping, request logs, and rollback.",
      keywords:
        "Claude Code DeepSeek, use Claude Code with DeepSeek, Claude Code proxy, Anthropic compatible gateway",
    },
    zh: {
      eyebrow: "Claude Code + DeepSeek",
      navTitle: "让 Claude Code 使用 DeepSeek",
      description:
        "手把手教程：用 MuxLayer 连接 Claude Code 和 DeepSeek，支持 Anthropic 兼容直连或协议转换、模型映射、请求日志和配置回滚。",
      keywords:
        "Claude Code DeepSeek, Claude Code 使用 DeepSeek, Claude Code 代理, Anthropic 兼容网关",
    },
  },
  {
    slug: "use-codex-with-mimo",
    published: "2026-06-13",
    lastmod: "2026-09-01",
    en: {
      eyebrow: "Codex + MiMo",
      navTitle: "Use Codex with Xiaomi MiMo",
      description:
        "Route Codex Responses API traffic to Xiaomi MiMo through MuxLayer: reasoning round-trip, web search handling, Open API and Token Plan keys, model mapping, troubleshooting.",
      keywords:
        "Codex MiMo, use Codex with Xiaomi MiMo, MiMo Codex proxy, mimo2codex alternative, MuxLayer",
    },
    zh: {
      eyebrow: "Codex + 小米 MiMo",
      navTitle: "让 Codex 使用小米 MiMo",
      description:
        "把 Codex 的 Responses API 请求通过 MuxLayer 路由到小米 MiMo：reasoning 保留、web search 处理、Open API / Token Plan Key 差异、模型映射和故障排查。",
      keywords:
        "Codex MiMo, Codex 使用小米 MiMo, Codex 接入 MiMo, mimo2codex 替代, MuxLayer",
    },
  },
  {
    slug: "use-claude-code-with-github-copilot",
    published: "2026-06-13",
    lastmod: "2026-06-13",
    en: {
      eyebrow: "Claude Code + Copilot",
      navTitle: "Use Claude Code with GitHub Copilot",
      description:
        "Route Claude Code requests to Claude models in a GitHub Copilot subscription through MuxLayer: token exchange, model normalization, limits, and terms-of-service notes.",
      keywords:
        "Claude Code GitHub Copilot, use Claude Code with Copilot, Copilot Claude models, MuxLayer",
    },
    zh: {
      eyebrow: "Claude Code + Copilot",
      navTitle: "用 GitHub Copilot 订阅跑 Claude Code",
      description:
        "通过 MuxLayer 把 Claude Code 请求路由到 GitHub Copilot 订阅里的 Claude 模型：token 交换、模型名归一、限制说明和服务条款注意事项。",
      keywords:
        "Claude Code Copilot, GitHub Copilot 跑 Claude Code, Copilot Claude 模型, MuxLayer",
    },
  },
  {
    slug: "use-gemini-cli-with-muxlayer",
    published: "2026-06-13",
    lastmod: "2026-09-01",
    en: {
      eyebrow: "Gemini CLI",
      navTitle: "Use Gemini CLI with MuxLayer",
      description:
        "Give Gemini CLI a local model entry with MuxLayer: route requests to multiple providers, trace them locally, and restore the official config in one click.",
      keywords:
        "Gemini CLI proxy, Gemini CLI local gateway, Gemini CLI multi provider, MuxLayer",
    },
    zh: {
      eyebrow: "Gemini CLI",
      navTitle: "让 Gemini CLI 使用多供应商模型",
      description:
        "用 MuxLayer 给 Gemini CLI 一个本地模型入口：请求路由到多个 Provider、本地追踪，并支持一键恢复官方配置。",
      keywords:
        "Gemini CLI 代理, Gemini CLI 本地网关, Gemini CLI 多供应商, MuxLayer",
    },
  },
  {
    slug: "use-opencode-with-muxlayer",
    published: "2026-06-13",
    lastmod: "2026-09-01",
    en: {
      eyebrow: "OpenCode",
      navTitle: "Use OpenCode with MuxLayer",
      description:
        "Point OpenCode at a local MuxLayer endpoint and switch providers freely, with model mapping, failover, diagnostics, request tracing, and cost tracking.",
      keywords:
        "OpenCode proxy, OpenCode local gateway, OpenCode provider switching, MuxLayer",
    },
    zh: {
      eyebrow: "OpenCode",
      navTitle: "让 OpenCode 切换多供应商模型",
      description:
        "让 OpenCode 指向 MuxLayer 本地入口，自由切换 Provider，含模型映射、故障转移、诊断、请求追踪和成本统计。",
      keywords:
        "OpenCode 代理, OpenCode 本地网关, OpenCode 切换供应商, MuxLayer",
    },
  },
  {
    slug: "use-codex-desktop-with-third-party-api-and-plugins",
    published: "2026-06-13",
    lastmod: "2026-06-13",
    en: {
      eyebrow: "Codex Desktop",
      navTitle: "Use Codex Desktop with third-party APIs and plugins",
      description:
        "Keep Codex Desktop plugins and account features working while routing model requests through MuxLayer to DeepSeek, MiMo, Kimi, GLM, and other providers.",
      keywords:
        "Codex Desktop third party API, Codex Desktop plugins proxy, Codex Desktop DeepSeek, MuxLayer",
    },
    zh: {
      eyebrow: "Codex Desktop",
      navTitle: "让 Codex Desktop 用第三方 API 并保留插件",
      description:
        "保留 Codex Desktop 插件和账号功能的同时，把模型请求经 MuxLayer 路由到 DeepSeek、小米 MiMo、Kimi、GLM 等第三方 Provider。",
      keywords:
        "Codex Desktop 第三方 API, Codex Desktop 插件代理, Codex Desktop DeepSeek, MuxLayer",
    },
  },
];

// 站内互链统一从这里取,完整教程排在前面
const navEntries = [
  ...docPages.map((page) => ({
    slug: page.slug,
    en: { eyebrow: page.en.eyebrow, title: page.en.navTitle },
    zh: { eyebrow: page.zh.eyebrow, title: page.zh.navTitle },
  })),
  ...pagePairs.map((pair) => ({
    slug: pair.slug,
    en: { eyebrow: pair.en.eyebrow, title: pair.en.title },
    zh: { eyebrow: pair.zh.eyebrow, title: pair.zh.title },
  })),
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderJson(value) {
  return JSON.stringify(value, null, 2).replaceAll("</", "<\\/");
}

function pageUrl(lang, slug) {
  return lang === "zh"
    ? `${baseUrl}/zh/guides/${slug}/`
    : `${baseUrl}/guides/${slug}/`;
}

function assetPrefix(lang) {
  return lang === "zh" ? "../../../" : "../../";
}

function homeHref(lang) {
  return lang === "zh" ? "../../" : "../../";
}

function oppositeHref(lang, slug) {
  return lang === "zh" ? `../../../guides/${slug}/` : `../../zh/guides/${slug}/`;
}

function relatedLinks(lang, currentSlug) {
  // 从当前页在列表中的位置起环形取 4 个,让内链分布到所有页面而不是永远前 4 个
  const idx = navEntries.findIndex((entry) => entry.slug === currentSlug);
  const others = navEntries.filter((entry) => entry.slug !== currentSlug);
  const start = idx === -1 ? 0 : idx % others.length;
  return [...others.slice(start), ...others.slice(0, start)]
    .slice(0, 4)
    .map((entry) => {
      const copy = entry[lang];
      const href =
        lang === "zh"
          ? `../../guides/${entry.slug}/`
          : `../${entry.slug}/`;
      return `<a class="hover-prompt block py-1 text-ink-soft hover:text-ink" href="${href}">${escapeHtml(copy.eyebrow)} <span class="text-faint">— ${escapeHtml(copy.title)}</span></a>`;
    })
    .join("\n");
}

function rewriteDocLinks(md) {
  // docs 里的相对链接改写成站内 / GitHub 绝对链接(先处理 -zh 后缀再处理其余 .md)
  return md
    .replaceAll(/\]\(\.\/([a-z0-9-]+?)-zh\.md\)/g, (_m, slug) => `](${baseUrl}/zh/guides/${slug}/)`)
    .replaceAll(/\]\(\.\/([a-z0-9-]+?)\.md\)/g, (_m, slug) => `](${baseUrl}/guides/${slug}/)`)
    .replaceAll("](../README.md)", `](${repoUrl})`)
    .replaceAll("](../README_ZH.md)", `](${repoUrl}/blob/main/README_ZH.md)`)
    .replaceAll("](../../releases)", `](${repoUrl}/releases)`);
}

async function loadDoc(page, lang) {
  const file = lang === "zh" ? `${page.slug}-zh.md` : `${page.slug}.md`;
  const raw = await readFile(path.join(docsDir, file), "utf8");
  const lines = raw.split("\n");
  if (!lines[0].startsWith("# ")) {
    throw new Error(`docs/${file}: expected first line to be an H1 title`);
  }
  const title = lines[0].slice(2).trim();
  let rest = lines.slice(1).join("\n").trim();
  // 语言切换链接由页头统一提供,去掉正文里的那行
  rest = rest.replace(/^(中文|English)[：:].*$/m, "").trim();
  const paraEnd = rest.indexOf("\n\n");
  if (paraEnd === -1) {
    throw new Error(`docs/${file}: expected an intro paragraph before sections`);
  }
  const summary = rest.slice(0, paraEnd).trim().replace(/\s*\n\s*/g, " ");
  const body = rest.slice(paraEnd).trim();
  const html = marked.parse(rewriteDocLinks(body), { async: false });
  return { title, summary, html };
}

function renderDocPage(page, lang, doc) {
  const copy = page[lang];
  const alternateLang = lang === "zh" ? "en" : "zh";
  const prefix = assetPrefix(lang);
  const canonical = pageUrl(lang, page.slug);
  const alternates = {
    en: pageUrl("en", page.slug),
    zh: pageUrl("zh", page.slug),
  };
  const zhClass = lang === "zh" ? "zh " : "";
  const articleJson = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: doc.title,
    description: copy.description,
    datePublished: page.published,
    dateModified: page.lastmod,
    author: {
      "@type": "Person",
      name: "dengmengmian",
      url: "https://github.com/dengmengmian",
    },
    publisher: {
      "@type": "Organization",
      name: "MuxLayer",
      url: baseUrl,
      logo: `${baseUrl}/assets/logo.svg`,
    },
    mainEntityOfPage: canonical,
  };

  return `<!doctype html>
<html lang="${lang === "zh" ? "zh-CN" : "en"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(doc.title)} | MuxLayer</title>
    <meta name="description" content="${escapeHtml(copy.description)}" />
    <meta name="keywords" content="${escapeHtml(copy.keywords)}" />
    <meta name="author" content="dengmengmian" />
    <link rel="canonical" href="${canonical}" />
    <link rel="alternate" hreflang="en" href="${alternates.en}" />
    <link rel="alternate" hreflang="zh-CN" href="${alternates.zh}" />
    <link rel="alternate" hreflang="x-default" href="${alternates.en}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="MuxLayer" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${escapeHtml(doc.title)}" />
    <meta property="og:description" content="${escapeHtml(copy.description)}" />
    <meta property="og:image" content="${baseUrl}/assets/demo-header.gif" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(doc.title)}" />
    <meta name="twitter:description" content="${escapeHtml(copy.description)}" />
    <meta name="twitter:image" content="${baseUrl}/assets/demo-header.gif" />
    <link rel="icon" type="image/svg+xml" href="${prefix}assets/logo.svg?v=2" />
    <link rel="icon" type="image/png" sizes="32x32" href="${prefix}assets/favicon-32.png" />
    <link rel="apple-touch-icon" href="${prefix}assets/apple-touch-icon.png" />
    <script type="application/ld+json">${renderJson(articleJson)}</script>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${prefix}assets/tailwind.css" />
    ${goatcounterSnippet}
  </head>
  <body class="bg-bg text-ink">
    <header class="border-b border-border-soft">
      <div class="mx-auto flex max-w-4xl items-center justify-between px-6 py-4 text-sm">
        <a href="${homeHref(lang)}" class="flex items-center gap-2 text-ink">
          <span class="text-amber">▲</span>
          <span class="font-medium">muxlayer</span>
        </a>
        <nav class="flex items-center gap-5 text-ink-soft">
          <a href="${releaseUrl}" class="hover:text-ink">${lang === "zh" ? "下载" : "download"} <span class="text-faint">↗</span></a>
          <a href="${repoUrl}" class="hover:text-ink">github <span class="text-faint">↗</span></a>
          <span class="text-faint">·</span>
          <a href="${oppositeHref(lang, page.slug)}" class="hover:text-ink">${alternateLang === "zh" ? "中文" : "English"}</a>
        </nav>
      </div>
    </header>

    <main>
      <section class="relative overflow-hidden border-b border-border-soft">
        <div class="absolute inset-0 grid-bg opacity-50"></div>
        <div class="relative mx-auto max-w-4xl px-6 pt-20 pb-16">
          <div class="prompt text-sm text-ink-soft">muxlayer guides/${escapeHtml(page.slug)}</div>
          <p class="mt-6 text-xs uppercase tracking-wider text-amber">${escapeHtml(copy.eyebrow)}</p>
          <h1 class="${zhClass}h-display mt-5 text-ink">${escapeHtml(doc.title)}</h1>
          <p class="${zhClass}mt-8 max-w-2xl text-base leading-relaxed text-ink-soft">${escapeHtml(doc.summary)}</p>
          <div class="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <a href="${releaseUrl}" class="inline-flex items-center gap-2 rounded border border-amber bg-amber/10 px-4 py-2 font-medium text-amber transition-colors hover:bg-amber hover:text-bg">
              <span>▸</span>
              <span>${lang === "zh" ? "下载 MuxLayer" : "Download MuxLayer"}</span>
            </a>
            <a href="${repoUrl}" class="hover-prompt text-ink-soft hover:text-ink">dengmengmian/muxlayer <span class="text-faint">↗</span></a>
          </div>
        </div>
      </section>

      <section class="border-b border-border-soft bg-bg-soft/40">
        <div class="mx-auto max-w-4xl px-6 py-16">
          <article class="${zhClass}doc-body">
${doc.html}
          </article>
        </div>
      </section>

      <section class="bg-bg-soft/40">
        <div class="mx-auto max-w-4xl px-6 py-16">
          <div class="prompt text-sm text-ink-soft">muxlayer --related</div>
          <h2 class="${zhClass}mt-4 text-xl font-medium">${lang === "zh" ? "继续看。" : "Keep reading."}</h2>
          <div class="mt-8 space-y-3 text-sm">
            ${relatedLinks(lang, page.slug)}
          </div>
        </div>
      </section>
    </main>

    <footer class="border-t border-border-soft">
      <div class="mx-auto flex max-w-4xl flex-col items-start justify-between gap-3 px-6 py-8 text-sm sm:flex-row sm:items-center">
        <div class="flex flex-wrap items-center gap-2 text-ink-soft">
          <span>${lang === "zh" ? "本地 AI 模型网关" : "local AI model gateway"}</span>
          <span class="text-faint">·</span>
          <span class="text-muted">MIT</span>
        </div>
        <nav class="flex items-center gap-5 text-ink-soft">
          <a class="hover:text-ink" href="${repoUrl}">dengmengmian/muxlayer</a>
        </nav>
      </div>
    </footer>
  </body>
</html>
`;
}

function answerText(copy, lang) {
  return lang === "zh" ? `简短答案：${copy.summary}` : `Short answer: ${copy.summary}`;
}

function useBoundaries(slug, lang) {
  const isComparison = slug.startsWith("muxlayer-vs-");
  if (lang === "zh") {
    return {
      use: isComparison
        ? [
            "你需要判断 MuxLayer 和另一种方案的边界。",
            "你在本地 AI 应用、Provider 路由和请求追踪之间做选择。",
            "你想知道什么时候该用本地网关，什么时候不该用。",
          ]
        : [
            "你想让 AI 应用保持一个稳定的本地入口。",
            "你需要切换 Provider、查看请求日志或统计成本。",
            "你希望客户端配置可以安全恢复。",
          ],
      avoid: isComparison
        ? [
            "你已经确定只使用一种方案，不需要对比取舍。",
            "你只想看完整 API 参考，而不是选择建议。",
          ]
        : [
            "你只用一个客户端、一个 Provider，且配置长期不变。",
            "你不需要日志、故障转移、成本统计或配置回滚。",
          ],
    };
  }

  return {
    use: isComparison
      ? [
          "You need to decide where MuxLayer fits compared with another option.",
          "You are choosing between local AI app routing, hosted routing, or direct provider config.",
          "You want clear trade-offs instead of a feature list.",
        ]
      : [
          "You want AI apps to keep one stable local endpoint.",
          "You need provider switching, request logs, cost visibility, or failover.",
          "You want client config changes to be reversible.",
        ],
    avoid: isComparison
      ? [
          "You already know which tool you will use and only need API reference.",
          "You do not need local client workflow or provider-routing trade-offs.",
        ]
      : [
          "You use one client, one provider, and the setup rarely changes.",
          "You do not need logs, failover, cost tracking, or config rollback.",
        ],
  };
}

function renderList(items) {
  return items
    .map((item) => `<li class="leading-relaxed text-ink-soft">${escapeHtml(item)}</li>`)
    .join("\n");
}

function renderPage(pair, lang) {
  const copy = pair[lang];
  const boundaries = useBoundaries(pair.slug, lang);
  const alternateLang = lang === "zh" ? "en" : "zh";
  const prefix = assetPrefix(lang);
  const canonical = pageUrl(lang, pair.slug);
  const alternates = {
    en: pageUrl("en", pair.slug),
    zh: pageUrl("zh", pair.slug),
  };
  const faqJson = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: copy.faq.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: {
        "@type": "Answer",
        text: answer,
      },
    })),
  };
  const articleJson = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: copy.title,
    description: copy.description,
    datePublished: thinPageDates.published,
    dateModified: thinPageDates.modified,
    author: {
      "@type": "Person",
      name: "dengmengmian",
      url: "https://github.com/dengmengmian",
    },
    publisher: {
      "@type": "Organization",
      name: "MuxLayer",
      url: baseUrl,
      logo: `${baseUrl}/assets/logo.svg`,
    },
    mainEntityOfPage: canonical,
  };

  return `<!doctype html>
<html lang="${lang === "zh" ? "zh-CN" : "en"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(copy.title)} | MuxLayer</title>
    <meta name="description" content="${escapeHtml(copy.description)}" />
    <meta name="keywords" content="${escapeHtml(copy.keywords)}" />
    <meta name="author" content="dengmengmian" />
    <link rel="canonical" href="${canonical}" />
    <link rel="alternate" hreflang="en" href="${alternates.en}" />
    <link rel="alternate" hreflang="zh-CN" href="${alternates.zh}" />
    <link rel="alternate" hreflang="x-default" href="${alternates.en}" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="MuxLayer" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:title" content="${escapeHtml(copy.title)}" />
    <meta property="og:description" content="${escapeHtml(copy.description)}" />
    <meta property="og:image" content="${baseUrl}/assets/demo-header.gif" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(copy.title)}" />
    <meta name="twitter:description" content="${escapeHtml(copy.description)}" />
    <meta name="twitter:image" content="${baseUrl}/assets/demo-header.gif" />
    <link rel="icon" type="image/svg+xml" href="${prefix}assets/logo.svg?v=2" />
    <link rel="icon" type="image/png" sizes="32x32" href="${prefix}assets/favicon-32.png" />
    <link rel="apple-touch-icon" href="${prefix}assets/apple-touch-icon.png" />
    <script type="application/ld+json">${renderJson(articleJson)}</script>
    <script type="application/ld+json">${renderJson(faqJson)}</script>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${prefix}assets/tailwind.css" />
    ${goatcounterSnippet}
  </head>
  <body class="bg-bg text-ink">
    <header class="border-b border-border-soft">
      <div class="mx-auto flex max-w-4xl items-center justify-between px-6 py-4 text-sm">
        <a href="${homeHref(lang)}" class="flex items-center gap-2 text-ink">
          <span class="text-amber">▲</span>
          <span class="font-medium">muxlayer</span>
        </a>
        <nav class="flex items-center gap-5 text-ink-soft">
          <a href="${releaseUrl}" class="hover:text-ink">${lang === "zh" ? "下载" : "download"} <span class="text-faint">↗</span></a>
          <a href="${repoUrl}" class="hover:text-ink">github <span class="text-faint">↗</span></a>
          <span class="text-faint">·</span>
          <a href="${oppositeHref(lang, pair.slug)}" class="hover:text-ink">${alternateLang === "zh" ? "中文" : "English"}</a>
        </nav>
      </div>
    </header>

    <main>
      <section class="relative overflow-hidden border-b border-border-soft">
        <div class="absolute inset-0 grid-bg opacity-50"></div>
        <div class="relative mx-auto max-w-4xl px-6 pt-20 pb-16">
          <div class="prompt text-sm text-ink-soft">muxlayer guides/${escapeHtml(pair.slug)}</div>
          <p class="mt-6 text-xs uppercase tracking-wider text-amber">${escapeHtml(copy.eyebrow)}</p>
          <h1 class="${lang === "zh" ? "zh " : ""}h-display mt-5 text-ink">${escapeHtml(copy.h1)}</h1>
          <p class="${lang === "zh" ? "zh " : ""}mt-8 max-w-2xl text-base leading-relaxed text-ink-soft">${escapeHtml(copy.summary)}</p>
          <div class="mt-8 max-w-2xl border-l-2 border-amber/50 pl-4">
            <div class="text-xs uppercase tracking-wider text-amber">${lang === "zh" ? "直接答案" : "direct answer"}</div>
            <p class="${lang === "zh" ? "zh " : ""}mt-3 text-base leading-relaxed text-ink">${escapeHtml(answerText(copy, lang))}</p>
          </div>
          <div class="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
            <a href="${releaseUrl}" class="inline-flex items-center gap-2 rounded border border-amber bg-amber/10 px-4 py-2 font-medium text-amber transition-colors hover:bg-amber hover:text-bg">
              <span>▸</span>
              <span>${lang === "zh" ? "下载 MuxLayer" : "Download MuxLayer"}</span>
            </a>
            <a href="${repoUrl}" class="hover-prompt text-ink-soft hover:text-ink">dengmengmian/muxlayer <span class="text-faint">↗</span></a>
          </div>
        </div>
      </section>

      <section class="border-b border-border-soft bg-bg-soft/40">
        <div class="mx-auto grid max-w-4xl gap-8 px-6 py-16 md:grid-cols-[1fr_260px]">
          <article class="space-y-8">
            <section class="frame rounded p-6">
              <h2 class="${lang === "zh" ? "zh " : ""}text-xl font-medium text-ink">${lang === "zh" ? "适合场景" : "Best fit"}</h2>
              <ul class="${lang === "zh" ? "zh " : ""}mt-4 list-disc space-y-2 pl-5">
                ${renderList(boundaries.use)}
              </ul>
            </section>
            <section class="frame rounded p-6">
              <h2 class="${lang === "zh" ? "zh " : ""}text-xl font-medium text-ink">${lang === "zh" ? "不适合场景" : "Not ideal"}</h2>
              <ul class="${lang === "zh" ? "zh " : ""}mt-4 list-disc space-y-2 pl-5">
                ${renderList(boundaries.avoid)}
              </ul>
            </section>
            ${copy.sections
              .map(
                (section) => `<section class="frame rounded p-6">
              <h2 class="${lang === "zh" ? "zh " : ""}text-xl font-medium text-ink">${escapeHtml(section.heading)}</h2>
              <p class="${lang === "zh" ? "zh " : ""}mt-4 leading-relaxed text-ink-soft">${escapeHtml(section.body)}</p>
            </section>`,
              )
              .join("\n")}
          </article>

          <aside class="space-y-4 text-sm">
            <div class="frame rounded p-5">
              <div class="text-xs uppercase tracking-wider text-amber">${lang === "zh" ? "适合搜索" : "search intent"}</div>
              <p class="${lang === "zh" ? "zh " : ""}mt-3 text-ink-soft">${escapeHtml(copy.description)}</p>
            </div>
            <div class="frame rounded p-5">
              <div class="text-xs uppercase tracking-wider text-amber">${lang === "zh" ? "快速入口" : "quick links"}</div>
              <div class="mt-3 space-y-2">
                <a class="hover-prompt block text-ink-soft hover:text-ink" href="${releaseUrl}">${lang === "zh" ? "下载最新版" : "Latest release"} <span class="text-faint">↗</span></a>
                <a class="hover-prompt block text-ink-soft hover:text-ink" href="${repoUrl}">GitHub <span class="text-faint">↗</span></a>
                <a class="hover-prompt block text-ink-soft hover:text-ink" href="${homeHref(lang)}">${lang === "zh" ? "回到首页" : "Home"}</a>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section class="border-b border-border-soft">
        <div class="mx-auto max-w-4xl px-6 py-16">
          <div class="prompt text-sm text-ink-soft">muxlayer --faq</div>
          <h2 class="${lang === "zh" ? "zh " : ""}h-section mt-4">${lang === "zh" ? "常见问题。" : "FAQ."}</h2>
          <div class="mt-10 space-y-4">
            ${copy.faq
              .map(
                ([question, answer]) => `<details class="frame rounded p-5">
              <summary class="${lang === "zh" ? "zh " : ""}cursor-pointer text-ink">${escapeHtml(question)}</summary>
              <p class="${lang === "zh" ? "zh " : ""}mt-3 leading-relaxed text-ink-soft">${escapeHtml(answer)}</p>
            </details>`,
              )
              .join("\n")}
          </div>
        </div>
      </section>

      <section class="bg-bg-soft/40">
        <div class="mx-auto max-w-4xl px-6 py-16">
          <div class="prompt text-sm text-ink-soft">muxlayer --related</div>
          <h2 class="${lang === "zh" ? "zh " : ""}mt-4 text-xl font-medium">${lang === "zh" ? "继续看。" : "Keep reading."}</h2>
          <div class="mt-8 space-y-3 text-sm">
            ${relatedLinks(lang, pair.slug)}
          </div>
        </div>
      </section>
    </main>

    <footer class="border-t border-border-soft">
      <div class="mx-auto flex max-w-4xl flex-col items-start justify-between gap-3 px-6 py-8 text-sm sm:flex-row sm:items-center">
        <div class="flex flex-wrap items-center gap-2 text-ink-soft">
          <span>${lang === "zh" ? "本地 AI 模型网关" : "local AI model gateway"}</span>
          <span class="text-faint">·</span>
          <span class="text-muted">MIT</span>
        </div>
        <nav class="flex items-center gap-5 text-ink-soft">
          <a class="hover:text-ink" href="${repoUrl}">dengmengmian/muxlayer</a>
        </nav>
      </div>
    </footer>
  </body>
</html>
`;
}

function renderSitemap() {
  const guidePair = (slug, lastmod) => [
    {
      loc: pageUrl("en", slug),
      priority: "0.8",
      lastmod,
      en: pageUrl("en", slug),
      zh: pageUrl("zh", slug),
      defaultUrl: pageUrl("en", slug),
    },
    {
      loc: pageUrl("zh", slug),
      priority: "0.8",
      lastmod,
      en: pageUrl("en", slug),
      zh: pageUrl("zh", slug),
      defaultUrl: pageUrl("en", slug),
    },
  ];
  const urls = [
    {
      loc: `${baseUrl}/`,
      priority: "1.0",
      lastmod: thinPageDates.modified,
      en: `${baseUrl}/`,
      zh: `${baseUrl}/zh/`,
      defaultUrl: `${baseUrl}/`,
    },
    {
      loc: `${baseUrl}/zh/`,
      priority: "1.0",
      lastmod: thinPageDates.modified,
      en: `${baseUrl}/`,
      zh: `${baseUrl}/zh/`,
      defaultUrl: `${baseUrl}/`,
    },
    ...docPages.flatMap((page) => guidePair(page.slug, page.lastmod)),
    ...pagePairs.flatMap((pair) => guidePair(pair.slug, thinPageDates.modified)),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls
  .map(
    (url) => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${url.priority}</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${url.en}" />
    <xhtml:link rel="alternate" hreflang="zh-CN" href="${url.zh}" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${url.defaultUrl}" />
  </url>`,
  )
  .join("\n")}
</urlset>
`;
}

function renderLegacyRedirect(lang, oldSlug, newSlug) {
  const destination = pageUrl(lang, newSlug);
  return `<!doctype html>
<html lang="${lang === "zh" ? "zh-CN" : "en"}">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0; url=${destination}" />
    <link rel="canonical" href="${destination}" />
    <title>MuxLayer guide moved</title>
    <script>window.location.replace(${JSON.stringify(destination)});</script>
  </head>
  <body>
    <p>This AgentGate guide moved to <a href="${destination}">${destination}</a>.</p>
  </body>
</html>
`;
}

async function main() {
  for (const pair of pagePairs) {
    const enDir = path.join(siteDir, "guides", pair.slug);
    const zhDir = path.join(siteDir, "zh", "guides", pair.slug);
    await mkdir(enDir, { recursive: true });
    await mkdir(zhDir, { recursive: true });
    await writeFile(path.join(enDir, "index.html"), renderPage(pair, "en"));
    await writeFile(path.join(zhDir, "index.html"), renderPage(pair, "zh"));
  }

  for (const page of docPages) {
    const enDir = path.join(siteDir, "guides", page.slug);
    const zhDir = path.join(siteDir, "zh", "guides", page.slug);
    await mkdir(enDir, { recursive: true });
    await mkdir(zhDir, { recursive: true });
    await writeFile(
      path.join(enDir, "index.html"),
      renderDocPage(page, "en", await loadDoc(page, "en")),
    );
    await writeFile(
      path.join(zhDir, "index.html"),
      renderDocPage(page, "zh", await loadDoc(page, "zh")),
    );
  }

  for (const [oldSlug, newSlug] of Object.entries(legacyGuideSlugs)) {
    for (const lang of ["en", "zh"]) {
      const legacyDir = lang === "zh"
        ? path.join(siteDir, "zh", "guides", oldSlug)
        : path.join(siteDir, "guides", oldSlug);
      await mkdir(legacyDir, { recursive: true });
      await writeFile(path.join(legacyDir, "index.html"), renderLegacyRedirect(lang, oldSlug, newSlug));
    }
  }

  await writeFile(path.join(siteDir, "sitemap.xml"), renderSitemap());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
