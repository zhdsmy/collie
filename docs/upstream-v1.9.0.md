# 上游 v1.9.0 变更报告

本页记录从上游 `v1.8.2` 到正式 `v1.9.0` 的完整合入范围，供下游合并和发布说明使用。

## 核对范围

上游 release 页面：[v1.9.0](https://github.com/AltanS/collie/releases/tag/v1.9.0)。完整比较：[v1.8.2…v1.9.0](https://github.com/AltanS/collie/compare/v1.8.2...v1.9.0)。

| 项目 | 结果 |
| --- | --- |
| 上游起点 | `78f74d1e3d1638a8e7889e58c610726582bafd1b`，`v1.8.2` 的 peeled commit |
| 上游终点 | `71678c20e61d000f97fe87c7782cd3c7b99b01f9`，`v1.9.0` 的 peeled commit |
| merge-base | `78f74d1e3d1638a8e7889e58c610726582bafd1b` |
| 提交数量 | 127 个 |
| 文件差异 | 299 个文件，新增 26,022 行，删除 5,377 行 |
| 起点 tag object | `5bfd5b9707ee5f4ea64b6ee05eda51b7a4264fac` |
| 终点 tag object | `2b87fb9bcc1999dae33d172af7634c840a63c035` |
| GitHub Release | [v1.9.0](https://github.com/AltanS/collie/releases/tag/v1.9.0)，2026-09-14 20:41:21 UTC，正式 release，非 draft、非 prerelease |

`v1.9.0` 是 annotated tag，正式 tag 指向 `71678c20`，而版本号提交是其父提交
`51219371`（`chore(release): 1.9.0`）。最后的 `71678c20` 只修正首屏 tour 的 reload
测试，使断言同时接受 dashboard 的 `main` 和 pane 页的 composer；合入时应保留这个正式
tag 目标，而不是只合入版本提交。

本报告以 [release body](https://github.com/AltanS/collie/releases/tag/v1.9.0)、
`git show v1.9.0:CHANGELOG.md` 和 `78f74d1e..71678c20` 的实际差异交叉核对。release body
提供 Added、Changed、Fixed 摘要、完整 CHANGELOG 链接和 `v1.8.2...v1.9.0` compare 链接；
下面的条目补充了实际 tag diff 中未在摘要单独列出的更新中屏、协议字段和工具链变化。

## Added

### 操作栏与 harness 命令

- **键盘上方增加一行 actions belt。** Keys、Type、Quick、Agent 和显示设置与 harness
  自身命令共用一条可横向滚动的操作栏；Claude Code 提供 Model、Effort、Compact、Resume，
  Codex 提供 Model、Compact、Resume，pi 和 omp 提供 Model、Compact、Tree、Resume。按钮只
  发送 harness 原生命令，由 harness 在镜像中绘制自己的选择器，Collie 不维护模型列表或
  思考等级列表。来源：[fc8d1be9](https://github.com/AltanS/collie/commit/fc8d1be9)、
  [b6176969](https://github.com/AltanS/collie/commit/b6176969)、
  [260bf295](https://github.com/AltanS/collie/commit/260bf295)、
  [cc38c2de](https://github.com/AltanS/collie/commit/cc38c2de)。
- **commands.toml 支持将命令放入操作栏。** `bar = true` 的配置行同时出现在命令面板和
  操作栏，可用 `bar_label` 设置按钮文案；每台设备可以在 Settings → Harness shortcuts
  隐藏该段，Collie 自带控制仍保留。来源：[fc8d1be9](https://github.com/AltanS/collie/commit/fc8d1be9)。
- **新增 omp Tree 快捷入口。** omp 的操作栏和命令面板都支持 `/tree`，按钮打开 omp 自己
  的会话树。来源：[cc38c2de](https://github.com/AltanS/collie/commit/cc38c2de)。

### 配置与 prompt-cache

- **新增统一 TOML 配置文件。** `~/.collie/config.toml` 为机器级配置，`.env` 所在目录的
  `config.toml` 为实例级配置；默认值、机器文件、实例文件、进程环境按层级合并，后层按
  key 覆盖前层，环境变量（包括 `.env`）优先级最高。坏 key 只回退该 key，不阻止 bridge
  启动。来源：[1df9edd4](https://github.com/AltanS/collie/commit/1df9edd4)。
- **新增 `collie config init`、`config check`、`config show`。** `init` 写出带注释的完整
  默认配置，`check` 校验一个或将要读取的配置文件，`show` 同时列出两个文件路径、有效值
  和来源。敏感值不会回显。来源：[95a2f7b1](https://github.com/AltanS/collie/commit/95a2f7b1)。
- **新增有来源和日期的 cache rule catalog。** 各 harness/provider 的 prompt-cache TTL
  记录 vendor 页面和读取日期，`cache-rules.toml.example` 允许按 rule id 覆盖 TTL；文件
  通过 mtime 重新读取，不需要重启。来源：[49484669](https://github.com/AltanS/collie/commit/49484669)、
  [74004b6c](https://github.com/AltanS/collie/commit/74004b6c)。
- **新增每个 pane 的 prompt-cache 倒计时与通知。** bridge 在 pane 所在机器测量 cache
  窗口，dashboard 与 pane header 显示紧凑倒计时，设置 sheet 提供状态、剩余时间、TTL、rule
  来源和置信度详情；可按 pane 或全局 watch，在 warm cycle 临近结束时发送一次 Web Push，
  支持 snooze。来源：
  [f12f7a63](https://github.com/AltanS/collie/commit/f12f7a63)、
  [eeedfabf](https://github.com/AltanS/collie/commit/eeedfabf)。

### 首次启动与更新中屏

- **首次启动改为一页事实摘要。** 页面说明当前镜像的 multiplexer、机器、需要用户处理的
  pane、当前设备是否可输入及 crew 机器数，并提供最多两个后续操作；每台设备只显示一次，
  Settings 可以再次打开。来源：[e8422298](https://github.com/AltanS/collie/commit/e8422298)、
  [d6d05757](https://github.com/AltanS/collie/commit/d6d05757)。
- **更新运行时增加独立 Update screen。** 发起设备看到按机器和本机下载拆分的状态行，其他
  设备看到可收起的 badge；更新运行期间应用背景设为 inert，状态由一个 reducer 和共享
  polling store 管理，覆盖 preflight、staging、restarting、verifying、done、rolled-back、
  stuck、interrupted 等状态。来源：[b32c442b](https://github.com/AltanS/collie/commit/b32c442b)、
  [0196cef9](https://github.com/AltanS/collie/commit/0196cef9)、
  [ADR 0044](../.adr/0044-the-update-screen-is-one-reducer-and-one-shared-poll.md)。该能力存在于
  实际 tag diff，但未在 v1.9.0 release body 的 Added 摘要中单列。

## Changed

### Crew 协议与兼容窗口

- **1.7.0 wire overlap 在 1.9.0 移除。** 1.8.x 为滚动升级保留的 `/pack/v1/*` 路径、`pack`
  字段兼容读取、`COLLIE_PACK_*` 预算别名、旧 `pack-*.json` 状态文件迁移及 `/api/pack`
  redirect 不再运行。1.9.0 只说 crew protocol v2；旧状态目录不会被静默接管，而是报告需要
  手工处理。来源：[fe8eec0b](https://github.com/AltanS/collie/commit/fe8eec0b)。
- **协议 floor 固定为 1.8.0。** lead 在 `collie update --check` 预检时将低于 1.8.0 的
  member 标记为 red/incompatible，说明双方版本和升级办法，阻止无法完成的 crew rollout；
  协议线上的版本拒绝规则仍保持精确匹配。来源：[6e97194c](https://github.com/AltanS/collie/commit/6e97194c)、
  [ADR 0045](../.adr/0045-a-build-below-the-protocol-floor-is-a-red-preflight.md)。
- **pane wire 增加可选 cache 字段。** 字段由 pane 所在机器计算，旧 peer 缺失时表示没有测量，
  不改变 crew protocol version，也不要求旧 lead 识别。来源：`CREW_PROTOCOL.md` 的 v1.9.0
  协议说明及相关 `bridge/cache`、`bridge/crew` 实现。

### 配置、缓存和通知

- **配置 schema 纳入 `COLLIE_CACHE_WARN_SECONDS`。** `config init`、`config show` 和 doctor
  都能识别该窗口；1.7.0 的 `COLLIE_PACK_*` 别名从 schema 中删除。来源：
  [44317201](https://github.com/AltanS/collie/commit/44317201)、
  [cdafe05a](https://github.com/AltanS/collie/commit/cdafe05a)。
- **cache reading 进入统一的 pane 元数据。** agent card 移除易误读的 relative-time chip，
  dashboard name line 和 pane header 复用带 hourglass/thermometer 图标的倒计时；green 表示
  warm、red 表示临近过期、blue 表示已 cold。来源：[cd70aa30](https://github.com/AltanS/collie/commit/cd70aa30)、
  [cc5965d3](https://github.com/AltanS/collie/commit/cc5965d3)、
  [d3a52e25](https://github.com/AltanS/collie/commit/d3a52e25)。
- **actions belt 改为紧凑胶囊带。** Collie 控件与 harness 控件采用各自色调的连续区域，
  Switch 固定在右侧边界，拖动可切换 pane 或横向滚动；按钮保持可触控尺寸，右侧只保留一个
  scroll fade；最终 belt 为 32px，并修正 WebKit 垂直 overflow。来源：
  [9b530786](https://github.com/AltanS/collie/commit/9b530786)、
  [931f857a](https://github.com/AltanS/collie/commit/931f857a)、
  [5e7f626c](https://github.com/AltanS/collie/commit/5e7f626c)、
  [63513aee](https://github.com/AltanS/collie/commit/63513aee)。
- **key rail 在边缘提示仍有更多内容。** 可横向滚动的快捷键行增加 chevron/edge cue，避免
  屏幕只显示部分按钮时被误认为已经到底。来源：[abccd401](https://github.com/AltanS/collie/commit/abccd401)。
- **pane 状态词移出 Composer。** Composer 上方不再重复显示机器和 pane 状态，状态保留在
  header 的状态点和 dashboard。来源：[adaa1fb3](https://github.com/AltanS/collie/commit/adaa1fb3)。

### Dashboard、pane header 与身份

- **pane 名称和位置重新分层。** 所有 surface 使用同一 pane name fallback 链；workspace 与
  tab 移到第二行，pane header 的第二行只显示 workspace，machine/cache 元数据与路径线对齐，
  actions belt 不再承载机器名。来源：[6e8eeafc](https://github.com/AltanS/collie/commit/6e8eeafc)、
  [931f857a](https://github.com/AltanS/collie/commit/931f857a)。
- **dashboard 按 workspace 分组并保持 multiplexer 顺序。** Needs you 仍按紧急程度置顶，
  其余 pane 按 machine/workspace/tab/pane 的原生顺序归组；attention row 与普通 row 统一为
  44px，未读 pane 在名称旁显示小圆点。来源：[64b6f499](https://github.com/AltanS/collie/commit/64b6f499)、
  [10cd0557](https://github.com/AltanS/collie/commit/10cd0557)、
  [458876bf](https://github.com/AltanS/collie/commit/458876bf)、
  [6e8eeafc](https://github.com/AltanS/collie/commit/6e8eeafc)。
- **tab/pane strip 变紧凑。** tab row 为 32px，pane pill 为 24px、11px 文字但保留 44px
  触控区域；打开 tab 使用 outline，不再绘制多余水平线，Unnamed tab 在各 surface 显示
  `tab N`。来源：[c2a16502](https://github.com/AltanS/collie/commit/c2a16502)、
  [583e561d](https://github.com/AltanS/collie/commit/583e561d)。
- **tmux 自动命名窗口显示工作目录。** automatic-rename 开启时，窗口显示 active pane 的
  最后目录；用户手动命名的窗口保持原名。来源：[f90b7410](https://github.com/AltanS/collie/commit/f90b7410)。

## Fixed

### 输入、链接与终端内容

- **wrapped Codex question card 可识别。** question、description、`esc to interrupt` 各自
  被终端换行时，parser 按列位置重新拼接到原卡片，保留原有数字选择与 stale-send 防护。
  来源：[9c91c51b](https://github.com/AltanS/collie/commit/9c91c51b)、
  [7b842741](https://github.com/AltanS/collie/commit/7b842741)，对应 [PR #201](https://github.com/AltanS/collie/pull/201)。
- **终端换行 URL 恢复为单一链接。** 当 URL 贴到 pane 行尾时，bridge 额外读取
  `recent_unwrapped`，向 `logicalText` 提供去掉软换行的文本；客户端仅在后续行逐字符连续
  且前缀确实是 URL 时合并，避免误把普通文本拼成链接。来源：
  [38044cd4](https://github.com/AltanS/collie/commit/38044cd4)、
  [a980e3f4](https://github.com/AltanS/collie/commit/a980e3f4)，对应 [PR #212](https://github.com/AltanS/collie/pull/212)。
- **历史页使用设置中的 terminal font。** full transcript 与实时 mirror 使用同一字体选择。
  来源：[e44d35c8](https://github.com/AltanS/collie/commit/e44d35c8)，对应 [PR #216](https://github.com/AltanS/collie/pull/216)。
- **pane 标题不再重复显示原始 pane id。** 未命名 tab 的位置元数据移到对应行，避免
  switcher 标题同时显示 tab 名和 `p3` 一类内部 id。来源：[2eefd38e](https://github.com/AltanS/collie/commit/2eefd38e)。

### Crew、更新与文件系统

- **plain HTTP member 不再误报证书拒绝。** doctor 与 crew status 根据实际响应协议说明
  plain HTTP，而不是把它当作 TLS certificate failure。来源：[80e262d7](https://github.com/AltanS/collie/commit/80e262d7)。
- **多 agent push 通知显示 pane 名称。** 通知不再重复显示 `claude, claude, claude`，按
  `paneLabel -> sessionName -> 非 stale terminalTitle -> agent` 选择名称，并在名称仍冲突时
  加入 workspace。来源：
  [15f9db67](https://github.com/AltanS/collie/commit/15f9db67)，对应 [PR #215](https://github.com/AltanS/collie/pull/215)。
- **peer Space 使用 addressed host 作为 key。** peer 与 lead 中相同编号的 workspace 不再
  互相覆盖未读标记或 pane 顺序。来源：[2fc6a3a0](https://github.com/AltanS/collie/commit/2fc6a3a0)，对应 [PR #209](https://github.com/AltanS/collie/pull/209)。
- **hooks install 支持符号链接的 `~/.claude` 目录。** 会跟随被链接的目录，但仍拒绝自身为
  symlink 的 settings 文件，并给出可操作的只读/悬空链接错误。来源：[ae078d89](https://github.com/AltanS/collie/commit/ae078d89)，对应 [PR #190](https://github.com/AltanS/collie/pull/190)。
- **macOS 更新 runner 脱离 launchd process group。** 没有 `systemd-run` 或 `setsid` 时使用
  detached child，避免 bridge reload 杀死刚启动的 updater；Linux `systemd-run` 路径保持
  attached，并统一处理 spawn 失败。来源：[eeadde63](https://github.com/AltanS/collie/commit/eeadde63)，
  对应 [PR #213](https://github.com/AltanS/collie/pull/213)。

### Cache 稳定性与诊断

- **`/compact` 后保持已有 cache reading。** transcript 没有新 turn 时保留上次测量并继续
  倒计时，而不是永久清空。来源：[05065d54](https://github.com/AltanS/collie/commit/05065d54)。
- **cache measurement 使用真正命中的 rule。** Claude subscription 的一小时窗口不再
  错用 API 五分钟页面，sheet 同时显示实际 rule 的 source/date。来源：[068e2e28](https://github.com/AltanS/collie/commit/068e2e28)。
- **doctor 不再把注释 cache rule 当作有效配置。** 只有校验通过的行参与 `cache-env`，未来
  `retrieved` 日期也会被拒绝。来源：[8f8d149f](https://github.com/AltanS/collie/commit/8f8d149f)。
- **倒计时跨 poll 保持稳定。** 短暂 probe failure 或组件未挂载时保留旧读数，只有新结果、
  explicit cold 或 pane 离开才替换/清除，避免视觉闪烁。来源：[d777c559](https://github.com/AltanS/collie/commit/d777c559)。
- **多 Herdr session 不再互相清除 cache。** tracker 只回收当前 session 的离开 pane，另一
  session 的 reading 不会被无关 poll 删除。来源：[22c79342](https://github.com/AltanS/collie/commit/22c79342)。
- **五分钟 TTL 的 pane 能及时触发 push。** 当配置 warning window 长于 pane cache lifetime
  时，使用 pane lifetime 的一半作为 warning 时点，覆盖 Codex、OpenCode、pi 和 omp。来源：
  [d2811bc9](https://github.com/AltanS/collie/commit/d2811bc9)。

## 文档、协议和工具链

- 新增 ADR 0040（配置优先级）、0041（cache rules 来源）、0042（通知与 cache watch）、
  0043（bar row 与 palette 的边界）、0044（update screen 单 reducer/shared poll）和
  0045（protocol floor preflight），并更新 `.adr/README.md` 索引。
- `docs/configure.md` 补充 config.toml、commands bar、cache-rules；`docs/commands.md` 增加
  config 命令；`docs/crew.md`、`docs/install.md`、`docs/multiplexers.md`、`docs/troubleshooting.md`、
  `docs/upgrading.md` 和 `docs/voice-and-push.md` 更新 crew、首次启动、缓存和更新中屏说明。
- `CREW_PROTOCOL.md` 明确 1.8.0 protocol floor、1.7.0 overlap 删除、pane cache 可选字段；
  `HERDR_API.md` 记录 `recent_unwrapped`/`logicalText` 的 URL 修复契约；README 更新 dashboard
  分组和截图说明。
- `scripts/collie-cli.test.sh` 增加 config init/check/show、权限、优先级和秘密不回显的编译后二进制
  集成覆盖；web 增加 tour、update screen、cache、actions belt、pane grouping 等单元和 E2E
  场景。实际差异同时新增/更新大量 bridge、CLI、web 测试，不应只按 release 页面摘要裁剪。
- `web/tsconfig.json` 开启 `resolveJsonModule` 并纳入 playground fixtures；`.oxlintrc.json`
  扩展新增 config/cache 文件的输入边界规则；三个版本文件（`herdr-plugin.toml`、根目录
  `package.json`、`web/package.json`）统一为 `1.9.0`。AUR/Nix source metadata 在该 tag 仍
  指向已发布 `1.8.2` tarball，不能把它误读成 `1.9.0` 的二进制 checksum 发布。
- 上游 `scripts/collie-cli.test.sh` 的新增配置集成测试还覆盖安全模式 `0600` 文件、未知 key
  回退和 `.env` 优先级；更新 runner 的测试覆盖 Linux `systemd-run`、macOS detached child、
  spawn 失败及 crew preflight 的 protocol floor。

## Release 页面与升级指引

v1.9.0 release body 的可执行升级入口如下：

```bash
collie update                                              # install.sh 或 tarball 安装
herdr plugin action invoke update --plugin herdr.collie    # Herdr plugin 安装
```

完成后用 `collie version` 或对应 Herdr `version` action 核对。0.x 用户不能直接执行
`collie update` 跨越 major，应使用 `herdr plugin action invoke update-major --plugin
herdr.collie`、checkout 中的 `bin/collie update --major`，或重新执行安装脚本。

发布页还给出 tarball 完整性核验：下载 `.tar.gz` 和 `.sha256` 后，在 Linux 使用
`sha256sum -c`，macOS 使用 `shasum -a 256 -c`。该校验只能发现下载损坏或截断，不能单独证明
构建者身份；HTTPS 和固定的 github.com 主机仍是传输信任边界。

## 下游替换与保留

下游起点为 `v1.8.2+collie.22`（`9f5ac43d`），交付版本为 `v1.9.0+collie.1`。
采用合并提交保留上游历史；相同或相近的功能优先采用上游，以下列出实际取舍。

### 已被上游实现替换的下游改动

| 功能 | 合并前的下游行为 | 本次采用的上游行为 | 用户可见差异 |
| --- | --- | --- | --- |
| 多智能体通知命名 | 摘要使用 workspace/会话名，重名时附加 pane id；单条附带 cwd | 统一使用 `paneName` / `panePlace`，摘要重名时附加位置 | 摘要与 dashboard 的名称一致；单条正文改为 workspace/tab，不再展示绝对目录。同名且同位置的 pane 仍可能重名，这是上游保留的边界 |
| Codex 折行问答识别 | 下游自行识别完整问题、选项和备注，部分终端折行形态无法识别 | 采用上游的问题拼接、选项说明列位置校验和独立 `esc to interrupt` 尾行处理 | 折行问题继续显示为卡片；原有回看前题、修改答案和备注输入仍保留，不退回上游的纯选项按钮交互 |
| 快捷操作栏与窗格入口 | 下游四按钮布局，直接输入展开附件键盘，标题栏单独放置窗格切换入口 | 采用上游 actions belt、独立 Keys/NavTray、固定 Switch 入口及 per-surface 命令配置 | 按键和直接输入分为两个入口，按键支持排队；Switch 移到操作栏右侧；保留直接输入不自动聚焦和安全区行为。Agent 命令仍使用下游三行、底部搜索的内嵌面板 |
| 窗格标题与设置 | 下游沿用旧标题布局，专注模式位于外层 | 采用上游统一名称/位置层级、cache 详情、pane settings 及菜单内专注模式入口 | 名称与 workspace 分层展示，缓存详情进入统一设置入口；专注模式回到三个点菜单，仍受设置开关控制 |

缓存监测、统一配置文件、首次启动 tour 和 Update screen 是本次新增的上游能力，
不是对原有下游同名功能的替换。终端 URL 修复也只处理链接，不恢复曾撤回的全文换行补丁。

### 仍保留的下游差异

- **iOS PWA 底部安全区。** 保留 `useAppViewport`、固定应用根节点和 Composer 向下覆盖
  安全区的实现；新 tour / Update screen 接入同一根节点，阻塞层保持在 inert 内容之外。
  上游没有覆盖此前真机发现的底部空白问题，不换回单独的 `100dvh` 布局。
- **输入稳定性与直接输入。** 保留输入 guard、签名核对、图文/多图/绝对图片路径处理，
  以及打开直接输入时不自动聚焦的行为。这些控制真实终端输入，不能被 UI 合并绕过。
- **紧凑 statusline 和模式控制。** 保留模型/思考等级、session 关联的最近模型、自动切换
  过程与面板遮罩，保留 Plan / Fast 的状态、禁用规则和点击切换；保留 context 圆环及颜色、
  分支与版本图标、横向滚动和多主机发送目标。Claude 模式点击循环也保留。
- **Codex 卡片。** 保留模型、思考等级、statusline、问答、Plan、命令审批与 review 卡片，
  Plan 正文 Markdown、长命令展开、多问题导航及卡片内备注；上游问答折行识别接入现有
  `PickerModel` 和 guarded action，不扩散到其他 agent。
- **终端内容视觉。** 保留 Codex / Claude / Hermes 的输入、diff 长方形背景与等宽留白，
  Codex 动画背景点适配、Hermes 圆弧分隔线、底部状态与操作提示。普通正文和 diff 的一般
  换行规则继续跟随上游，不重新引入猜测式全文拼接。
- **字体、图标与语言。** 保留 Geist / Geist Mono web font、官方 Hermes 素材、Cursor 图标，
  以及下游快捷回复的显示/发送语言一致和相关文案。
- **已读通知生命周期。** 名称交给上游，`onSeen`、activity 已读记录及 crew 已读传播继续
  保留，避免旧提醒在用户已经查看或输入后残留。
- **发布约定。** 版本使用 `上游版本+collie.N`，继续隐藏 dev/dirty 展示后缀；只推送提交
  和 annotated tag，不恢复 GitHub Actions，不创建 GitHub Release。
- **macOS 测试兼容。** CLI 集成测试按平台判断 detached update handoff；beacon 在 Linux
  校验真实文件，在 macOS 校验无 `/proc` 时静默不写文件。生产行为保持上游设计。

## 迁移注意

- 先将所有 crew member 更新到 `1.8.x`，再把 lead 更新到 `1.9.0`；低于 1.8.0 的 member 会
  在预检中阻止 crew update。
- 1.7.0 的 `/pack/v1/*`、`pack` wire 字段、`COLLIE_PACK_*` 和旧状态文件不再被 1.9.0
  兼容读取；旧状态目录按上游协议文档提示手工迁移，不能假设自动 rename 仍存在。
- 修改 `config.toml` 后需要 `collie restart`；修改 `commands.toml`、`cache-rules.toml` 等
  独立操作文件仍按各自文档的 live-reload 规则生效。
- macOS 更新 runner 的 detached 行为是为了跨 launchd reload 保持 updater；不要把它改回
  bridge 自身 process group，也不要在本地验证中重启不属于测试范围的服务。

## 验证范围

- 后端 3,304 项、CLI 1,460 项、脚本 Bun 测试 82 项通过；CLI 编译后二进制集成测试、
  bootstrap、版本/标签、payload、flake、pre-commit 和 packaging shell 检查通过。
- 前端完整运行 257 个测试文件；255 个直接通过，剩余两份 Composer/AgentChat 测试按
  新的上游布局调整后定向复验通过。保留发送 guard 和直接输入不自动聚焦的验证，新增
  按键队列必须确认丢弃后才能进入 Type、队列不会在重开后复活的验证。
- 58 项手机浏览器场景通过：320/390 宽度、亮暗色、中英德语言布局、三行命令面板、
  最近模型/模型切换过程、Plan/Fast、问答/备注、Plan 正文、审批/review 和首次启动 tour。
- 根目录及 web 类型检查、全树 lint 通过。上游原始终端 capture 的行末空格原样保留，
  以免破坏列位置证据；代码和文档的 whitespace 检查通过。

这轮使用隔离 API fixtures 运行浏览器验证，没有往现有智能体会话发送测试输入。
本机交付复用正式构建产物，备份后只重启 Collie，并核对本地和 Tailnet 的 build ID。
