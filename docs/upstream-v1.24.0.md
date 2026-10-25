# v1.24.0 合并记录

从 `1.23.4+collie.3`（`05bf9cc1`）跟进至 `1.24.0+collie.1`。操作者已确认两处重叠均按推荐组合：上游发送协议加本地默认 Queue／Steer 和队列引导入口，紧凑状态栏补充上游用量数据。

已交叉核对[官方发布说明](https://github.com/AltanS/collie/releases/tag/v1.24.0)、[标签内 CHANGELOG](https://github.com/AltanS/collie/blob/v1.24.0/CHANGELOG.md#1240---2026-10-25) 和 [v1.23.4…v1.24.0 完整差异](https://github.com/AltanS/collie/compare/v1.23.4...v1.24.0)：416 个提交（188 个第一父链提交），729 个文件。实际合并目标为标签提交 `4bab157e`，包含版本提交之后的大屏、手机测试与主题样本修复。官方 Release 的比较链接从 v1.23.1 开始，其中已在本地采用的 v1.23.2–v1.23.4 补丁不再作为本次新增功能计算。

## 已确认的两项重叠

| 范围 | 上游行为 | 本地行为与采用方案 |
| --- | --- | --- |
| Queue／Steer | 普通 Send 排队；支持的 pi、Codex、OMP 可长按 Send 选择 Steer，通过 `when: "steer"` 和原生画面证据报告 steered／queued。智能体之间的消息不能主动引导。 | 本地可设置 Codex 默认排队或引导，还可立即引导最后一条原生排队消息。采用上游发送与证据协议，保留这两个用户入口，删除被取代的旧 steer 发送分支。完全采用上游则删除这两个入口。 |
| 上下文与限额 | ModelTag 用五点表示上下文、5 小时及 7 天用量，使用率达 80% 变黄；接入 Claude／Codex 官方来源数据。 | 本地在镜像专用状态栏使用紧凑图标、百分比与重置时间。保留该呈现，补充缺失的上游数据并避免重复；完全采用上游则用五点替换重叠的上下文／限额显示。 |

## 全部上游功能变化

### 输入、发送和操作带

- **停止正在运行的任务。** Stop 固定在操作带起始端，空闲时置灰且不挤动其他按钮。首次点击进入确认，间隔至少 400ms 再点才按该 harness 的中断键。发送前回读，弹窗、已结束任务或可能被中断键清除的用户草稿会阻止操作；连续两次空闲读取才报告停止。停止回执还会结束 hook 留下的运行状态。Crew 中旧成员或丢失回复会明确说明。[Stop](https://github.com/AltanS/collie/commit/b8a2eacb)、[固定位置](https://github.com/AltanS/collie/commit/c99dcb5e)
- **运行中主动引导。** pi、Codex、OMP 的 Send 长按菜单可选择 Steer，普通点击继续排队；引导在当前工具步骤之后接入。服务端检查调用来源、原生能力及提交前后的输入框和队列，回执区分已引导、原生仍排队、文本未取走和结果未知。智能体之间的发送继续等待。[实现与采样](https://github.com/AltanS/collie/commit/9552b1c8)
- **清空原生输入框并恢复。** Keys 的 Clear 使用 profile 声明的清空键，并回读结果。空草稿、弹窗、不可识别画面、断线时置灰或拒绝；成功后悬浮提示提供两分钟 Restore，只恢复文本、不提交，换行和 Tab 转为空格以免触发原生提交。Crew 旧成员明确报告不支持。[实现](https://github.com/AltanS/collie/commit/938f9f07)
- **长粘贴变成可编辑附件。** 至少 5 行或 300 字符的纯文本粘贴在光标处变成 `[Pasted #N]` 标记，上方附件显示首行、行数与字符数；可编辑或展开回原位置，发送时还原真实文本。草稿存储升级到新 key；回退 1.23.x 时新草稿暂不可见，重新升级后恢复，避免发送裸标记。[实现](https://github.com/AltanS/collie/commit/4ba34c3)
- **最近发送显示内容。** 单行、长度合适且不疑似密钥的文本与发送回执一起保留本机 7 天；列表截断、详情可读完整内容。多行、过长或疑似秘密只留结果和时间，文本不转发给 Crew lead。[实现](https://github.com/AltanS/collie/commit/ff8c1d4)
- **Claude 问答可直接填自定义答案。** 单题、向导及多选卡片提供输入编辑器，绑定原问题和步骤，提交前核验原生字段。向导指针停在 `Type something.` 时不再发送会变成文字的数字快捷键；题目变化后的第一次发送拒绝并提示新题，下一次才回答新题。[问答](https://github.com/AltanS/collie/commit/0d7250d8)、[字段保护](https://github.com/AltanS/collie/commit/3aab0774)、[题目变化](https://github.com/AltanS/collie/commit/239b54e7)

### 用量、上下文与模型

- **ModelTag 显示上下文、5 小时和 7 天窗口。** 五点表示使用量，80% 起变黄。上下文由会话开始和回合结束的 beacon/hooks 从原生日志读取；当巨型工具结果遮掉所需尾部时移除旧读数，下一回合重新获取，不保留过期值。[实现](https://github.com/AltanS/collie/commit/9bc30b9c)
- **Claude／Codex 官方账户窗口。** Claude Pro／Max 默认读取本机 CLI OAuth 登录，向 `api.anthropic.com` 的官方 usage 端点查询；不另存登录材料或发送到其他主机。Codex 从最近两小时内最新原生 session 文件尾部读取 ChatGPT 窗口，不读取登录。只在该 harness 的 pane 打开时查询，权限不安全的登录文件会被跳过。`COLLIE_ACCOUNT_WINDOWS=0` 全关，或列举 harness 白名单。[实现](https://github.com/AltanS/collie/commit/513def12)
- **OpenCode Go／Grok 用量默认关闭。** 两者尚未用真实账户验证，需显式 `all` 或白名单开启，查询各自官方端点 `opencode.ai`、`cli-chat-proxy.grok.com`；月窗口可读但不绘制。`collie doctor` 列出各 harness 的开关、读取位置、查询主机及未验证状态。[开关与诊断](https://github.com/AltanS/collie/commit/004675da)
- **不自动新增 statusLine。** 现有 Claude statusline 包装仅在 `collie hooks install claude --statusline` 显式开启时安装，作为用量来源的另一条路径；本次合并不替换用户脚本。[选择性安装](https://github.com/AltanS/collie/commit/1c97c2fc)
- **Claude 新会话首次回复前即可显示模型。** SessionStart 带出初始模型，空历史上的 `/model` 也立即更新；产生历史后继续跟随 transcript。[修复](https://github.com/AltanS/collie/commit/980607fd)

### 工作区、大屏与导航

- **多选工作区筛选。** Dashboard、Spaces 和 Changes 共用多选结果，旧单选迁移为一个选中项，超过两个工作区时显示数量。[实现](https://github.com/AltanS/collie/commit/bd6a33d3)
- **Crew pane 切换器标出机器。** 使用对应机器的图标与颜色，无障碍名称包括机器名；单机不增加额外符号。[实现](https://github.com/AltanS/collie/commit/a530815)
- **宽屏侧栏和多个 pane 并排。** 至少 600px 宽、480px 高启用，每个 space 保存可横向滚动并吸附的 pane 排列。侧栏可收为图标轨，支持打开、旁开、拖入；pane 可设 1/2、4/5、Full 或移出视图。每个 pane 保留自己的操作带，交互会切换到对应 pane；输入时滚动不抢焦点。顶部管理 space/tab，长按提供重命名与独立关闭；尾部 Add a pane 可加入其他 pane，或在当前 space 新建 agent/tab。Settings 的 Large-screen layout 可关，布局仅保存在设备上。[实现](https://github.com/AltanS/collie/commit/23c3ab4e)
- **折叠屏分区。** 支持相关浏览器的半开 Fold 分区：横折将会话放上半、操作带和更高输入框放下半，键盘出现时调整；竖折两边分别显示 pane。横屏手机高度不足 480px 继续使用手机布局。上游尚未用真实平板完整验证。
- **双指或摇杆切换 pane/space。** 一指按住后第二指滑动：左右换 pane、上下换 space，预览目标状态和位置。抬第二指再抬第一指确认；第三指、先抬第一指或未滑动则取消，不穿透点击下方控件。边缘返回、长按选字、缩放保持原操作；首次启动有提示，可在 Settings 关闭或改摇杆。当前“第二指启动”版本只通过桌面 Chromium 模拟触摸，TalkBack 会接管双指手势，仍可用切换器和侧栏。[手势](https://github.com/AltanS/collie/commit/67e31189)、[防误触](https://github.com/AltanS/collie/commit/49ac63ac)
- **主题 schema 3。** 新增可选 `pane-active` token，ColliePWA 字样采用状态颜色；旧 v1/v2 主题样本维持其原版本，不强行伪装升级。[主题](https://github.com/AltanS/collie/commit/5fdc1a84)、[正式标签末尾修正](https://github.com/AltanS/collie/commit/4bab157e)
- **重命名立即反映且不强制首字母大写。** 发起重命名后补一次快照读取，避免旧名称滞留数秒；手机键盘关闭 autoCapitalize。[回读](https://github.com/AltanS/collie/commit/ae727f0)、[键盘](https://github.com/AltanS/collie/commit/f6aca6a)

### Harness 与聊天历史

- **Kiro CLI V3。** 从 `messages.jsonl` 提供 Chat/History，Herdr 下通过进程持有的锁确定 session。Shell、读、写和替换文件审批提供 Allow once／Deny／Close；MCP、截断面板、V1/V2 保留终端。`kiro_root`／`COLLIE_KIRO_ROOT` 支持自定义根目录，上游采样版本 2.32.0。[实现](https://github.com/AltanS/collie/commit/a33e3d9d)
- **Kiro 工作区信任卡片。** 完整保留路径和安全警告，通过受保护的指针移动选择 Trust／continue／Don't trust，动作绑定原路径。[实现](https://github.com/AltanS/collie/commit/bf90905f)
- **Kiro Shell 审批绑定完整参数。** 卡片签名包括 shell preview 中的 description、cwd、后台执行和 timeout 等，预览标题须匹配命令；不完整预览继续原生显示，避免不同调用复用同一审批。[修复](https://github.com/AltanS/collie/commit/4d2abf56)
- **pi Gentle Shell 与通用任务卡。** todo 更新同一卡片，选择题带答案，子智能体和后台命令按日志更新状态，fetch/search 独立显示、memory 记录弱化；Gentle AI review consent 变成可操作卡片。Collie ask_user、OpenCode todowrite、Claude Monitor 共用相关呈现。[实现](https://github.com/AltanS/collie/commit/90f44dfb)
- **扩展 harness 操作带与命令目录。** OpenCode、Grok、Muse、Antigravity 增加 Model／Compact／Resume 等原生命令；Muse 另有 Effort，Grok/Muse 有专用标识，各自 `/` 目录包含支持的内置 skills。上游核对版本为 OpenCode 1.18.34、Grok 1.0.52、Muse 1.4.8、Antigravity 1.3.5；这些历史采样不等于当前本机认证。[实现](https://github.com/AltanS/collie/commit/b6a4824d)
- **Muse 会话名称。** 读取日志中的用户自定义名，用于 Dashboard 和通知，限制 120 字符并移除控制字符；从具名 resume 换到新 session 时清除旧名，自动名称维持通用名。[实现](https://github.com/AltanS/collie/commit/a7fe51f0)、[边界](https://github.com/AltanS/collie/commit/7bb65f43)
- **Muse 历史更完整。** edit_file 带 diff 和增删数，问题记录带答案；斜杠命令作为用户行显示，但原生只记录命令名、不显示不存在的参数。日志缺少图片像素时显示 `[image attached]`，不生成坏图或重复标记；tool denied／failed 读为拒绝或失败。[编辑与答案](https://github.com/AltanS/collie/commit/ed7c589)、[命令](https://github.com/AltanS/collie/commit/333019bd)、[图片](https://github.com/AltanS/collie/commit/5a5217ba)、[失败结果](https://github.com/AltanS/collie/commit/7e99b51c)
- **Muse 后台任务与启动参数。** composer 下原生任务列表进入 agents footer，要求 Muse 自己的 header，折叠时显示首个运行任务。启动页增加 Yolo mode／Never ask／No question prompts，前两者互斥，并识别对应禁止提问参数。[后台任务](https://github.com/AltanS/collie/commit/909ae45a)、[启动](https://github.com/AltanS/collie/commit/a42da3ae)
- **Muse 命令与运行中发送。** 依据 1.4.10 调整 `/model` 参数、`/resume --last|id|name` 和不带参数的 `/effort`，补 usage／hud／permissions／deep-research／bug。运行中普通消息按 Tab 进入原生队列，Enter 的引导语义不再误触；斜杠命令仍等待。effort/hud 的筛选器只提供 Esc，不把数字或字母当选择键。[目录](https://github.com/AltanS/collie/commit/f54c9a4)、[队列](https://github.com/AltanS/collie/commit/9ce43d70)、[筛选器](https://github.com/AltanS/collie/commit/5a7982d4)

### 其他修复、Walky 与 SDK

- **Claude Herdr 长文本整段粘贴并证明提交。** 多行或单行超过 800 字符使用 bracketed paste，按原生折叠标记核验；命令、shell 行、文件提及继续逐行，手机图片附件单独处理。避免输入框长过屏幕后卡在 Typed, not sent，Submit/Discard 也共用粘贴证明。[修复](https://github.com/AltanS/collie/commit/9820b4b)
- **Claude CJK 和长问题识别。** preview/Notes 按显示宽度切列，支持双宽及零宽字符；带问号 chip 下面的问题、超过六行或两个段落的问题按位置读取，避免截断或错误拼接。[修复](https://github.com/AltanS/collie/commit/01688472)
- **pi 长草稿避免误判菜单。** 连续折行中除末行外须填满输入框宽度才能按软折行草稿处理；含省略号时保守视为不可读，短行手工换行仍可能是菜单，拒绝盲发。[修复](https://github.com/AltanS/collie/commit/9039a53)
- **OMP 运行中的 `/goal pause`／`resume` 即时提交。** profile 声明允许运行中执行的单行命令，走命令键，回执 sent，不误标 queued；其参数列表仍属于原命令。[修复](https://github.com/AltanS/collie/commit/1b3dc326)
- **代码行内 URL 可点击。** 反引号中的 http、https、mailto 链接可打开，混合内容只链接地址本身；文件查询被 bridge 拒绝后 30 秒可重试，新快照可解除过期拒绝。[修复](https://github.com/AltanS/collie/commit/b57ec405)
- **Walky 草稿等待与撤回。** 原生已有草稿时暂存而不是永久留 inbox，连续两次空闲且草稿为空才送入；草稿发送后的运行回合也继续等待。统一从接收起最多保留 60 分钟，回执包括 draft present／turn running，pane 被其他 session 替换后不投递。发送者可 cancel，目标所有者可 drop；已写入原生输入框的内容不能撤回，跨机器取消与权限均有边界检查。[暂存](https://github.com/AltanS/collie/commit/c3882a8)、[撤回](https://github.com/AltanS/collie/commit/5efb912a)
- **Edge snooze 文案。** 不再暗示 Edge 存在 digest，改为下次 build 再提醒，Stable 文案保持原语义；文档说明 Edge 频率、09:00 前不推送和 crew 跟随 lead 回退规则。[修复](https://github.com/AltanS/collie/commit/d39a4db)
- **实验 durable-harness 接入。** SDK 新增 `./durable-harness`，`collieRoute` 按持久日志重建 wire，`withCollie` 让危险工具调用等待手机决定；包括事件折叠、共享 store 原子 claim、僵尸执行／取消／缓存边界与示例 shipping desk。仅自托管实验，Vercel 部署尚未验证，本次不部署此示例。[入口](https://github.com/AltanS/collie/commit/59b5b981)、[文档](https://github.com/AltanS/collie/commit/8e8f9797)

## 文档、构建、测试工具与兼容性

- 新增 Large screens、折叠屏、双指／摇杆设置说明；ADR 0113–0121 涵盖问答输入、无进程 durable wire、用量、Stop/Steer、账户查询、任务卡、大屏和导航，并记录未验证的真实设备边界。
- Durable wire 增加无常驻进程主机的 draft 附录：epoch、rev、turn id 和 ask/answer/request 日志推导；不修改现有 v1 wire 契约。SDK pack 检查会在 Node/Bun 导入新入口，并保留示例依赖的七天冷却规则。[pack](https://github.com/AltanS/collie/commit/6dd670a)、[wire](https://github.com/AltanS/collie/commit/99a6f97)
- Canary 新增显式 `--scenario bar`，逐项打开原生菜单、Esc 关闭并保存 ANSI；draft 支持 OMP 折叠 paste chip。发送 shim 复用服务端 Send Protocol 与当前客户端的 sendText/liveness，而不是旧 reply route 假响应。[bar](https://github.com/AltanS/collie/commit/add05e1c)、[发送路径](https://github.com/AltanS/collie/commit/1d93e930)
- Browser rig 扩为 33 个 solo、7 个 crew 场景，新增 Clear、Stop/Steer、用量与大屏等验证；pi 优先 PATH/node 相邻位置并支持最新 nvm 路径，保留显式二进制覆盖。手机样式测试明确固定手机布局，避免桌面窗口宽度误触大屏布局。
- 本地适配目录新增 Kiro 审批、Kiro 信任、pi Gentle review 三项，共 67 项；保留 `verified: null`，本轮不冒称完成真实 CLI 认证。
- 新增 Muse 1.4.10 六份真实采样及来源说明，未因此扩大其 profile 已认证版本范围；增加 Codex/pi/OMP Steer 与队列、Kiro、Claude 问答和大屏测试样本。样本回放与真实 CLI 验证分开记录。[Muse 样本](https://github.com/AltanS/collie/commit/66b31e69)
- 新增/调整十二种语言的账户用量、清空、引导、导航、大屏、Walky 与提示文案；图标来源文档补 Grok/Muse。
- 根目录与 web 生产依赖没有新增项；实验 reader-stability 的 `@vitest/mocker` 从 4.1.11 更新至 4.1.12。Bun 1.4.4 安全下限属于已采用的 v1.23.3，不再次升级运行时。
- Windows 路径/CRLF 测试、durable socket 跳过预算 157、CI release 分支和 Bun 版本检查一并核对；当前 fork 继续禁用 `.github/workflows/`，不恢复上游 CI、不生成 GitHub Release，也不声称完成 Windows 二进制验收。
- Hermes 文档明确区分 classic CLI 与未读取的 Ink TUI；本地已有 modern CLI 样本与发送适配继续保留，不将 fixture 回放冒充新版本完整认证。

## 本地实现替换与保留

本次替换：

- **Codex 引导提交实现。** 本地 `mode: steer` 与 `steerKey` 改用上游通用 `when: steer`，增加提交延迟与明确 steered／queued 回执；保留用户选择默认行为和队列提升。大屏非焦点列也使用 Input 入口，移除残余 Keys 按钮。

- **Canary 发送 shim。** 原本本地单独构造 SendProtocol，改用上游服务器实际 `sendRoute`，继续限制只能操作本轮创建的 pane，保持临时 request store 与无监听端口的隔离方式。用户正常发送行为不变，工具验证更贴近实际 API。
- **Claude 问题正文定位。** 用上游按显示宽度、chip 位置和长问题结构的实现替换重叠旧 helper；保留本地审批上下文、Settings 固定卡片和非完整原生界面的保护。

保持的下游目标：

- Codex Model／Resume／Agents／Plan／Review／审批卡片、warning 数量、模型/模式切换互斥，以及灰底用户消息的终端软折行处理。
- Claude Settings 固定可滚动正文、小 Esc、Agents 卡片与原生提示入口。
- Hermes 历史分组、中文提示、modern CLI 输入适配；Cursor 的 session history/journal。
- AGY 专用 Chat、状态栏、图标、Model／Resume／Effort／Keyboard 模态与 Artifact 卡片，操作带合并不重复添加 AGY 一行。
- 紧凑布局、字体设置、16px 重命名输入防 iOS 自动缩放、未识别界面的原文留在镜像区与底部小卡片。
- 输入按键行仍随 Input 模式展开，保留原有手机草稿。上游 Clear 接入此行，不重新引入独立 Keys 面板；Restore 仍走上游受保护回执流程。
- Codex 默认 Queue/Steer 与最后一条队列的立即引导保留；普通引导改成 `mode: send, when: steer`，移除旧 `mode: steer`／`steerKey`。队列召回仅允许手机明确意图，核对队列移除与草稿落地后，复用上游延迟、提交前读取与 steer witness，不再独立直接 Enter。
- API 用量只补原生状态栏缺失的上下文／5h／7d，沿用剩余百分比、图标和无障碍说明；重置时间放入提示，避免新增长文本。ModelTag 在实际 pane 里不再重复绘制用量圆点。

本地合并回归另修正 Hermes 运行标志只匹配实际 composer 的 `☤`，避免旧回复标题残留造成“始终工作中”；其状态栏下界收紧为最多两行，避免外来菜单被误吞成状态栏。现有 Hermes 正反例与历史标题样本回放通过，未据此扩大 CLI 认证版本。

## 验证与交付

已通过日志/用量/工具独立测试 1,064 项，配置/账户窗口/doctor/history 等 474 项，发送/中断/清空/Walky/Kiro 等后端 1,230 项，以及发送客户端/canary 622 项。重叠文件分别复核，以上数量不作为不重复用例总数相加。

前端逻辑套件 107 个文件通过：42,451 项通过，另有 34 项预期失败、66 项 todo。发送/清空/状态栏组件 404 项、最终聊天/大屏组件 308 项、其他独立组件 146 项、按键行 9 项通过。67 项适配目录共 948 个断言及样本回放通过；根目录和 web 类型检查、lint 通过。正式构建通过；Chromium/WebKit 手机浏览器覆盖 Queue／Steer、Input 草稿缓存、首 token 状态与 320px 状态栏 12 项，加上平板 Auto／Off 两项，共 14 项最终通过。状态栏旧测试直接比较透明层背景，现改为核验祖先提供的实际背景，截图确认与输入区同底。以上重叠批次不相加，expected-fail/todo 不视为当前 CLI 实机认证。

实验 durable-harness 示例未安装其独立的 `durable-harness` 等依赖，尝试运行三个示例测试文件时在模块加载阶段退出，未执行用例；本次不为可选示例安装依赖或宣称其运行通过。

只部署和重启 Collie；按用户要求仅验收本机 `http://127.0.0.1:8788`，不穿透公网 OAuth。没有改变 Herdr、Headroom 或用户的 agent 会话，没有新增模型调用，未运行完整 40 场景原生 browser leg、真实折叠屏/手机手势、Windows 运行或 Vercel 部署。发布后只保留最近一个完整回滚包；保留 PWA 旧哈希资源和用户数据。
