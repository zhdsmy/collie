# v1.22.3 合并记录

本次从 `1.22.1+collie.4` 跟进到 `1.22.3+collie.1`，包含上游 [v1.22.2](https://github.com/AltanS/collie/releases/tag/v1.22.2) 和 [v1.22.3](https://github.com/AltanS/collie/releases/tag/v1.22.3)。已交叉核对两版发布说明、CHANGELOG 与 [v1.22.1…v1.22.3 完整差异](https://github.com/AltanS/collie/compare/v1.22.1...v1.22.3)：21 个提交、51 个文件。没有新增依赖、锁文件或构建工具变化。

## 上游全部变化

| 范围 | 行为变化及边界 |
| --- | --- |
| 输入框暂不可用时排队 | 普通消息遇到弹窗、画面未稳定，或探测失败但已确认探测字符清理干净时，保存为可取消的排队消息；之后看到一轮结束，或连续五次、跨十秒的空闲读取，再发送。已有草稿、命令、无输入配置的智能体，以及手动确认的 Type here 仍按原规则拒绝，避免永远排队。[核心修复](https://github.com/AltanS/collie/commit/c5e5a8b5)、[清理后排队](https://github.com/AltanS/collie/commit/fe76ce5e)、[适用边界](https://github.com/AltanS/collie/commit/c59b59e9) |
| 回答滚动时的发送 | 对支持运行中排队的智能体，探测及文字写入后的确认只检查输入框和其下方区域。回答中的编号列表、菜单文字、`(y/n)`、结束提示或滚动不再被当成新弹窗而留下未提交草稿。输入内容必须匹配，输入框消失、下方变化或真正弹窗仍阻止发送。命令和手动发送保留更完整的画面比较。[写入检查](https://github.com/AltanS/collie/commit/9c62c0f8)、[探测检查](https://github.com/AltanS/collie/commit/a30e2ac8) |
| 拒绝率诊断 | `collie doctor` 在最近七天至少十次已发送记录中，识别失败类拒绝超过成功发送数的 30% 时给出警告，并列出最常见原因和诊断位置。只计 `not_free`、`bound`、`probe_failed`，已有草稿等用户状态不计入；警告不会使 doctor 退出失败。[修复](https://github.com/AltanS/collie/commit/7668e032) |
| 后台智能体与输入区闪烁 | 子智能体工具事件不再改变主会话的 Surface 状态，也不再让主输入区反复显示“上次读取 0 秒前”。它仍可结束该子智能体自己的权限等待卡片。[修复](https://github.com/AltanS/collie/commit/c5e5a8b5) |
| 读取过期提示 | 新 hook 事件只有在已有画面确实超过两个轮询间隔后才使其过期；较新的画面继续采用已有判定和事件锁定状态，等待下一次读取。[修复](https://github.com/AltanS/collie/commit/c5e5a8b5) |
| 发送回执保留原因 | 拒绝和“已输入但未提交”的回执增加最多 240 字符的原因，以及 turn/modal/composer/reason 状态词；持久化读取、终端和 durable 回执列表、前端解析同步支持。不会把用户消息、终端画面或问题选项写入这些新增字段。[修复](https://github.com/AltanS/collie/commit/fe76ce5e) |
| Crew 成员升级后重新学习能力 | Lead 轮询发现成员版本变化时重新请求 hello，升级和回滚都适用，避免沿用旧版本“不支持发送协议”的判断。真正旧版本的成员返回前端可读的拒绝说明和更新指引，并记录未转发的审计条目；非 JSON 发送错误显示 HTTP 状态和截短的首行原因。[修复](https://github.com/AltanS/collie/commit/55a66e39) |
| 回执兼容和错误信息 | 持久化回执的可选 `saw` 字段未知时只丢弃该字段，原因过长则截短、类型错误则忽略，保留请求 ID 的去重能力，避免重试被当成新请求。写入失败回执使用固定说明，tmux/zellij 原始错误只留在桥接服务日志。[修复](https://github.com/AltanS/collie/commit/30f0c97b) |
| Claude Agents 页面防误提交 | Agents 页也有输入框；若输入途中切入该页，不能仅靠框下行数判断可提交。新增 `enter to return` 页脚识别，禁止 Enter 意外启动后台会话。探测字符若落入该页则失败并尝试用一次 Backspace 清理。[修复](https://github.com/AltanS/collie/commit/abda7d26) |
| Durable 输入区计时器 | 连续发送时只保留一个“Sent”提示计时器，卸载组件时清理，避免旧计时器提前清掉新提示。[修复](https://github.com/AltanS/collie/commit/219a7c7d) |
| 样本与测试 | 增加四个 Claude Code 2.1.302 的回答列表、结束阶段及 Agents 面板样本，并登记输入框、Surface 和卡片边界；增加 Antigravity 1.3.5 Plan approval 样本，验证选择只发送数字。补充队列、画面替换、回执、错误、Crew 升级和事件回归。[Claude 样本](https://github.com/AltanS/collie/commit/2ec966c6)、[Antigravity #469](https://github.com/AltanS/collie/pull/469) |
| 协议、文档与发布 | Surface 读取器版本从 1 升为 2；输入配置增加可选 `otherScreens` 页脚规则及严格校验。`CREW_PROTOCOL.md` 记录兼容字段和重新 hello 的行为，`docs/multiplexers.md` 说明排队与后台事件边界；同步版本文件和 CHANGELOG。没有新增 Crew 路由或恢复下游禁用的 GitHub Actions。 |

## 与本地实现的关系

本次没有用上游替换任何独立的下游功能。继续遵循此前采用上游发送协议、保留切换互斥保护的决定；这次更新的是该协议本身。

- **保留本地 Codex Resume 卡片。** 上游通用菜单此前已按用户反馈撤回，本次没有再次切回。搜索、行选择校验、Resume/Fork 共用解析仍保留。
- **保留 `/resume` 滚动修复。** 上游放宽的是普通消息写入后的回答区域检查；斜杠命令仍走完整比较，因此“旧的可见行滚入检查区”的有界校验仍然必要。
- **把原有图片校验接入新分支。** 机械合并后，上游新分支会绕过本地图片占位符处理，图文混合消息因此停留在输入框。现将已有逻辑提为两处分支共用的小函数：只在初始为空的输入框接受上传路径折叠，继续严格核对图片编号、数量和文字顺序。已有正向用例复现并验证修复，反向用例覆盖普通发送和命令两条路径。
- **保留 Hermes 输入配置。** 0.22.1 的边框、斜体建议、中文/多行输入、逐次探测和特殊提示符排除继续有效；上游没有提供替代配置。仍是 provisional，不把上一轮的普通消息实测扩大为整个 CLI 认证。
- **保留 Claude Settings／Agents 卡片。** 本地 Agents 解析会比上游新增页脚检查更早识别完整页面并阻止 Enter，因此相关回归的预期原因是 `modal_cue`；安全结果相同，另有上游用例覆盖页脚兜底。
- 保留 Codex Model／Agents／Plan／Review／权限卡片、警告数量、模型/模式切换保护，Hermes 中文历史和操作提示、Cursor 历史、紧凑面板、字体、PWA 视口与 tab 图标。Keys 继续采用用户选定的上游实现。

## 验证与交付边界

- 后端发送协议、回执、队列、Crew lead/forward 和 doctor：916 项通过。
- 前端 Surface、输入框、回执/API、durable composer，以及 Claude／Codex／Hermes／Antigravity 与共享 conformance：10,392 项通过，36 项已有 TODO，包含普通 composer 的发送流程。
- 64 项现有适配回放通过，catalog 校验通过；root/web 类型检查与全库 lint 通过。没有新增卡片，所以不重复建立适配目录项，也不把回放升级成现场认证。
- 本机 CLI 仍为 Claude Code 2.1.302、Codex 0.163.0、Hermes 0.22.1，超过完整 screen/journal 验证账本版本。标签明确记录这些尚未完成全面认证的版本；账本不虚增。
- 按既有流程从干净标签构建、推送 main 和专用 annotated tag，部署保留一个完整回滚包，只重启 Collie。构建及部署结果以交付时本机 build-info、config、snapshot、Files、release notes、health 回读为准。
- 按用户约定仅从 localhost 验收；公网前置 OAuth proxy 不作此次发布门槛。未新增模型调用、未启动定时监测、未重复手机截图或浏览器布局回归，也未进行 Windows 和真实多机 Crew 演练；相关行为由现有样本及协议测试覆盖。
