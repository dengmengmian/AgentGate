# MuxLayer 品牌迁移方案

## 已确定的品牌

- 品牌名：MuxLayer
- GitHub 仓库：`dengmengmian/muxlayer`
- 产品定位：The local model control layer for coding agents.
- 中文定位：Coding Agent 的本地模型控制层。
- 对外描述：MuxLayer sits between your coding agents and AI model providers. Route, convert, fail over, and trace model requests locally.
- 旧品牌提示：`MuxLayer — formerly AgentGate`

## 第一阶段：对外品牌迁移（已完成）

第一阶段只改变用户看到和搜索到的品牌，不改变已有用户依赖的运行时标识。

| 范围 | 处理结果 |
|---|---|
| GitHub 仓库 | `agentgate-ai` 已改为 `muxlayer`，旧 GitHub 地址由 GitHub 保留重定向 |
| GitHub Description / Topics | 描述切换到 MuxLayer；Topics 以新关键词为主，同时保留 `agentgate` 作为旧品牌搜索别名 |
| README / 中文 README | 首屏改为新定位，并保留 `MuxLayer — formerly AgentGate` |
| Logo / 应用窗口标题 | 对外文案和窗口标题使用 MuxLayer；现有图形 Logo 不变 |
| 官网 / SEO / 文档标题 | 使用 MuxLayer，保留旧 URL slug 以避免搜索和外链失效 |
| Release / 下载链接 | 指向新仓库；现有 release asset 文件名暂时保持不变 |
| 文章与指南 | 新品牌统一使用 MuxLayer；技术命令和配置名保持原样 |

## 第二阶段：技术标识迁移

### 2A：兼容优先的自动接管（已完成）

这一小步先保证“安装新版本后能继续用”，不急着搬动正在使用的文件：

- 桌面端继续使用 `com.mengmian.agentgate` 作为 bundle ID 和 updater identity。这样旧版安装可以直接被新版本覆盖，Tauri 现有应用数据目录、数据库和 token 不变。
- CLI 新安装默认使用 `~/.muxlayer`。
- 如果检测到旧用户的 `~/.agentgate/agentgate.db` 或 `~/.agentgate/token`，新版本自动继续使用旧目录，不创建第二套数据。
- CLI 支持 `MUXLAYER_DB_PATH`、`MUXLAYER_TOKEN`；`AGENTGATE_DB_PATH`、`AGENTGATE_TOKEN` 继续作为兼容别名，旧环境变量优先级不高于新变量。
- 旧目录只读接管，不删除、不移动、不覆盖。这样升级中断或回滚时，旧版本仍能启动。

这不是一次物理搬家，而是一次无感的 lazy migration：用户先自动接上原数据，等新旧版本共存和回滚路径验证完，再在后续版本做可回滚的目录复制。

### 2B：物理目录与命名迁移（后续实施）

以下标识不能直接全局替换，需要兼容读取、迁移提示和回滚方案：

- `agentgate-serve` CLI 命令
- `~/.agentgate` 配置目录、token 和数据库路径
- `AGENTGATE_*` 环境变量
- `com.mengmian.agentgate` bundle ID 和 updater identifier
- Tauri `productName`、安装包默认文件名和应用 bundle 显示名
- Homebrew cask `agentgate` 及 tap 路径
- 现有 `AgentGate_<version>_*` 安装包文件名
- 虚拟模型名：新写入用 `muxlayer` / `openai/muxlayer`，长期保留 `agentgate` / `openai/agentgate` 别名
- 数据库、日志、Docker image 和 release automation 中的旧标识

第二阶段后续的最低兼容要求：

1. 新版本继续读取旧目录、旧环境变量和旧配置格式。
2. 首次启动时只做可回滚的复制或迁移，不删除旧数据。
3. 旧 CLI、旧 Homebrew cask 和旧下载链接至少保留一个完整发布周期。
4. updater 同时覆盖旧安装和新安装，验证 macOS、Windows、Linux 三个平台后再切换默认命名。
5. 虚拟模型名和 API 字段属于协议兼容面，长期保留 `agentgate` 别名。

## 验收口径

- 对外页面和当前文档不再把 AgentGate 当作主品牌。
- `AgentGate` 只出现在迁移说明、历史 release notes、现有安装包名和兼容标识中。
- `agentgate-serve`、`~/.agentgate`、`AGENTGATE_*`、bundle ID、Homebrew cask 没有被误改；虚拟模型新写入用 `muxlayer`，`agentgate` 仍是别名。CLI 数据目录和 token 已增加新名称入口，但旧入口仍可用。
- README、官网、SEO 页面、Release 链接和 GitHub 元数据使用 `muxlayer`。
