# 上游 v1.17.0 跟进报告

下游基线为 `v1.16.2+collie.1`，本次目标为 `v1.17.0+collie.1`。
已交叉核对上游 [Release](https://github.com/AltanS/collie/releases/tag/v1.17.0)、
[CHANGELOG](https://github.com/AltanS/collie/blob/v1.17.0/CHANGELOG.md#1170---2026-10-06)
及 [v1.16.2 → v1.17.0 完整差异](https://github.com/AltanS/collie/compare/v1.16.2...v1.17.0)：
136 个提交、302 个文件，新增 29,002 行、删除 1,582 行。上游标签实际指向
`ab7e8ebf`，包括版本提交 `a6dee7bf` 之后的一次 Windows 测试修正。

## 新增功能

### Files：浏览工作目录，文件与修改合并查看

- 原 Changes 页面改名为 **Files**，默认显示工作目录，一次浏览一层；顶部
  **All files / Changes** 切换文件列表和原修改列表，选择保存在当前设备。
  Changes 显示修改文件数及增删行数，List / Tree 改成一个 Tree 按钮。
- 修改文件显示状态字母、颜色和图标，文件夹显示修改数量；未跟踪文件及其目录内容
  按新增标记，已删除文件仍出现在树中，以删除线和 D 表示。修复嵌套仓库、根目录位于
  未跟踪目录内、仓库在浏览根目录上方，以及 Windows 大小写不同导致的标记或定位问题。
- 修改文件默认打开 Diff，另可切换 Source；Markdown、JSON、HTML 可切换 Preview。
  普通代码按行号和语法着色显示，长行折行并限制渲染量。Markdown 使用文档标题字号，
  JSON 可折叠树节点，HTML 放进无脚本、无远程资源的沙箱 iframe。
- Markdown 的相对链接打开根目录内的文件或目录，`#heading` 滚动到标题；网页链接
  在新标签打开，越界链接只显示文字。图片显示 alt 文本，不加载图片；补充引用链接、
  徽章与带括号 URL 支持，并限制解析复杂度，修复带填充空格的表格分隔行卡住解析。
- 默认隐藏 git 忽略项，底部显示隐藏数量和 Show / Hide；Filter 提供名称过滤。
  **隐藏忽略项仅是显示过滤，不能阻止直接读取。** 目录和文件只在打开或刷新时读取，
  不定时轮询；修改状态仍来自原 Changes 列表。返回从文件到目录，再逐层向上。
- 新增 pane / workspace 的 `GET …/files`，`?dir=` 列目录、`?path=` 读文本，
  每层最多 2,000 项、文件最多 1 MiB。旧 crew 成员提示升级；目录不可用或设备无权限时，
  页面仍提供 Show changes，保留原修改查看能力。

来源：[`307bd004`](https://github.com/AltanS/collie/commit/307bd004)、
[`07251d41`](https://github.com/AltanS/collie/commit/07251d41)、
[`755ac1b0`](https://github.com/AltanS/collie/commit/755ac1b0)、
[`c0a171b5`](https://github.com/AltanS/collie/commit/c0a171b5)、
[ADR 0083](https://github.com/AltanS/collie/blob/v1.17.0/.adr/0083-the-files-view-reads-the-changes-root.md)。

**Files 的实际权限边界：** 根目录取自现有 workspace / pane，而非由客户端指定；拒绝 `/`、
用户主目录及其上级作为根，拒绝路径穿越、越界符号链接、`.git`、本 Collie 状态与配置目录，
以及其他位置同名的 Collie 状态秘密文件。Windows 另拒绝设备名、数据流、尾部点或空格和
8.3 短名称绕过。设备按写权限规则检查，但只有启用 pairing 或 `COLLIE_DEVICE_HEADER`
才形成设备限制：未启用时，能读 panes 的设备也能读工作根目录下的文件，包含 `.env`。
上游明确承认，若工作目录设在 `~/.claude`、`~/.codex`、`~/.config/gh`、`~/.ssh`，其中
凭据也可能被读取；硬链接到根外文件仍可读，检查后替换父目录的竞态也未完全封闭。
POSIX 的最终文件使用 `O_NOFOLLOW` / `O_NONBLOCK` 并检查普通文件；Windows 没有同等标志。
这些是此版本的实际边界，不能把“只读”或“隐藏忽略项”等同于敏感文件保护。

### Machines：机器状态、24 小时历史及持续负载提醒

- Settings 新增 Machines，crew 的 Crew 标签也显示机器卡片，lead 排在前面。
  单机部署可查看本机；显示 CPU、内存、负载、网络速率、最满磁盘和近半小时小图。
- 机器详情分 **Status / Alerts**。Status 展示磁盘条及 CPU、内存、最满磁盘、网络的
  1 小时或 24 小时图；缺失分钟保留空白，不伪造零值。Alerts 可为 CPU、内存、磁盘设定
  80% / 90% / 95% 阈值，连续达到 5–60 分钟才提醒一次。卡片指出触发规则，跳转 Alerts；
  推送打开机器 Status。全局“Machine load stays high”开关默认开启，可一次禁用所有规则。
- 采样复用已有 tick，通常每 15–25 秒；lead 在机器页有人查看时每 5 秒采样。
  前端机器列表每 15 秒读取，详情先读一天、再每分钟只取新增点，离开页面停止相关读取。
  每分钟保存一点，保留 24 小时；每台机器约 68 KB 内存，有变化时最多每 5 分钟落盘。
- 磁盘后台异步读取，每分钟最多一次，涵盖 home、系统根和 Collie state 所在文件系统，
  去重后最多 4 个；排除小于 1 GiB 和已满的只读系统镜像，普通满盘仍显示。
  Linux 网络只统计物理网卡，避免桥接、容器、隧道重复计数；其他系统无此网络读数，
  Windows 不提供 load average。
- 离线机器显示最后读数年龄；两分钟没有新样本时将读数变灰。旧成员显示需升级，
  不提供无效规则控件。修复重复样本、系统时钟前后跳、历史保存竞态、成员移除、lead
  降级和空增量响应的处理；权限拒绝时明确提示配对。
- 这是持续高负载提醒，不是离线提醒。历史和规则由当前 lead 保存，不做接管同步；
  deputy 接管从空历史、空规则开始，单机转 lead 时丢弃原单机历史。数据不离开 crew。

来源：[`1d648e46`](https://github.com/AltanS/collie/commit/1d648e46)、
[`4287d475`](https://github.com/AltanS/collie/commit/4287d475)、
[`dd9a685c`](https://github.com/AltanS/collie/commit/dd9a685c)、
[`ba89ed79`](https://github.com/AltanS/collie/commit/ba89ed79)、
[ADR 0084](https://github.com/AltanS/collie/blob/v1.17.0/.adr/0084-machines-report-their-load.md)。

### Tern、排序与快捷回复

- **Tern multiplexer 实验支持。** `COLLIE_MUX=tern` 显式启用，不由 `collie start`
  自动发现。基于 Tern 0.4.5 实测，session / tab / block 对应 workspace / tab / pane；
  支持带颜色画面、scrollback、文本和按键、聚焦、创建/重命名/关闭 tab，智能体识别依赖
  beacon hooks。新增 `COLLIE_TERN_BIN`、`COLLIE_MUX_ENDPOINT_TERN`；程序来自固定路径
  或明确配置，不从 PATH 任意挑选。Tern 未运行按断开处理。
  [PR #356](https://github.com/AltanS/collie/pull/356)、
  [`3e4a8c95`](https://github.com/AltanS/collie/commit/3e4a8c95)。
- **Dashboard 支持 Activity / Cache 排序。** 与 PaneSwitcher、Settings 共用设备设置，
  Place 仍默认按 workspace 分组；其他排序平铺、置顶 pane 优先且标注 workspace。
  排序在进入时固定，轮询不让条目跳动；已有 Activity / Cache 选择会直接作用到 Dashboard。
  [`e8ce0cff`](https://github.com/AltanS/collie/commit/e8ce0cff)。
- **Quick 增加 “drastically simplify”。** 使用自定义 `quick-replies.toml` 的用户需在
  自己文件中添加，继续遵守自定义列表替换内置列表的规则。
  [`954584f8`](https://github.com/AltanS/collie/commit/954584f8)。

## 默认行为与界面调整

- **Chat 成为智能体 pane 的默认视图。** 移除 Experiments 中的 Chat 开关；新 pane
  即使还没有 Codex session 或 pi 日志，也先显示 Chat 及启动提示。已有明确 Terminal
  选择保留，⋮ 菜单可切回 Terminal。需要回答原生问题、首轮结束却读不到日志等事件会
  回退；持续工作一分钟仍读不到内容且没有事件时保留最终兜底。服务端明确无法读取时
  不再显示假空白对话。Hermes 自身日志仍可能丢失轮次，上游文档明确保留此限制。
- **启动智能体动画与 Chat 切换合为一次过程。** 遮罩盖住画面后切换，动画自身短暂停留
  结束即退出，不等待 session 或首条回复。发送输入、新智能体 pane 暂无 session 时，
  bridge 数次加快已有轮询；crew 转发同时加快 owning member 和 lead，及时拿回画面。
- **底部导航改为 Crew / Dashboard / Files。** 单机仅 Dashboard / Files，crew 的
  Dashboard 位于中间。原 Focus 标签变成 Dashboard 上的 circle-dot 开关；已选 Focus
  的设备迁移为 Dashboard 加开启开关。Crew 只在有 crew 时显示，暂时失去 crew 不清空
  已保存选择；红色待处理数量移到 Dashboard。pane 操作带的 Changes 也改名 Files。
- **pane 顶部分成两个点击区域。** 名称打开 Pane settings，workspace 行返回对应
  workspace；Pane settings 新增 Rename，与 ⋮ 的重命名使用同一页面。
- **Dashboard 状态摘要固定一行。** 状态少时显示文字，多于两个状态改为彩点和数字，
  特大计数在右侧淡出；无障碍名称仍包含完整文字，不因排序按钮挤压而加高。

来源：[`a15d0582`](https://github.com/AltanS/collie/commit/a15d0582)、
[`ca175867`](https://github.com/AltanS/collie/commit/ca175867)、
[`80264e3e`](https://github.com/AltanS/collie/commit/80264e3e)、
[`9dbcf277`](https://github.com/AltanS/collie/commit/9dbcf277)、
[`335a3118`](https://github.com/AltanS/collie/commit/335a3118)、
[ADR 0082](https://github.com/AltanS/collie/blob/v1.17.0/.adr/0082-chat-is-the-default-view-of-an-agent-pane.md)、
[ADR 0085](https://github.com/AltanS/collie/blob/v1.17.0/.adr/0085-the-dashboards-tabs-are-dashboard-crew-and-changes.md)。

## 其他修复

- **opencode 侧栏不再污染草稿、输入框及问题卡片。** 同行侧栏内容从草稿读取及发送验证
  中排除；多选、多标签问题在自由输入项未激活时忽略其下方侧栏行，已提交文本仍保留。
  自由输入项真正打开时继续保守回退。补齐 v1.16.2 尚未覆盖的多标签情况。
  [PR #352](https://github.com/AltanS/collie/pull/352)、
  [PR #362](https://github.com/AltanS/collie/pull/362)、
  [issue #347](https://github.com/AltanS/collie/issues/347)。
- **iOS 主屏幕 PWA 填满底部。** 页面统一读取 `--app-h`，使用主屏幕应用的实际高度，
  避免底栏和输入区悬在 home indicator 上方的空白带。
  [PR #355](https://github.com/AltanS/collie/pull/355)。
- **macOS launchd 启动确认真实 PID。** bootstrap 成功后执行不带 `-k` 的 kickstart，
  最多 2 秒读取实际 PID；无 PID 则提示“已加载但未运行”、手动命令和日志路径，不再谎报
  已启动。返回码仍为 0，与既有 systemd 行为一致；上游注明未在 macOS 26 现场验证。
  [`f1ce4768`](https://github.com/AltanS/collie/commit/f1ce4768)、
  [issue #213](https://github.com/AltanS/collie/issues/213)。
- **全局缓存过期提醒开关可持久保存。** bridge 之前丢弃请求中的开关键，导致刚打开又
  弹回；单 pane 的 watch 不受此旧问题影响。
  [`ddb41eb1`](https://github.com/AltanS/collie/commit/ddb41eb1)。
- **tmux 无 UTF-8 locale 时仍能列出 pane。** 所有命令使用 `-u`，保留字段分隔符和
  非 ASCII 名称，避免最小容器或 systemd 环境误报断连。
  [PR #360](https://github.com/AltanS/collie/pull/360)、
  [issue #358](https://github.com/AltanS/collie/issues/358)。
- **crew 成员离线不再归咎 lead 的 Herdr。** 仅本机或 lead 有证据时报告 multiplexer
  故障；成员页根据 roster 说成员不可达或其 Collie 不可达，无证据时保持一般连接提示。
  [PR #361](https://github.com/AltanS/collie/pull/361)、
  [issue #357](https://github.com/AltanS/collie/issues/357)。
- **Claude 模式徽标不再冒充会话名称。** 使用输入框边线的颜色判断 `/rename` 名称与
  `ultracode` 等模式徽标，屏幕明确没有名称时清掉旧缓存；无颜色的 multiplexer 输出仍有
  误判限制。此变更是 bridge 会话名识别，不是移除 Claude 模式卡片。
  [PR #363](https://github.com/AltanS/collie/pull/363)。
- **小屏与内容显示细节。** Files 深路径从左截断，标题避免重复，375px 多段控件不再
  截字，过滤控件可换行；修改树目录计数与名称对齐。Chat 代码、JSON 树与工具卡片关闭
  字体连字。机器图表保持字号，报警数字使用红色；Crew 页面不再携带 pane 专属顶栏。

## 兼容性、文档和构建

- Crew 协议保持 **2**。Files 路由、crew snapshot 的可选 `machineStats` 和其中可选 `disks`
  为 additive optional：旧 peer 缺字段表示无样本，不解释为 0；新 Files 路由 404 明确
  提示升级。Files 转发仍走只读预算，但成员独立执行设备写权限检查。
- 新增 `machine-history.json`、`machine-alerts.json`；前者按变化节流保存，后者首次设置
  规则才创建。面向浏览器的机器数据独立于 `/api/snapshot`，不因采样改变该接口的内容和 ETag。
- 文档更新 Files、Machines、Tern、Chat 默认与日志限制、机器提醒、部署/诊断说明；
  `ARCHITECTURE.md`、`CREW_PROTOCOL.md`、`MUX_CONTRACT.md`、`DESIGN.md` 和 README
  同步新边界。新增 ADR 0082–0085，并注明旧 Focus / 底栏 / 排序决策的后续变化。
  `cli docs` 的内嵌 multiplexer 说明、环境变量示例、快捷回复示例一并更新。
- 新增 Files 与 Machines 的 bridge → web 契约测试及 `tsconfig.contract.json`，根目录
  `typecheck` 现在同时检查此配置。lint 的运行时类型检查例外限定到 Tern 协议解析和
  machine-parse 的输入边界；没有新增运行时依赖，没有更新依赖锁或 flake 锁。
- 新增/更新文件路径与权限、机器采样/图表/告警、Tern 原始捕获与 mux 合约、Chat 启动和
  回退、Dashboard 导航排序、窄屏与跳转等单元/组件/E2E 测试。标签包含的最后一个提交修正
  Windows 的路径断言及 Files 测试，共 2 文件 3 行修改，没有新增运行时代码。
- AUR `PKGBUILD` / `.SRCINFO`、Nix `sources.json` 实际更新到 **上游 1.16.2** 的
  下载地址和校验和，保持上游此标签的实际内容，不能描述为已发布 1.17.0 包。

## 下游取舍

本次由上游替换或调整的下游行为如下；没有删除其他定制卡片或恢复已移除的旧版兼容代码。

| 重叠位置 | 原有下游行为 | 本次替换与用户可见差异 |
| --- | --- | --- |
| Chat 默认 | Chat 由实验开关控制，保留设备视图偏好 | 采用上游默认 Chat 和启动/回退时序，移除 Chat 实验开关；已明确选择 Terminal 的设备继续使用 Terminal。 |
| Dashboard 导航与排序 | 原有 Dashboard / Focus / Changes 布局与排序入口 | 采用 Crew / Dashboard / Files，Focus 改开关；Dashboard 复用 PaneSwitcher 的 Activity / Cache 排序设置。 |
| Changes 页面及操作带入口 | Changes 仅查看工作区修改 | 采用合并 Files 页面及预览，操作带入口改名 Files，原 Changes 功能在页面第二个选项中保留。 |

继续保留的下游差异及原因：

- **iOS viewport 修复继续使用。** 保留本地 `useAppViewport`、`h-full` 与已实测的视觉视口
  高度及平移处理；不以单一 CSS 高度替换它们。上游 `--app-h` 保留供其他页面引用。
- **定制界面继续使用。** 保留紧凑操作带、弹层、小 Esc 与二次确认、固定滚动卡片、
  16px Agent 图标及 Codex / Claude / Hermes 等已适配卡片，避免改变此前明确选择的操作方式。
- **Experiments 仍有入口。** 上游移除 Chat 开关后，本地下游的 rejoin 折行合并实验和
  `ExperimentCard` 仍需使用该设置区，因此保留此区，不因上游默认 Chat 而一并删除。
- **通知沿用本地清理逻辑。** 保留 silent / retraction 行为，并在 `displayPush` 传递
  上游新增 `machine` 字段，确保机器提醒能打开对应详情，兼容现有已读清理。
- **快捷回复维持本地多语言规则。** 新增 simplify 话术纳入本地 7 种语言的显示与发送，
  而非只增加一个英文界面条目；自定义快捷回复文件的替换规则不变。
- **交付方式保持。** 只推代码和 annotated tag，不恢复 GitHub Actions、不创建 GitHub
  Release；部署本机 macOS 安装，只重启 Collie，不涉及 Headroom 或其他服务。

## 验证

- 前端 376 个测试文件通过：22,636 项通过，33 项已登记预期失败，74 项 todo。
- bridge 4,658 项、CLI 1,910 项通过；CLI 另有 1 项 Windows 专属用例跳过。
  scripts 初次 267 项通过、46 项跳过，唯一失败是本次 Unreleased 条目缺分类标题；
  补齐后 release-notes 40 项通过。适配台账新增 opencode 侧栏捕获并回放通过。
- 根目录（含 bridge/web 契约）与 Web 类型检查、全树 lint 通过。
- Dashboard、Files、Machines 的 Chromium / WebKit 共 84 项 E2E 全部通过，覆盖
  320px 固定导航、文件预览/链接/HTML 沙箱、机器告警与图表；截图保存于本机
  `/private/tmp/collie-v1170-e2e-results/`。已查看三个主页面的 WebKit 截图。
- 原始 ANSI 捕获保留字节及尾部空白；源码差异检查通过。未调用模型、操作现有
  智能体对话，也没有新增定时检查。WebKit 是模拟引擎，非 iPhone 真机手势验证；
  Tern 与 Windows 为代码/样本覆盖，没有宣称本机运行了对应环境。
- 首次将 bridge、CLI、scripts 合在一个 Bun 进程并与前端并行运行时收到 SIGKILL；
  改为按仓库入口分别顺序运行后完成，未为该环境问题改产品逻辑。

## 交付

版本为 `v1.17.0+collie.1`，正式产物由根目录 `bun run build` 从干净版本提交生成。
推送 main 和本次 annotated tag 后更新 Herdr 管理的本机安装，只重启 Collie。
部署以本地与 Tailnet 的 `build-info.json`、`x-collie-build`、配置/快照/健康接口回读
为完成条件；完整回滚放在 state 的 `deploy-backups/`，成功后仅留上一版。
最终提交号和实际部署构建标识随交付回复提供。
