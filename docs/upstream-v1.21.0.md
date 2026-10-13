# 跟进上游 v1.21.0

从 `1.20.2+collie.1` 跟进到 `1.21.0+collie.1`，保留现有 Collie 定制。

已交叉核对 [官方发布说明](https://github.com/AltanS/collie/releases/tag/v1.21.0)、
[CHANGELOG](https://github.com/AltanS/collie/blob/v1.21.0/CHANGELOG.md#1210---2026-10-13)
和 [完整标签差异](https://github.com/AltanS/collie/compare/v1.20.2...v1.21.0)。
上游标签 `b55b9d2f`，范围包含 92 个提交、356 个文件。

## 上游变化

本版新增实验性 durable 智能体接入与 Chat 问题固定栏，并更新多个终端适配器。

| 范围 | 变化和用户影响 | 依据 |
| --- | --- | --- |
| 无终端智能体 | `COLLIE_MUX=durable` 将外部程序的工作区和会话接入 crew。会话只显示 Chat，使用独立输入框，没有 Terminal、按键栏或新 tab；程序提供的 starters 显示在 New 页面。当前本机继续使用 Herdr，未启用新后端。 | [c396b964](https://github.com/AltanS/collie/commit/c396b964)、[e4c19a26](https://github.com/AltanS/collie/commit/e4c19a26)、[bfc8b62e](https://github.com/AltanS/collie/commit/bfc8b62e) |
| durable 问答与发送 | 程序以结构化数据提供问题卡片；用户点击才回答。答案、发送和停止携带问题／轮次 ID、请求 ID 和回执，拒绝过期操作、限制重复执行。短暂读取失败保留已有问题；通知按问题去重并设频率限制。 | [ff1c7500](https://github.com/AltanS/collie/commit/ff1c7500)、[e94c43dc](https://github.com/AltanS/collie/commit/e94c43dc)、[ff2c9674](https://github.com/AltanS/collie/commit/ff2c9674) |
| durable 历史 | Bridge 自己保存会话日志，程序重启或关闭会话后日志仍在；已关闭会话不作为虚假活动项保留在面板列表。对日志、回执和问题状态实施大小与保留边界。 | [1a3668d2](https://github.com/AltanS/collie/commit/1a3668d2)、[16520f8b](https://github.com/AltanS/collie/commit/16520f8b) |
| 私有 socket 与 HTTPS | 可配置 `COLLIE_DURABLE_SOCKET`，或 `COLLIE_DURABLE_URL` 与至少 32 字节的 token。socket 校验路径、权限和符号链接；URL 默认要求 HTTPS，仅回环开发地址可用 HTTP。凭据被拒绝时明确提示原因，token 不写入日志。Windows 使用 URL 模式。HTTPS 有人查看时每 2 秒轮询，空闲时每 10 秒，空闲一天约 8,640 次请求。 | [f948b19a](https://github.com/AltanS/collie/commit/f948b19a)、[507bcc50](https://github.com/AltanS/collie/commit/507bcc50)、[ADR 0103](../.adr/0103-the-wire-has-two-transports-a-private-socket-or-tls-with-a-token.md) |
| durable 诊断及兼容性 | `collie doctor` 新增七项检查，说明连接、权限、认证和就绪状态；旧 lead 无问答卡片时发出警告。协议为实验性，minor 版本允许变化；新增 crew 可选数据字段及转发规则。 | [a53486a7](https://github.com/AltanS/collie/commit/a53486a7)、[4c5c9c01](https://github.com/AltanS/collie/commit/4c5c9c01)、[WIRE](../bridge/mux/durable/WIRE.md) |
| 示例程序 | 新增本机 Pi Durable 和 Cloudflare Durable Object 两个独立示例，使用无 API key 的脚本模型；示例 SDK 区分通用核心与 Bun socket 服务，包含 token 轮换、重启恢复、超时和回执边界检查。普通 Collie 安装不会安装 Pi Durable。 | [55033838](https://github.com/AltanS/collie/commit/55033838)、[0ceee4b8](https://github.com/AltanS/collie/commit/0ceee4b8)、[5262856f](https://github.com/AltanS/collie/commit/5262856f) |
| Chat 固定问题 | 浏览长回复时，顶部用两行固定其对应的问题，点击可跳回；问题不在当前页时按需读取较早记录。缓存窗口同时返回当前问题信息，跳转受用户滚动取消和读取页数上限约束。 | [#406](https://github.com/AltanS/collie/pull/406)、[e300dfe9](https://github.com/AltanS/collie/commit/e300dfe9)、[ff2601cf](https://github.com/AltanS/collie/commit/ff2601cf) |
| New 启动选项 | Grok 新增始终批准、继续上次；Antigravity 新增跳过权限、Plan 模式及继续上次。选项由用户主动选择，启动命令预览同步变化。 | [#430](https://github.com/AltanS/collie/pull/430)、[2f246020](https://github.com/AltanS/collie/commit/2f246020) |
| 中文／日文表格 | 按终端列宽匹配表格边框；双宽字符占两列，带 VS16 的 emoji 也按两列计算。表格整体横向滚动，减少窄屏边框错位；仅表格内部固定双宽字符占位。 | [#417](https://github.com/AltanS/collie/pull/417)、[f43882ac](https://github.com/AltanS/collie/commit/f43882ac)、[97a53bd7](https://github.com/AltanS/collie/commit/97a53bd7)、[144fdbfb](https://github.com/AltanS/collie/commit/144fdbfb) |
| Claude Code | 40 列下问答底部提示折为两行也能识别，恢复单选、多选和向导按钮，命名会话同样适用。历史读取的上游验证版本升至 2.1.296。 | [#422](https://github.com/AltanS/collie/issues/422)、[1ce29b62](https://github.com/AltanS/collie/commit/1ce29b62)、[5799b803](https://github.com/AltanS/collie/commit/5799b803) |
| Muse 1.4.7 卡片 | 支持新的选择指针、审批提示和多问题进度行，恢复审批、信任、单选、多选和复核界面。 | [#424](https://github.com/AltanS/collie/pull/424)、[3a5bceb9](https://github.com/AltanS/collie/commit/3a5bceb9) |
| Muse 会话归属 | 从面板前台进程的命令行解析 session，同目录的两个 Muse tab 不再错误共用最新日志。 | [#423](https://github.com/AltanS/collie/pull/423)、[5c672cdb](https://github.com/AltanS/collie/commit/5c672cdb) |
| Oh My Pi 历史 | `model_usage` 和 `service_tier_change` 作为已知元数据处理，不显示也不误报；OmO 的回答从 `details.answers` 读取，终端完成作答后 Chat 也显示答案。 | [#425](https://github.com/AltanS/collie/pull/425)、[#426](https://github.com/AltanS/collie/pull/426)、[6587040f](https://github.com/AltanS/collie/commit/6587040f) |
| Oh My Pi 18.10 问答 | 兼容新增 hide 提示、批量单选题、复核页和展开状态，恢复 Ask 卡片；保留各状态的发送保护和捕获样本。 | [#427](https://github.com/AltanS/collie/pull/427)、[2d2efa42](https://github.com/AltanS/collie/commit/2d2efa42) |
| OmO 侧栏问答 | 校验问题所在列范围，侧栏时钟变化不再使选项点击失效，问题变化仍拒绝发送。新增可选 `expected_columns`；旧 bridge 会忽略该字段并拒绝点击，需前后端一起更新。 | [5325d859](https://github.com/AltanS/collie/commit/5325d859)、[#412](https://github.com/AltanS/collie/issues/412) |
| OpenClaw 历史 | 从 TUI footer 提取 session 并只读查询本机 SQLite，Chat／History 支持消息、工具和 ask_user 答案。支持默认目录、`OPENCLAW_STATE_DIR` 或 `COLLIE_OPENCLAW_ROOT`；面板必须报告 openclaw 身份，不读取 gateway token 或配置。 | [#401](https://github.com/AltanS/collie/issues/401)、[04710e74](https://github.com/AltanS/collie/commit/04710e74) |
| canary 与 mux 工具 | 新增 Grok、Hermes、Antigravity、OMP、Muse 探针，必须显式选择才运行；`--via` 支持启动器目录，不能用其 PATH 版本冒充已验证版本。新增临时 tmux／zellij／tuios 端到端验证脚本。 | [#428](https://github.com/AltanS/collie/pull/428)、[#429](https://github.com/AltanS/collie/pull/429)、[0182878c](https://github.com/AltanS/collie/commit/0182878c)、[691b11b8](https://github.com/AltanS/collie/commit/691b11b8) |
| 文档、翻译、构建 | 增加 ADR 0099–0103、durable 协议与部署说明、配置示例和 mux 合同；新增并润色多语言 durable 文案。独立 examples 使用自己的依赖、锁文件和检查，lint／提交钩子排除示例；Windows 测试预算同步。AUR／Nix 源跟进上游 1.20.2 的哈希，主程序没有新增依赖。 | [d071ca98](https://github.com/AltanS/collie/commit/d071ca98)、[f296a23f](https://github.com/AltanS/collie/commit/f296a23f)、[a140027d](https://github.com/AltanS/collie/commit/a140027d) |

## 本地实现取舍

没有独立下游功能被删除或替换；兼容部分合并到现有实现。

| 保留项 | 处理和原因 |
| --- | --- |
| Codex／Claude 卡片 | 保留 Model、Resume、Agents、Settings、Plan／Review、审批、Warning 数量及操作保护。Claude 窄屏 footer 修复与本地卡片共存，Settings 继续固定高度滚动正文。 |
| Hermes／Cursor 历史 | 保留 Hermes 中文历史、提示栏和身份识别，以及 Cursor 历史适配；注册表同时增加上游 OpenClaw 和可选 durable，不丢掉已有适配器。 |
| 原生镜像与紧凑布局 | 中文表格双宽占位与本地换行合并、搜索高亮并存。继续保留 tab 智能体图标、字体／显示设置、紧凑操作带和 PWA 视口修复，Keys 继续采用上游实现。 |
| 通知已读 | 上游新增 durable 问答通知保护，同时保留由 peer 已读时间清除通知的本地修复。 |
| 经济型验证 | 保留 cards、截图和完整基线才能写入验证台账的要求；新增 options 检查不降低认证门槛。截图工具复用上游扩展后的 agent 清单，支持新增探针的回放；不启用每小时任务。 |
| 交付 | 采用 `+collie.N`、main 和注释标签，不创建 GitHub Release、不恢复 Actions，只重启 Collie。Windows 工作流检查继续按既定下游政策剔除。 |

## 验证记录

针对变更范围运行解析、组件、API 和临时传输测试，并保存窄屏证据。

- Harness 81 个文件通过：23,999 项通过，32 项预期失败、79 项已有待办。
- 前端受影响的 20 个组件／逻辑文件通过，共 1,000 项；包含 Chat 问题固定、按需回溯、durable 问答与输入框、双宽表格等。
- 后端覆盖 journal、crew、发送绑定、durable socket／HTTP 传输和 API。macOS 默认临时路径经 `/var` 符号链接，安全校验按设计拒绝；改用 `TMPDIR=/private/tmp` 后相关测试通过。计数断言同步保留 Cursor 并新增 OpenClaw。
- 64 项适配目录回放全部通过；更新 Claude 40 列、Muse 1.4.7、OMP 18.10 和 OmO 列范围样本。durable 使用结构化数据，其验证来自专属卡片、API 和协议测试，不伪造 ANSI 捕获。
- 根目录／web 类型检查和全树 lint 通过；发布构建、浏览器检查与本地／Tailnet 构建读回在交付时完成。
- 未重新调用模型、操作用户会话、部署 durable 示例或启用新的外部服务；上游捕获回放不等于本机 CLI 实测。没有发布 Windows 二进制或运行 Windows VM 演练。
