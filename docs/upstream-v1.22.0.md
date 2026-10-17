# 跟进上游 v1.22.0

从 `1.21.3+collie.1` 跟进到 `1.22.0+collie.1`。已核对[发布说明](https://github.com/AltanS/collie/releases/tag/v1.22.0)、[CHANGELOG](https://github.com/AltanS/collie/blob/v1.22.0/CHANGELOG.md#1220---2026-10-17)和[完整差异](https://github.com/AltanS/collie/compare/v1.21.3...v1.22.0)：560 个提交，795 个文件。以下包括全部发布条目，合并相关条目说明用户影响。

## 上游变化

### 发送与权限

| 变化 | 用户影响 |
| --- | --- |
| 服务端 Send Protocol | 在写入前读取两次屏幕，检查输入框、草稿和弹窗；写入后检查文本，再提交并确认。使用请求 ID 避免重复发送。结果区分已生效、已发送、只写入未提交、丢弃、拒绝和未知；中断后的未知请求不会自动重发。 |
| 忙碌时排队 | Agent 能接收时走原生队列，否则 Collie 持有消息，回合结束且连续两次确认空闲后发送；支持取消和重启恢复。文本 30 分钟、命令 10 分钟到期；结果不明确时不提供重发。危险命令不会排队。 |
| 发送反馈位置 | 拒绝、未提交、未知结果、断线等提示放在输入框下方；可跳到卡片、Screen 或 Keys。已有草稿提供追加、替换、取消，追加时保留分隔空格。 |
| 13 种输入状态与出口 | 占位文字说明输入框由什么占用；Screen 可查看原始终端，Keys 在窗格仍存在且设备有权限时可用；有弹窗时 Send 可定位卡片。 |
| 未识别界面的二次确认 | 先查看屏幕，再点 Type here；绑定所见画面并探测输入。无输入配置的 Agent 拒绝多行文本；探测失败只在能确认位置时删除探测字符。 |
| Submit／Discard | 只写入未提交的结果都提供这两个操作；检查同一画面和文本后再执行。Discard 有独立回执，手机草稿仍保留。 |
| 高频手动发送提醒 | 同一 Agent 版本 24 小时内出现五次手动确认后，第六次增加一次确认；保存脱敏样本供本地排查，不隐藏草稿或 Keys。 |
| Recent sends 与 Doctor | 会话设置可看最近十次发送、原因、按键及间隔。Doctor 展示七天识别统计，健康接口带汇总；本地统计保留十四天，样本字符脱敏，不保存消息明文，状态文件限制为当前用户可读。 |
| Codex 提交语义 | 普通消息用 Tab，忙碌时排队；Enter 留给引导。审批和信任提示绑定当前问题后发送对应按键。上游验证到 0.163.0。 |
| 更多输入配置 | 新增 OpenCode、pi、OMP、Grok、Antigravity、Muse；pi 使用 Alt+Enter（Windows 为 Ctrl+Q），OMP 使用 Ctrl+Q；OpenCode 换行用 Ctrl+J。按各自配置判断命令、草稿、队列和运行状态。 |
| Hook 回合事件 | Hook 报告开始、结束及权限状态；与屏幕判断一起阻止在错误状态写入。 |
| Claude 权限 Hook | 可通过持有的权限请求直接回答，无需模拟键盘；回答严格对应原请求，过期、重复或替换请求不能误答。 |
| 混合版本 Crew | 旧成员没有发送协议时锁住文本发送并解释原因，保留 Keys；不再无校验写入。 |

`COLLIE_SEND_PROTOCOL=0` 会关闭文本发送，不是退回旧的盲发入口。

### 主题与界面

| 变化 | 用户影响 |
| --- | --- |
| 四套主题 | 保留 Collie，新增 Nightwatch、daylight、Harbour；包含颜色、形状、密度、表面样式、UI／标题字体和终端调色板。默认主题不自动切换。 |
| 导入、导出和预览 | 主题以受限 JSON 表达；导入前校验字段与对比度，预览实际形状。拒绝任意 CSS、远程字体和未知字段。每台设备独立保存。 |
| Theme 选择框 | 设置中用选择框选择主题，浅色／深色／跟随系统仍是独立设置。 |
| 终端配色 | 新主题的 ANSI 调色板进入镜像；Agent 自己输出的真彩色不被主题替换。 |
| Harbour 暗色边线 | 提高按钮与边框的区分度，权限选项在暗色下更清楚。 |
| 键盘与顶部栏 | 打开手机键盘不会再自动折叠 tab／pane 行，保留用户最后一次选择。 |
| 翻译与文案 | 十一种翻译补齐新字符串；德文统一使用 du；英文界面句子移除破折号。 |

### Durable agents

| 变化 | 用户影响 |
| --- | --- |
| 会话模型与首页 | 无终端 Agent 成为独立 session，可与终端 multiplexer 共存；首页有专门区域，列出打开及等待中的会话，统一使用 durable agent 名称。 |
| 提问和反馈 | 支持选择、文本、短表单及权限请求，带过期时间、回执和晚到回答的说明；显示进度、副标题、徽标及富文本记录。 |
| 本机消息与操作 | 通过与终端一致的发送和回答入口交互；按 Agent 声明能力提供 Steer、Stop、自定义动作、重命名和关闭。 |
| 实验性边界 | 明确协议版本兼容规则、错误提示和退出／移除方式；Windows 私有 socket 接入提示改用 HTTPS URL。 |
| SDK 包 | `@colliepwa/durable-sdk` 0.1.0 使用 experimental 标签，源码从 examples 移到 packages；支持 Node／Bun、独立 core 和可选 Pi 入口、类型化事件与权限回执。无运行时依赖，Pi 为可选 peer；SDK Node 最低 22.19，Collie 自身运行门槛不变。 |
| 示例 | 改成小型支持台场景；Pi Durable 兼容 1.1.0／1.2.0；Cloudflare 实验移到 experiments，并固定已修补的 sharp 0.35.5。 |

本次只合入接入能力，不自动创建或部署 durable agent。

### 兼容修复

| 范围 | 修复 |
| --- | --- |
| Codex 发送 | 修复二次确认后不能发消息；忽略忙碌 spinner、计时／token 数及固定顶部提示的无关变化，让 Tab 能正常排队。 |
| Codex 0.163 statusline | 识别末尾的 `← for agents` 及其后通知，恢复输入区；上游明确未处理重复图片引用问题。 |
| Codex／Muse Resume | 将会话恢复界面显示为通用菜单，提供上下移动、恢复和退出。 |
| Claude 忙碌发送 | 空输入框在回合进行中可以原生排队，兼容 tmux 的排队提示；`/cost`、`/usage` 面板仍阻止写入。 |
| Claude 高 statusline | 按输入框边界识别，避免超过八行时写入后卡住。 |
| Claude 问题绑定 | 只绑定弹窗自身区域，避免上方工具行的闪烁导致“dialog changed”；找不到弹窗上边界时拒绝点击。 |
| Claude Agents 页脚 | 识别输入框下 main、子 Agent、更多条目及 manage 提示；其上的真实弹窗仍阻止发送。 |
| pi 信任／输入 | 支持目录信任卡片；footer 被扩展移除后仍能识别完整输入框并发送。 |
| pi 问答／超高面板 | 支持无编号选项、无 footer 的问答，以及超过窗格高度的面板；有明确按键才提供选项操作，否则保留 Esc／原生内容。Other 使用文本输入。OmO 等待提示保留可读说明。 |
| OpenCode | 更新确认框阻止普通消息，窄屏换行也能识别，避免 Enter 误确认更新。 |
| Grok 1.0.52 | 修复初始欢迎页、API key 提示、斜杠补全和参数提示的识别，增加目录信任卡片。 |
| Muse 1.4.8 | 验证斜杠命令时忽略参数提示，接受多个候选及内置 skill 行。 |
| Antigravity 1.3.5 | 补全框视为输入的一部分，Resume 显示菜单；包含额外确认的行继续原样显示。问答只发送数字，避免多余 Enter 回答下一题。 |
| tmux 3.7 | `send-keys` 因 Collie 的只读 watcher 被拒绝时，使用不指定该 client 的调用重试一次；其他错误不盲目重试。 |
| Crew 浅克隆 | 成员可以接收没有父提交的 shallow lead bundle，校验后正确记录浅克隆边界；完整历史仍按原方式处理。 |

### 工具、测试和文档

- 标签检查增加已安装 Agent 与验证版本的差异提示；可明确接受指定版本漂移，并在标签说明中记录未验证，不能把旧样本当成新版认证。
- 上游 CI 增加 Bun 最低支持版后端检查；Windows 测试补充持有队列、Hook、lab 路径及平台跳过预算。本 fork 维持既有“不恢复 GitHub Actions、不创建 GitHub Release”的发布方式，执行本机检查。
- SDK 增加 ESM／类型声明构建与独立 tarball 安装测试，Node 和 Bun 各跑权限往返，不自动发布 npm。
- Durable agents 主文档补齐安装、连接、排错、SDK、wire 和扩展页面，周边 Crew／push／CLI／skill 文档同步术语；文档首页改从 sessions 介绍产品。
- Multiplexers 文档解释 Hook 回合事件与权限持有；新增 Themes 文档；增加六份真实屏幕捕获及对应回归样本。

## 本地实现的取舍

用户在本次合并中明确选择：采用上游发送协议、保留模型／模式切换保护；Codex Resume 改用上游通用菜单。

| 被替代内容 | 合并后的行为 |
| --- | --- |
| 前端 `sendGuardedReply` 的读取／输入／轮询／提交循环及对应旧接口测试 | 普通消息和 Model／Fast 命令统一调用服务端 Send Protocol。删除重复发送循环；保留会话身份检查、取消检查、模型／模式操作互斥及结果回读。用户可以看到排队和明确的失败／未提交回执。 |
| 本地 Codex Resume 专用列表／搜索卡片 | 使用上游原生正文加上下箭头、Resume、Exit 的通用菜单。移除本地 Resume 解析和对应专用交互断言；Fork 仍由独立解析器提供已有卡片，不因共用代码而被误删。 |
| 本地 Geist UI 字体声明 | 使用上游主题系统自带的 Geist、字体列表和声明，删除重复定义；原有已选字体仍有效，另新增 Plex 和 Atkinson。Geist Mono 终端字体仍保留。 |

继续保留 Codex Model／Agents／Plan／Review／问题／工具审批卡片、Claude Settings／Agents 卡片、Hermes 历史和操作提示、Cursor 历史、紧凑操作带与面板、16px Agent tab 图标、设备字体和 PWA viewport 修复。新协议将自定义复杂卡片视为占用输入的弹窗，按钮继续走已有受保护动作，避免错误套用上游的简单回答路径。

新 profile 补充已有 Codex 单字段／关闭 statusline 样本，以及 Claude Agents 页面标题的阻挡条件。Send Protocol 复用已验证的 Codex 粒子归一化和图片占位符判断：图片数量、顺序文本和发送前空输入必须吻合，多余文字或图片拒绝提交。canary 发送工具迁移到新协议，继续只访问隔离窗格。适配台账更新 Resume 来源和 Fork 路径；新增 surface 样本标签与输入框边界记录仅是回放证据，不提升当前 CLI 的认证版本。

## 验证与交付

- 前端全量覆盖 501 个文件：36,728 项通过；4 项旧断言（Resume 已改为 menu、Claude 按钮标点更新）修正后单独重跑通过。另有 34 项预期失败、1 项跳过、71 项 todo，沿用上游标记。
- 服务端发送／Ask／Surface、canary 等 751 项检查中，747 项通过、1 项上游平台跳过；3 项日志测试原来依赖已修复的 Claude Agents 误判，改用现有的真实分歧样本。最终相关 296 项重跑全通过，包含图片占位符的正反例和 canary 窗格归属保护。更早的后端大范围检查 9,738 项通过；误用 Bun 路径子串收集到的 DOM clipboard 测试已由正确的 Vitest 全量覆盖。
- Chromium／WebKit 手机浏览器共 26 项通过、2 项按测试定义跳过：320px Resume 的导航／恢复／退出、主题首帧与字体加载、Warning 返回后的纯图片／图文／绝对路径／长文本。截图保存在 `/private/tmp/collie-v1220-e2e/` 与 `/private/tmp/collie-v1220-input-e2e/`。
- 64 项适配台账回放通过；根目录和 Web 类型检查、lint、版本一致性检查及构建通过。
- 本机为 Codex 0.163.0、Claude 2.1.302。此次使用保存的 ANSI 和模拟协议／浏览器回归，没有重新调用模型完成两款 CLI 的全套现场认证。沿用上游 profile 的验证记录，标签明确记录 `Not verified: claude 2.1.302, codex 0.163.0`，不抬高本地 verified-versions 台账。
- Windows 运行、未安装 Agent 及完整跨主机 Crew 不作为本机通过项；不启用定时 canary，不新增 durable 服务。

部署验收记录随交付补充。
