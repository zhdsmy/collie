# v1.8.2 上游合并说明

本次从 `v1.8.0+collie.16` 合入上游 `v1.8.1`、`v1.8.2`，交付版本为 `v1.8.2+collie.1`。

## 核对范围

以 release notes、上游 CHANGELOG 和实际标签差异交叉核对，而不是只摘录发布摘要。

- [v1.8.1 发布说明](https://github.com/AltanS/collie/releases/tag/v1.8.1)
- [v1.8.2 发布说明](https://github.com/AltanS/collie/releases/tag/v1.8.2)
- [完整差异 v1.8.0…v1.8.2](https://github.com/AltanS/collie/compare/v1.8.0...v1.8.2)：136 个文件，8,882 行新增、2,661 行删除。
- 上游起点 `360f98e7`，终点 `78f74d1e`。下列链接优先指向实际合入历史中的提交。

## v1.8.2 完整变更

这一版集中修复手机端下载和接管新 PWA 版本时的可靠性问题，全部采用上游实现。

| 项目 | 变化及使用影响 | 来源 |
| --- | --- | --- |
| 图标预缓存 | Service Worker 只预缓存当前 release／dev 通道的图标，排除另一通道和 playground 图标；上游同通道样本从 37 项、1660.11 KiB 降至 28 项、1485.71 KiB。本 fork 额外字体使实际数量不同。 | [d43fcf80](https://github.com/AltanS/collie/commit/d43fcf80) |
| 静态资源 gzip | 支持 gzip 的浏览器现在也以压缩形式接收 JS、CSS、Service Worker 等文本资源；压缩结果按构建缓存在内存，图片和字体保持原格式。上游主 chunk 样本从 869 kB 降至 250 kB，不代表任意网络都能达到固定倍速。 | [9b484bdb](https://github.com/AltanS/collie/commit/9b484bdb) |
| 下载后再重载 | 正在下载新 worker 时不再提前刷新到旧 app shell；等待新 worker 接管后才重载，避免旧页面引用已经替换的 chunk 而卡在启动画面。八秒保护仅在没有安装进行时触发。 | [44b7afb1](https://github.com/AltanS/collie/commit/44b7afb1) |
| 下载条可关闭 | 下载缓慢或断网时可以关闭通知条，继续使用当前缓存版本。关闭不取消后台安装；新 worker 接管后仍自动刷新。 | [5646f7e6](https://github.com/AltanS/collie/commit/5646f7e6) |

## v1.8.1 完整变更

这一版主要更新顶部栏、导航、按键托盘、开发预览和安装说明。

| 类别 | 变化及使用影响 | 来源 |
| --- | --- | --- |
| 导航动画 | Dashboard → Pane 从右侧进入，返回从左侧进入，持续 240ms；顶部通知、标题和 Collie 标识保持挂载。轮询、切换主机／会话及其他导航不播放；减少动态效果时不滑动，也未重新引入 View Transitions API。 | [d24a4d73](https://github.com/AltanS/collie/commit/d24a4d73) |
| Notices／Motion | Playground 新增通知族、连接恢复、更新条、状态 toast，以及折叠、替换、加载、sheet、菜单等动画展示；支持 Replay、部分 Slow 控件和使用模拟数据的真实页面导航演示。 | [9429bd61](https://github.com/AltanS/collie/commit/9429bd61) |
| 开发版图标 | dev 构建使用橙色图标和 `Collie (dev)` 安装名称，playground 使用红色图标；正式版本维持原图标和名称。 | [c7c4cc9e](https://github.com/AltanS/collie/commit/c7c4cc9e) |
| Playground 分栏 | 宽屏侧栏、窄屏顶部导航；只挂载当前分区。分为 Dashboard、Pane、Crew、Settings、Boot、Idle、Brand、Notices、Motion，支持 URL hash 定位和本地记忆。原大文件拆成独立分区，卡片按 Group 组织。 | [9429bd61](https://github.com/AltanS/collie/commit/9429bd61) |
| 紧凑 Keys 托盘 | 上游 NavTray 改成七列两行，Space 位于第二行，数字／Presets／F keys 通过单行切换控件展开；上游 390px 样本高度从 275px 降至 119px，按键至少 36px。与本 fork 即时输入按键的区别见下文。 | [e12b4334](https://github.com/AltanS/collie/commit/e12b4334) |
| Crew 示例匿名化 | Playground 的真实主机名替换成 `lodge`、`workshop` 等虚构名称，删除携带旧名称且未使用的重导出。 | [260dbe46](https://github.com/AltanS/collie/commit/260dbe46) |
| Dashboard 示例匿名化 | 冻结样本中的真实主机、用户名、客户／项目名改成同形假数据；上游同时说明独立网站仓库的构建检查，这不是本仓库新增的运行功能。 | [4269ae2d](https://github.com/AltanS/collie/commit/4269ae2d) |
| 顶部安全区 | 统一 StripHost 同时只显示优先级最高的一条：身份验证错误、失联、连接降级、更新。通知栏有内容时负责顶部 inset，空时交给标题栏，同步 240ms 过渡；不再多次预留刘海高度。连接条和更新条复用 Notice，消除重复配色、动画和相互矛盾的朗读属性。 | [59c77fc3](https://github.com/AltanS/collie/commit/59c77fc3) |
| 更新文案 | 带关闭按钮的更新条通过独立 View 按钮进入更新页；七种语言不再提示点击整行更新。 | [15bd0bbd](https://github.com/AltanS/collie/commit/15bd0bbd) |
| 更新按钮名称 | 整行可点击状态的按钮具有明确可访问名称，不再只把文字放进不能为按钮命名的 live region。 | [93a4ecc2](https://github.com/AltanS/collie/commit/93a4ecc2) |
| 自动显示当前项目 | Spaces、Tabs、Panes 横向条在首次显示及选中项变化时，把当前项滚到最近可见边缘；首次立即移动，随后平滑移动，减少动态效果时立即移动。只滚动对应横条，不移动页面。 | [8a774cc4](https://github.com/AltanS/collie/commit/8a774cc4) |
| 标题标识防闪烁 | `Collie on` 和 multiplexer 图标跨路由保持挂载，进入 Pane 只隐藏；返回 Dashboard 不再重新请求图标并留下短暂空白。 | [1b3939cf](https://github.com/AltanS/collie/commit/1b3939cf) |
| 避免重复配置请求 | 已知 bridge build 时，Dashboard 页脚不再每次挂载都读取配置又丢弃结果。 | [e3c7816e](https://github.com/AltanS/collie/commit/e3c7816e) |
| 构建通道判断 | 有 Git 和标签的 checkout，只有当前版本标签指向 HEAD 才是 release；未打标签的版本提交是 dev。无 Git 的源码包、没有任何标签的浅克隆仍按 release 构建。 | [ee3338a2](https://github.com/AltanS/collie/commit/ee3338a2) |
| iOS 顶部模糊 | Apple 状态栏由 `black-translucent` 改为 `default`，避免 iOS 27 的半透明顶部模糊覆盖标题。iOS 在添加到主屏幕时读取此设置，旧安装需移除后重新添加才能采用这一项。 | [6e78cf51](https://github.com/AltanS/collie/commit/6e78cf51)、[#203](https://github.com/AltanS/collie/issues/203) |
| OMP 浅色填充 | 以亮度判定浅色 ANSI 背景，手机端透明显示，正文文字保持，深色及 diff 底色不变；同一标志也适用于 Statusline，避免遗漏状态栏。 | [5223b74d](https://github.com/AltanS/collie/commit/5223b74d)、[e4078bb9](https://github.com/AltanS/collie/commit/e4078bb9)、[#206](https://github.com/AltanS/collie/issues/206) |
| 多主机 Space | 查看 peer 的 Space 时按该 peer 分组窗格，不再误用 lead 的窗格而显示一排空 Tab。 | [5784191b](https://github.com/AltanS/collie/commit/5784191b)、[#209](https://github.com/AltanS/collie/issues/209) |
| PWA 安装／更新说明 | 增加 Chromium 安装按钮与 iOS 分享菜单两种入口的截图；更新页截图改用 Crew 文案和匿名主机名，补齐安装及更新 PWA 本身的说明。 | [22d20160](https://github.com/AltanS/collie/commit/22d20160)、[fad08d15](https://github.com/AltanS/collie/commit/fad08d15) |
| 截图脚本修复 | `docs-screens.sh` 每张截图都先将目标对齐顶部并等待，避免平滑滚动尚未结束就截掉上沿；两类安装说明的 Note 明确指出适用平台。 | [1f444d6d](https://github.com/AltanS/collie/commit/1f444d6d) |
| OMP 审批样本 | 新增 OMP 18.1.17 的 bash 审批、write 允许／拒绝三个真实样本，验证这些弹窗仍原样显示且拒绝普通 composer 输入；这次没有新增可点击 OMP 审批卡片。 | [0383d4e6](https://github.com/AltanS/collie/commit/0383d4e6)、[#204](https://github.com/AltanS/collie/issues/204) |

## 标签差异补充

下面是发布摘要之外、实际代码和文档差异中一并纳入的内容。

| 范围 | 完整变化 | 来源 |
| --- | --- | --- |
| Crew 文档 | 命令前置，说明配对、加入、部署、检查、更新、退役及旧版本回退；用三张 SVG 说明单一 lead、deputy／standby 和 SSH 分发路径。 | [4281dafb](https://github.com/AltanS/collie/commit/4281dafb) |
| 其他操作文档 | 安装、升级、安全、语音／通知、multiplexer 文档调整为命令优先；集中展示设备配对与撤销、重启后恢复流程；部署 Variant D 的链路图改为 SVG。功能语义不变。 | [dcb37438](https://github.com/AltanS/collie/commit/dcb37438) |
| 设计与 README | DESIGN 补充导航动画、通知条安全区归属和紧凑 Keys 规范；README 更新分栏 playground 与操作入口。 | [d24a4d73](https://github.com/AltanS/collie/commit/d24a4d73)、[9429bd61](https://github.com/AltanS/collie/commit/9429bd61)、[59c77fc3](https://github.com/AltanS/collie/commit/59c77fc3)、[e12b4334](https://github.com/AltanS/collie/commit/e12b4334) |
| 打包元数据 | AUR PKGBUILD／.SRCINFO、Nix sources 更新为上游 1.8.0 资产及校验值；Omarchy 显式声明 `source: local`。保留上游指向，不虚构本 fork 的二进制 Release 资产。 | [81ecd980](https://github.com/AltanS/collie/commit/81ecd980)、[f93c4996](https://github.com/AltanS/collie/commit/f93c4996) |
| 回归与构建测试 | 增加导航时状态保留、单一安全区、滚动选中项、通道图标及压缩缓存测试；Playground 测试按分区巡检，高负载 walkthrough 等待时间调整。PWA A/B 测试增加限速下载和安装中手动重载场景。 | [db7f86ac](https://github.com/AltanS/collie/commit/db7f86ac)、[44b7afb1](https://github.com/AltanS/collie/commit/44b7afb1)、[9b484bdb](https://github.com/AltanS/collie/commit/9b484bdb) |
| 历史中的重复 OMP 修复 | 提交列表还包含 `423ee5e7` 的 Pi composer 草稿验证／多行分块；相同实现已在 v1.8.0 通过另一提交合入，标签净差异中不重复记作新功能。 | [423ee5e7](https://github.com/AltanS/collie/commit/423ee5e7) |
| 兼容性 | Herdr 最低版本仍为 0.7.0；没有新的配置迁移、Crew 协议变更或依赖升级。两个 bun.lock、flake.nix、flake.lock 不变；1.8.0 的旧 Crew 名称兼容窗口继续有效。 | [标签差异](https://github.com/AltanS/collie/compare/v1.8.0...v1.8.2) |

## 本地实现如何取舍

等价能力直接改用上游；执行语义不同或上游尚未提供的行为继续保留。

| 区域 | 原本行为 | 本次选择与可见差异 |
| --- | --- | --- |
| 顶部安全区 | RootLayout 统一预留 inset，再通过 `--chrome-safe-top:0px` 让标题与横条不重复预留；多个横条仍可同时占行。 | 完全改用上游 StripHost、Notice 与标题栏交接。删除本地变量补丁和旧机制断言；顶部最多一个通知条，错误优先，低优先级更新仍可在设置里查看。 |
| 当前 Tab 可见性 | TabStrip 自带 useLayoutEffect、ResizeObserver、边界计算，首次、选中及尺寸变化都可触发。 | 整个 TabStrip 改用上游版本，共享 useRevealActive 覆盖 Space／Tab／Pane；保留首次与选中变化的自动定位。旋转／字体变化不再由本地 Observer 额外触发；页面本身仍不被滚动。 |
| OMP 底色 | 本地曾在 Codex 底色重构中删除旧 mobileTransparentBg 基础支持。 | 恢复上游标志、样式传递和手机 CSS；本地 StatuslineRow 同样接入上游 segmentStyle。Codex／Claude／Hermes 的连续矩形输入及 diff 底色规则继续存在。 |
| 输入与按键 | Composer 四个入口，输入与即时按键合并；点击输入不自动弹键盘，按键立即发送，修饰键具有一次／锁定状态。 | 保留此执行语义。上游紧凑 NavTray 已原样合入，但它采用先积累队列、再发送及离开确认，不能直接替换即时输入而不改变用户操作。当前 Composer 不切回独立 Keys 入口。 |
| 底部安全区 | App viewport 控制根高度和 iOS 页面偏移，Composer 背景向下覆盖底部安全区。 | 保留 h-full 与 viewport／composer 补丁；上游处理顶部 inset，不替代底部修复。导航动画纳入同一 flex 高度链。 |
| Codex／Hermes 等适配 | Codex 发送确认、图文输入、0.154 动态输入背景、model／statusline／QA／Plan 卡片；Hermes 边框、模型、提示、diff／选择框等。 | 上游两版没有同等实现，保留。没有重新添加推测终端硬换行的拼接算法。 |
| Statusline、字体和标题 | 图标压缩、context 圆环颜色、Fast 状态、横向滑动与前置多主机目标；Geist／Geist Mono、官方 Agent 图标、专注及窗格按钮、重命名防缩放。 | 保留本地能力，同时接入上游 OMP 透明底色和标题标识常驻。 |
| 通知与元数据 | 已读窗格清理待发旧通知；按实时会话读取模型元数据。 | 上游没有替代，继续保留，和新的静态资源压缩分开工作。 |
| 版本与交付 | 显示版本不带 dev／dirty；推 main 和准确标签，不发布 Release、不运行 Actions。 | 保留人类可见的简洁版本；构建通道／图标使用上游判定，正式部署从准确标签构建。未恢复 `.github/workflows/`。 |

## 验证与限制

验证覆盖解析、布局和 PWA 更新流程；浏览器手机尺寸测试不等同于真实 iPhone 已安装 PWA。

- 前端 226 个测试文件、7,205 项通过，53 项既有待办；两侧类型检查和全树 lint 通过。
- 浏览器 163 项通过、9 项按项目条件跳过，覆盖手机／平板、Playground、Codex picker／QA／Plan 和九个真实 Service Worker A/B 更新场景，包括限速安装、安装中重载、失败及旧缓存恢复。
- 后端 3,088 项、CLI 1,406 项、脚本单元测试 82 项通过，控制脚本 shim 检查通过。
- 完整 CLI shell 集成测试仍在已有 macOS 平台文案断言处失败：测试要求 `systemd-run --user --collect`，平台实际使用 detached child。本次没有修改 CLI 或该测试，不将其计为通过。
- 被该断言中断的后续独立检查已单独执行：payload links、Bun 来源、tag、flake lock、pre-commit、AUR 和 packaging refresh 全部通过。
- 正式交付仅提交、推送 main 和 `v1.8.2+collie.1` 注释标签；本机从该标签构建，再通过 Herdr 的 Collie restart 动作激活。现有 Agent 会话及其他服务不重启。
