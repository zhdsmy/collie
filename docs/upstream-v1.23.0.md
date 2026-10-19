# v1.23.0 合并记录

目标从 `1.22.6+collie.1` 升级至 `1.23.0+collie.1`。已交叉核对[官方发布说明](https://github.com/AltanS/collie/releases/tag/v1.23.0)、标签内 CHANGELOG 和 [v1.22.6…v1.23.0 完整差异](https://github.com/AltanS/collie/compare/v1.22.6...v1.23.0)：536 个文件、234 个非合并提交。正式版本提交后纳入标签的 Windows 路径兼容修复也在范围内。

## 智能体间消息与 Shell 历史

| 范围 | 上游行为与边界 |
| --- | --- |
| Walky talky | 新增 `collie walky`／`collie wt` 的 who、send、reply、inbox、status，允许操作者和不同智能体会话传递消息。向目标终端写入带 id 的单行提示，消息正文由独立 inbox 命令读取，不把正文当 Shell 指令。正文最多 4,000 字符；对话框未回答时等待，有草稿或等待超时则保留 inbox。后台发送遵循各 agent 的队列或 held 行为，不强行 steer。[实现](https://github.com/AltanS/collie/commit/ce891bd0)、[正文隔离](https://github.com/AltanS/collie/commit/93a02dda) |
| 回执和限制 | 每条消息带回执和后续查询命令，最多等待 15 秒；按消息和目标去重一天，重启不重新键入 held 提示。限制循环、广播和回复，回复必须指向真实已知发送者；`COLLIE_WALKY=off` 可关闭本机接收，doctor 显示拒绝统计。消息记录保留七天。[限制](https://github.com/AltanS/collie/commit/7cb44c22)、[去重](https://github.com/AltanS/collie/commit/d7a912c0) |
| 会话地址 | 地址可带四字符 pane 实例 token；手机也使用 token，防止关闭后的 pane id 被新会话复用而误投。离开视野 30 秒后撤销旧实例及 inbox。无 token 的地址仍指向该 id 当前持有者。[实例绑定](https://github.com/AltanS/collie/commit/9879ecb6) |
| 跨 Crew | 经 lead 校验来源签名并背书，接收 member 核验发送机器证书和来源；两跳校验数据形状，拒绝时钟偏差超过十分钟的消息。member 报告等待确认，结果返回原发送者，已完成结果不退回 unknown／queued；广播列出不可达、旧版、拒绝机器和被跳过的 Shell pane。[跨机器](https://github.com/AltanS/collie/commit/ad02054c)、[确认与结果](https://github.com/AltanS/collie/commit/de36350e) |
| 手机消息卡片 | Chat 和镜像只将本机／对应 member 日志认可的消息 id 渲染为可信卡片；伪造打印的标题保持普通文本。卡片标明异机名称、来源核验方式和前三行，点击打开 Messages 定位并回复。工具卡有 walky 标记、收件正文或发件回执；收发消息都不折进普通工具步骤，Messages 同时列出发件和收件。Send 长按可选择 Send as message，Crew 支持带实际人数和机器数的广播二次确认。[卡片](https://github.com/AltanS/collie/commit/236f8d6a)、[发件](https://github.com/AltanS/collie/commit/3852182a)、[异机标题](https://github.com/AltanS/collie/commit/4f8511b6) |
| Walky skill | CLI 可安装到 Claude 各 profile，或 Codex、OpenCode、pi、Gemini 的全局说明受管理区块，保留其余文字；skill 教会地址、回执和回复，明确消息不能批准破坏性操作。status／doctor 检查过期副本，CRLF 不造成误报。上游内置更新／回滚／切换流程成功后会同步已发现的 harness skill，失败不阻断升级。本次手工部署不额外改写全局智能体说明。[安装](https://github.com/AltanS/collie/commit/ecc3dc61)、[同步](https://github.com/AltanS/collie/commit/87823ef3) |
| Shell Sent | 每机保存从 Collie 发送的 Shell 行和 New 页一次性命令，权限 0600，最多 5,000 行／365 天；不记录 agent 提示、以空格开头的行、疑似秘密或会被脱敏的内容。可查询、删除和清空，`COLLIE_SENT=off` 关闭；Crew lead 汇总而不复制 member 历史。输入上方建议支持选择／浏览，按设备设置开关。[记录](https://github.com/AltanS/collie/commit/14a72707)、[建议](https://github.com/AltanS/collie/commit/abc801dd) |

## 面板、展示与会话

| 范围 | 上游行为与边界 |
| --- | --- |
| Tasks | 操作带显示 Tasks 完成数／总数，读取 Claude task 文件／journal、Codex update_plan、OpenCode todowrite、Grok todo_write；打开只读列表，不发送命令。空列表或不支持的 agent 不显示，任务文字遵循脱敏。[PR #476](https://github.com/AltanS/collie/pull/476) |
| Agents 与子会话 | 操作带 Files／Switch 旁的小图标显示运行中 Claude 子智能体数量，点击打开覆盖页面的列表，不挤动正文；可继续打开独立子会话 transcript，关闭后返回列表。Chat 的 Agent 卡也能打开该 transcript，异步 launch 等待 task-notification 后显示完成报告，省略内部 launch 元数据。Agent 卡独立于工具折叠，无类型时显示 Agent；完成过的子智能体再次运行仍可追踪，安静过久的孤立记录不冒充运行。[PR #504](https://github.com/AltanS/collie/pull/504)、[操作带列表](https://github.com/AltanS/collie/commit/d316c764) |
| Agent 命令发现与建议 | Claude palette 增加用户、项目及已安装且启用的 plugin 技能／命令，读取名称、描述和参数提示，遵循 device-read、文件大小、深度、数量及路径边界；operator 自定义列表仍优先。输入 `/`，Codex 也支持 `$`，展示最多十二个匹配建议，点击只填入，不提交。磁盘扫描结果留在 palette，不混入建议条；Shell 的 Sent 开关不控制 agent 建议。[PR #478](https://github.com/AltanS/collie/pull/478)、[建议条](https://github.com/AltanS/collie/commit/71b0cb55) |
| 模型 Effort | Chat 模型标签附加 Claude effort、Codex reasoning、pi thinking、OpenCode variant；没有模型不单独显示 effort，终端已显示模型时隐藏重复标签。只是展示，不参与发送或状态判定。[PR #464](https://github.com/AltanS/collie/pull/464) |
| Stretchtext | 可选显示 cc-stretch 的 `{{short\|long}}` 短文，点击展开／收起，采用插件四种颜色并检查亮色主题对比度；搜索自动展开命中。默认关闭，适用于 Chat、完整回复和 History，不发额外请求。[PR #459](https://github.com/AltanS/collie/pull/459) |
| 状态栏开关 | Settings 新增按设备、按 harness 的 lifted statusline 开关，默认开启；关闭也隐藏 Claude 原后台 agents 区，模型标签返回操作带上方，Tasks／Agents 仍可用。统一 Antigravity 两个名字，正确显示 Hermes／Grok／Muse 名称。[设置](https://github.com/AltanS/collie/commit/c0d264f3) |
| New 目录浏览 | Folder 下方 Browse 逐层浏览 home 内子目录，标注仓库，输入路径不存在时从最近存在父目录配合余下文字筛选；选择 Use this folder 只填写，不创建目录，复用 Files 限制。[PR #467](https://github.com/AltanS/collie/pull/467) |
| 多图与分页 | session log 两次读取间增长小于 8 MB 时增量追加，避免数张截图触发重建并清空 Chat；更大间隔仍有界重建。Chat／加载更早历史按六条用户 prompt 分页，保留其后所有步骤，至少四十行、最多四百行。[增量](https://github.com/AltanS/collie/commit/04325ff2)、[分页](https://github.com/AltanS/collie/commit/761be21e) |
| 会话追踪 | Codex rewind 后跟随新 transcript，并按顺序读取保留历史和新轮次；pi `/new` 在新文件尚未写出时立即清空旧会话；同目录多个 Muse pane 且缺少明确 session 时显示原因和解决方法，不猜最新日志。[PR #523](https://github.com/AltanS/collie/pull/523)、[#526](https://github.com/AltanS/collie/pull/526)、[#508](https://github.com/AltanS/collie/pull/508) |
| Files／Changes | pane cwd 在 workspace 外时使用 pane 自己的目录；没有 Git 仓库就说明，不显示另一仓库。仍在 workspace 内的 pane 保持 workspace 视角。[PR #509](https://github.com/AltanS/collie/pull/509) |

## 输入、适配与更新

| 范围 | 上游行为与边界 |
| --- | --- |
| S1 提交保护 | 写入后、Enter 前重新检查运行中规则；期间启动且不接受消息的轮次会留下草稿并说明，原生可排队的 agent 仍正常提交。[修复](https://github.com/AltanS/collie/commit/a3e2564a) |
| Hermes | 新增 classic CLI 0.22.2 clarify 单选和危险命令审批，长命令须展开全文才能批准；多选或不明确屏幕保留原生操作。卡片声明最多十二行活动尾部以绑定，发送采用自己的 profile，忙碌／开放问题遵守 held 保护；journal 支持 HERMES_HOME 和 named profile。[上游适配](https://github.com/AltanS/collie/commit/83712a5d)、[发送](https://github.com/AltanS/collie/commit/17791afd) |
| Cursor CLI | 新增边框输入、草稿、spinner、follow-up 队列、slash 列表和折叠粘贴识别。Shell 模式按草稿处理，不覆盖；profile 当前声明 provisional。[PR #481](https://github.com/AltanS/collie/pull/481) |
| OMP | 兼容 Nerd Font 默认 band composer 及 18.11 powerline、minimal、ASCII、透明等状态栏样式；继续保留命令／picker 区分。[PR #505](https://github.com/AltanS/collie/pull/505) |
| Claude | session rating 作为带四个按钮的非阻塞 notice，输入可发送；支持 2.1.303 带会话名的输入框顶边，新增真实样本。[评分提示](https://github.com/AltanS/collie/commit/c45acef1) |
| Type 模式 IME | 字段保留本行，仅发送变化，按字素处理删除；Enter、方向、Tab、Esc 及按键区操作结束当前行，文本和按键共用有序发送器；组合输入回写保护避免 Android SwiftKey／Gboard 重复词语。最新修复只在密码交接时遮盖字段，普通直接输入仍显示正文。[差量输入](https://github.com/AltanS/collie/commit/6166c28c)、[按键边界](https://github.com/AltanS/collie/commit/fe2a52b5)、[密码遮盖](https://github.com/AltanS/collie/commit/a57a8afd) |
| unknown 发送 | 点击发送后，Chat 出现新的、同文字用户轮次时清理 unknown 状态；仅当手机草稿仍为同一文字才清空，用户随后编辑的内容保留。不能确认时继续显示原状态。[PR #511](https://github.com/AltanS/collie/pull/511) |
| Muse | 1.4.10 profile 的 paste settle 等待 350ms，避免 Enter 被忽略；运行中立即拒绝 session 类命令和 `!`，普通消息及 `/compact` 仍 held。[PR #507](https://github.com/AltanS/collie/pull/507)、[#519](https://github.com/AltanS/collie/pull/519) |
| 更新发布门控 | 只有已发布、存在 collie-release.json 的版本才提示更新；404 期间不提前显示，网络失败保留既有回退。Stable 默认只取正式版，Edge 可取 edge.N 预发布；切通道本身不安装，有回执。Settings 可二次确认回滚，失败的 Edge 构建不反复推荐；Crew 跟随 lead，development lead 不再等待不存在的自身更新任务。[PR #503](https://github.com/AltanS/collie/pull/503)、[双通道](https://github.com/AltanS/collie/commit/27b16022)、[Crew](https://github.com/AltanS/collie/commit/b839c56e) |
| 配对与 System | 主机 loopback 配对需要外部可信身份时显示具体原因和访问地址提示，未尝试的配对码仍有效；bridge 不可达时不捏造系统事实。[PR #512](https://github.com/AltanS/collie/pull/512) |

## 工具、文档与打包

- 上游 lab 更新 Claude 2.1.302、Codex 0.163.0、OMP 18.6.1 和 OpenCode 1.19.3 的 screen 验证记录；journal 的旧版本记录独立保留。修复 Codex lab 的 CODEX_HOME、API-key 登录和项目 trust，以及这些 agent 的 send／ask／decline；OMP 增加 OpenRouter lab 配置。profile 已覆盖版本时仍能提交 ledger，失败时清理工作树。[lab](https://github.com/AltanS/collie/commit/7a996c1b)、[发布](https://github.com/AltanS/collie/commit/dd157393)
- browser rig 新增本机 walky 六场景、独立 lead／member 三场景及草稿／问题／伪造标题边界，nightly 可覆盖 Crew；调整 Chat Load older 场景。没有因此启用本机定时任务，也不把模型 rig 变成本 fork 每次发布强制门槛。
- release tag／version／notes／reading 工具支持 Edge stamping 和预发布，Windows artifact 判定、CLI 测试与 skip budget 同步；标签末尾修复 plugin manifest、Hermes home、Files 链接测试的 Windows 路径。fork 继续禁用 GitHub Actions，不创建 GitHub Release，不发布 Windows 二进制。
- 新增 ADR 0107（Sent）、0108（活动尾部）、0110（双通道）、0111（skill 跟随更新）、0112（pane 目录）；更新安全、配置、命令、升级、Crew、multiplexer、术语、故障排查、样本及 rig 文档。AUR／Nix 元数据跟进官方 1.22.6 产物，保留标签原值。主项目未新增依赖，未改 flake 工具链。

## 下游取舍

Hermes 按用户选择采用上游问答／审批识别、输入状态及发送 profile，删除被替代的旧 clarify/footer 判断和 display-only 发送假设。新卡片绑定问题面板，不绑定每秒变化的倒计时；Other 回到原生可输入状态，危险操作只有上游明确支持的批准／拒绝选项。不认识的旧格式保持原文，旧状态栏符号不再猜测。

实际安装的是带本地修改的 `0.22.1+7.g279aafb.dirty`，并非上游采样的原版 0.22.2。实测需要三处小补丁：复用 profile 的 150ms 粘贴等待；输入框包含字面横线时验证下一行确为 prompt 才认作边界，并允许原生八行输入；中文问题的右边框被挤到下一行时只重组这个明确的两行形状，绑定仍使用原始物理行。没有扩大到任意文本折行推断。详情与限制见 [Hermes 本机验证记录](../web/src/lib/harness/hermes/LOCAL_VERIFICATION.md)。

保留 Hermes 历史／启动区折叠、diff 展示及完成通知定制，展示处理集中于 `display.ts`，不判断按键状态。保留 Codex Resume／Model／Agents 等卡片、运行时 Queue／Steer 设置及立即引导、warning 数量、模型切换保护；保留合并进 Input 的按键区和草稿缓存、Claude Settings／Agents 卡片、Cursor journal、紧凑操作带、字体、tab 图标及 PWA 定制。新上游设置和功能接入这些现有组件，不保留第二套面板。GitHub Actions 继续禁用。

## 验证与边界

- 隔离的真实 Herdr 会话运行本机 Hermes，使用独立 HOME 和脚本化的本机兼容 API，没有调用付费模型，也没有操作用户对话。通过真实 SendProtocol 验证长英文、长中文、原文空行、含横线的五行消息；真实 AskBook／AskAnswerer 验证单选、Other 中文输入、危险命令拒绝，等待倒计时变化后仍可点击。50 列中文卡片和 `/model` 另行实测通过；测试会话、HOME、接口均已清理，危险命令没有执行。
- 前端完整套件先行运行，再针对合并后的改动和失败项回归；最终逻辑集 102 文件、34,099 通过，34 项预期失败、58 todo。相关 DOM、输入、发送设置、卡片与绑定测试通过。320px Chromium／WebKit 验证 Hermes 问答与 diff、状态栏、Codex Queue／Steer 和命令面板。
- 后端与 CLI／脚本套件先行运行，修正合并后的 Cursor 注册、Hermes 原生框几何及按键测试，并回归相关文件；发送协议 435 项通过。目录回放和前后端绑定契约覆盖本次新采样，防止前端能显示而后端拒绝点击。另修复上游 CLI shell 测试的一处 GNU-only `sed -i`，使 macOS 可运行。
- 根目录及 Web 类型检查、lint、版本检查、shell 门禁和正式标签构建按仓库流程执行。部署只重启 Collie，并回读本机 build、health、config、snapshot 和当前版本说明；公网域名已加 OAuth，按用户要求只从本机验证。

本次没有运行真实供应商推理、跨机 Crew／Walky 模型 rig、Windows 或真机 iOS。Hermes 超过原生八行视窗或 ghost suggestion 遮住 prompt 时仍保守拒绝；极快出现的工具对话若抢在提交见证前替换输入框，上游可能返回 unknown，不会自动重发。终端回放不能证明所有软折行和真实换行边界，探索性的草稿 sweep 不计为全绿认证，也不据此放宽发送保护。
