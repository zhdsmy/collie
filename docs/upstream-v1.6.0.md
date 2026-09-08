# v1.6.0 上游合并记录

本次从 `v1.5.5+collie.3` 合入上游 `v1.6.0`，包含中间版本 `v1.5.6`，下游交付版本为 `v1.6.0+collie.1`。

## 核对范围

逐项核对 GitHub Release、CHANGELOG 和标签间实际代码差异，覆盖功能、修复、兼容性、文档、测试及发布工具。

- [v1.6.0 Release](https://github.com/AltanS/collie/releases/tag/v1.6.0)，发布于 2026-09-08 07:03:06，北京时间。
- [v1.5.6 Release](https://github.com/AltanS/collie/releases/tag/v1.5.6)。
- [上游 CHANGELOG](https://github.com/AltanS/collie/blob/v1.6.0/CHANGELOG.md)。
- [完整标签差异](https://github.com/AltanS/collie/compare/v1.5.5...v1.6.0)：53 个提交、133 个文件，新增 7210 行、删除 431 行。
- 目标提交：`2e3df8aa32e5306f8d945d6b3c2c134306976a41`。
- Release 自动生成的 PR 列表仅列出 [#188](https://github.com/AltanS/collie/pull/188)，不是本次全部变更；下表和文末提交清单补齐其余内容。

## v1.6.0 完整变更

本节覆盖 v1.6.0 的所有用户可见变化及相关限制。

| 范围 | 完整变化 | 来源 |
| --- | --- | --- |
| 最新回复补全 | 默认开启 Full latest reply。从 agent 会话日志读取最新的文字回复；先匹配尾部，确认是屏幕上的同一条消息，再判断开头是否被截掉。只有开头缺失且尾部匹配时，才用完整 Markdown 回复替换对应终端行，后续工具输出、输入和对话框不变。可收起恢复原始行；搜索时恢复完整终端，设置中可关闭。 | [#185](https://github.com/AltanS/collie/issues/185)、[46d2fe6](https://github.com/AltanS/collie/commit/46d2fe6)、[d433ce8](https://github.com/AltanS/collie/commit/d433ce8) |
| 补全读取时机 | 打开已有内容的窗格时立即读取；之后显示文本稳定 1500ms 才再次读取最近 8 条日志记录。缺少会话、读取失败、尾部不匹配、内容被日志接口截断时不替换。它不是逐字纠正器，也不会重新排版所有历史正文、diff、输入或 Recap。 | [46d2fe6](https://github.com/AltanS/collie/commit/46d2fe6) |
| 横屏自动 Zen | 在设置的 Zen 项下新增独立开关，默认关闭，且只在 Zen 功能启用时生效。短横屏视口（高度不超过 520px）自动进入，转回竖屏退出；手动进入的 Zen 不受旋转影响，手动退出不会立即自动重入。通常的桌面和高平板视口不触发。修正了设置行对齐及 matchMedia 探测。 | [#182](https://github.com/AltanS/collie/issues/182)、[36d7b97](https://github.com/AltanS/collie/commit/36d7b97)、[3e1033d](https://github.com/AltanS/collie/commit/3e1033d)、[5af27c9](https://github.com/AltanS/collie/commit/5af27c9)、[4bf3696](https://github.com/AltanS/collie/commit/4bf3696) |
| 通知开启恢复 | 配置获取失败不再永久禁用开关；Service Worker 和 PushManager 等待各自限制为 30 秒；注册走共享 API 客户端，登录跳转或服务错误显示在开关旁；只有 bridge 确认当前订阅 endpoint 后才显示已订阅。补充失败、超时和重试测试。 | [#178](https://github.com/AltanS/collie/issues/178)、[#179](https://github.com/AltanS/collie/pull/179)、[6fa2694](https://github.com/AltanS/collie/commit/6fa2694)、[7d0720f](https://github.com/AltanS/collie/commit/7d0720f) |
| Herdr 读取优化 | Herdr 窗格 revision 未变化时，跳过用于获取 Claude 会话名的额外 readGrid 请求；变化后才重新读取，避免空闲 agent 每轮轮询都读一次终端。tmux 和 zellij 保持原行为；为 revision 的推进、复用和重新读取增加测试。 | [#189](https://github.com/AltanS/collie/issues/189)、[198fe20](https://github.com/AltanS/collie/commit/198fe20)、[258341b](https://github.com/AltanS/collie/commit/258341b) |
| OMP 输入 | 支持 OMP 18.1.10 的 composer.shape: rule，识别空输入、已有草稿及换行形态，避免误报消息未到输入框。新增真实 Herdr 采样 fixture、来源说明和完整规则测试。 | [#160](https://github.com/AltanS/collie/issues/160)、[72fbfec](https://github.com/AltanS/collie/commit/72fbfec)、[67b72e3](https://github.com/AltanS/collie/commit/67b72e3)、[7b01833](https://github.com/AltanS/collie/commit/7b01833) |
| Tailscale HTTPS | 发布前读取 tailnet 证书域名；明确没有 HTTPS 时直接说明并指向管理台，不再隐藏 Tailscale 的问题后无限等待。doctor 同步诊断；发布命令保留真实终端输入输出。若状态获取失败，只说明无法判断并继续发布，不把未知误判成 HTTPS 未启用。 | [#172](https://github.com/AltanS/collie/issues/172)、[da8afeb](https://github.com/AltanS/collie/commit/da8afeb)、[0062b91](https://github.com/AltanS/collie/commit/0062b91)、[7759b96](https://github.com/AltanS/collie/commit/7759b96) |
| Windows 工具查找 | doctor、update 和预检支持 Windows PATH 分隔符、PATHEXT 扩展以及环境变量名大小写。Windows 仍是未经真机测试的源码运行路径；找到 .cmd/.bat 不等于能执行，当前无 shell 的启动方式仍要求 git/herdr/bun/python3 的 .exe 在 PATH 上。 | [#175](https://github.com/AltanS/collie/issues/175)、[d80ebbe](https://github.com/AltanS/collie/commit/d80ebbe)、[daa5bdb](https://github.com/AltanS/collie/commit/daa5bdb)、[0062b91](https://github.com/AltanS/collie/commit/0062b91) |
| Herdr 多实例 | 所有打印出来的更新、重启命令都使用当前 COLLIE_INSTANCE 对应的插件 ID，不再误指向默认 herdr.collie。涵盖更新、doctor、推送配置和被替代 lead 的提示。 | [68bb345](https://github.com/AltanS/collie/commit/68bb345) |
| 同版本包替换 | Linux 单文件安装可通过运行进程的可执行文件 inode 判断是否被包管理器替换；即使版本号没变，doctor 和手机也会提示 restart-pending。运行中服务继续报告实际旧版本，避免 pack 把尚未重启的成员当成已升级。 | [4cb544e](https://github.com/AltanS/collie/commit/4cb544e)、[4480964](https://github.com/AltanS/collie/commit/4480964) |
| Arch/Omarchy 安装布局 | collie-bin 安装根目录改为 /opt/collie；/opt/collie 和 /usr/lib/collie 均识别为 pacman 管理。新增 Omarchy 元数据和接入、卸载、发布顺序说明。包中说明文档与许可证移至标准 /usr/share 路径，去除 systemd 硬依赖，增加 herdr/tmux 可选依赖。 | [4480964](https://github.com/AltanS/collie/commit/4480964)、[dd1a415](https://github.com/AltanS/collie/commit/dd1a415) |
| Arch 安装生命周期 | 安装、升级、移除钩子说明如何 start、如何在多个 multiplexer 时选择 Herdr、何时 restart；移除前提醒先 uninstall，否则用户 service 和 Tailscale 映射不会自动移除，移除后说明保留的数据目录。Omarchy 复用同一钩子。 | [187a0dd](https://github.com/AltanS/collie/commit/187a0dd) |
| 包管理安装与 pack | 包管理 lead 执行终端 pack update 时说明没有可推送的 Git 提交，应通过包管理器更新本机，再在手机 Updates 页面统一成员版本；不再把正常的 /opt/collie 安装报成损坏 checkout。 | [187a0dd](https://github.com/AltanS/collie/commit/187a0dd) |
| 包与 Herdr 的关联 | 文档明确包安装后仍须手动 herdr plugin link /opt/collie 才能注册插件操作；Herdr 不自动扫描 /opt。插件 update/update-major 在包目录拒绝自更新属于预期行为。 | [e4e7e9f](https://github.com/AltanS/collie/commit/e4e7e9f) |
| AUR 可用性说明 | 本版发布时 AUR 暂停新账号注册，collie-bin 尚未上线；文档先给出克隆仓库后 makepkg -si 的路径，paru 命令标为未来上架后的方式。 | [d7dd6d9](https://github.com/AltanS/collie/commit/d7dd6d9) |
| mise | 增加 Linux/macOS 的 GitHub release tarball 安装方法、mise upgrade --bump 和重启步骤；支持 systemd/launchd 的服务目录切换。mise 所有的版本目录不由 collie update 自更新，文档明确这个边界。 | [0febef5](https://github.com/AltanS/collie/commit/0febef5)、[0062b91](https://github.com/AltanS/collie/commit/0062b91) |
| 文档和本地化 | 同步安装、升级、排障、multiplexer、pack 文档与架构说明；更新全部七份语言字典中的补全回复、横屏 Zen、通知失败及更新提醒文案，补齐文案预算、fixture 来源和测试说明。 | [c62e607](https://github.com/AltanS/collie/commit/c62e607)、[86a168e](https://github.com/AltanS/collie/commit/86a168e)、[0062b91](https://github.com/AltanS/collie/commit/0062b91)、[7b01833](https://github.com/AltanS/collie/commit/7b01833) |

## 随同纳入的 v1.5.6

这一中间版本没有单独发布下游版本，本次全部纳入。

| 范围 | 完整变化 | 来源 |
| --- | --- | --- |
| Arch/Nix 包 | 新增 Arch PKGBUILD、SRCINFO 和 Nix derivation；包装官方 release tarball，不从源码编译，也不允许 Collie 自行改写包管理目录。Nix 在 Linux 修正动态加载路径，并验证已安装二进制能运行。 | [bb46def](https://github.com/AltanS/collie/commit/bb46def)、[43a23a2](https://github.com/AltanS/collie/commit/43a23a2)、[d11c58a](https://github.com/AltanS/collie/commit/d11c58a)、[3f59a39](https://github.com/AltanS/collie/commit/3f59a39) |
| Nix 默认包 | flake 默认输出从 Bun 改成 Collie，nix run 可直接启动 Collie；原有 pinned Bun 仍作为 packages.<system>.bun 提供，开发 shell 保留。 | [43a23a2](https://github.com/AltanS/collie/commit/43a23a2) |
| 更新提醒关闭 | 关闭指定版本的决定从浏览器 localStorage 移至 bridge；跨设备、跨页面读取同一状态，同时停止该版本的摘要提醒。自身更新 offer 和其他主机的 pack 提醒分别记录，可独立关闭；更高版本重新提醒。包管理安装显示包管理器名称，不提供虚假的点按自更新。 | [23b5934](https://github.com/AltanS/collie/commit/23b5934)、[2be3547](https://github.com/AltanS/collie/commit/2be3547)、[f630c1c](https://github.com/AltanS/collie/commit/f630c1c) |
| 发布二进制可移植性 | 修复官方 1.5.4/1.5.5 的 macOS ICU 和 Linux arm64 interpreter 指向 /nix/store，导致脱离构建机不能启动的问题；编译 release 时改用 flake 固定版本的未修改上游 Bun archive。linux-x64 原先不受此问题影响。增加 loader 输入检查，只允许系统库路径。 | [#184](https://github.com/AltanS/collie/issues/184)、[33df273](https://github.com/AltanS/collie/commit/33df273)、[9d07868](https://github.com/AltanS/collie/commit/9d07868) |
| pack 日志 | 记录各成员升级步骤转换、不兼容原因、每次退避阶梯、恢复可达和升级完成统计。只在状态变化时写日志，不把每次轮询变成重复记录；区分成功、回滚、不可达和包管理成员。 | [3ea0108](https://github.com/AltanS/collie/commit/3ea0108) |

## 发布工具及实际差异

本节补齐发布说明未逐条展开的构建、自动化和测试变化。

| 范围 | 完整变化 | 本仓库处理 |
| --- | --- | --- |
| CI 发布门禁 | release workflow 先解析标签对应提交，再等待该提交的 main push CI 成功；不存在、失败或取消的 CI 阻止发布。说明先推 main、看 CI、再推 tag，以及并发 push 取消 CI 的风险。[ea76e56](https://github.com/AltanS/collie/commit/ea76e56) | 记录上游变化，但保持 .github/workflows/ 全部删除，不启用这项自动化 |
| 包版本刷新 | scripts/refresh-packages.ts 仅从发布完整性 manifest 读取版本、URL 来源和 sha256；验证平台清单，更新 PKGBUILD/Nix，按版本和校验和调整 pkgrel；由 makepkg 生成 SRCINFO，check 模式独立读取包声明并核对。[a50e235](https://github.com/AltanS/collie/commit/a50e235)、[ab6ff89](https://github.com/AltanS/collie/commit/ab6ff89) | 脚本和测试保留；不制造不存在的下游 tarball/校验和 |
| 包发布自动化 | 官方发布后可使用专用密钥推送 AUR，并创建包更新 PR；缺密钥跳过，已存在分支不强推，无法建 PR 时保留分支并给出原因。[94335cc](https://github.com/AltanS/collie/commit/94335cc) | 工作流保持删除，不创建 PR、不向 AUR/Omarchy 或其他仓库发布 |
| 包 recipe 版本 | 上游 #188 把包 recipe 指向 1.5.6；刷新测试不再假设当前树必然比 manifest 旧。[7c16dbb](https://github.com/AltanS/collie/commit/7c16dbb)、[8a672d2](https://github.com/AltanS/collie/commit/8a672d2) | 忠实保留官方 1.5.6 资源引用。本下游仅推标签，没有对应 Release 资产，不能改成下游版本 |
| 二进制 gate | 新增 check-payload-links.sh 和 upstream-bun.sh，以及模拟 Mach-O/ELF 加载器、Bun 来源、失败路径的测试 | 全部保留，在本机执行可运行的测试 |
| 测试与元数据 | 修复 update-card 测试等待 effect 的竞态；增加 Arch 安装/VM 测试、包刷新、实例 ID、可执行文件替换、HTTPS、Windows 查找、状态 revision、通知、Zen、回复身份/截断/收起/搜索、OMP 测试；纠正测试脚本重复列举、CHANGELOG 重复/缺失标题及安装命令中的 tag 参数位置 | 保留全部测试；Windows/Linux 真机安装不冒充 macOS 已验证 |
| 依赖与协议 | flake.nix 增加软件包输出，但 flake.lock、两份 bun.lock、npm 依赖版本未变化；pack protocol 仍为 1。更新快照的关闭状态字段是可选扩展，旧客户端忽略，新客户端缺省处理 | 不升级依赖、不改 pack 协议号、不改现有设备配置 |

## 上游优先与保留项

本次没有移除一套独立的下游功能；重叠处沿用上游新增的参数、状态和行为，而非重新实现。

| 部分 | 旧行为 | 本次采用方式及用户可见差异 |
| --- | --- | --- |
| 最新完整回复 | 只显示终端已有内容，缺失开头需进入历史页；之前讨论的原文校正尚未实现 | 直接使用上游 useLatestReply、locateReply、LatestReply、dropLeadingLines，无独立下游重排。仅满足上游身份与截断条件时补全，不承诺全部换行自动修复 |
| 更新提醒 | 过去沿用上游 1.5.5 的浏览器本地关闭记录 | 改用上游 bridge 记录，两类提醒独立关闭并跨设备同步；保留本地顶栏安全区只消费一次的布局 |
| 通知设置 | 原有 Service Worker/订阅等待可能卡住 | 完全采用上游超时、错误显示与确认注册逻辑；已读清除和静默撤回在另一条生命周期上，不删除 |
| Herdr/CLI | 原有 session-name 轮询、默认插件 ID 提示和工具查找 | 直接采用上游 revision 缓存、多实例命令及跨平台查找，没有平行实现 |
| Composer | 本地四项 icon+文字工具栏，直接输入合并按键且不自动弹键盘 | 保留，仅接入上游 Full latest reply 设置参数；不恢复独立按键入口或 Agent 状态横条 |
| iOS 布局 | 根背景覆盖完整安全区，应用尺寸跟随可视视口，Composer 背景向下延伸 | 上游没有相同替代，完整保留；不回退到单纯额外底部 padding |
| 输入与显示 | 纯文字、单图、多图、混排、空行、图片标记、绝对路径及工作中引导的发送保护；输入/diff 等宽连续底色；输入加粗 | 无相同上游替代，保留。终端换行保持上游原样，不恢复过去撤销的启发式拼行 |
| 通知清理 | 本机/peer 已读同步、按会话命名、静默撤回、不复活已关闭通知 | 上游此次修复的是订阅建立而非旧通知清理，因此保留 |
| statusline/字体/缩放 | 紧凑图标、context 容量色和圆环、Fast 空心/实心、沙漏动画、横滑与多主机目标；Geist/Geist Mono；重命名 16px 防 iOS 放大；显示版本去除 dev/dirty | 上游无对应替代，保留所有这些行为 |
| 发布策略 | main 加带注释的 upstream+collie.N 标签，本机部署，无 Actions/Release | 不变；不操作主题分支，不重启 Herdr 后台或 Headroom |

## 合并适配与验证

版本更新分为合并提交和独立 release 提交，不把版本号混入功能提交。

- 冲突处理：删除上游重新带入的 release workflow；保留完整两边 CHANGELOG 历史；Composer 接入新增设置参数但不恢复已删除的状态参数；繁体中文采用上游新增更新提示。
- 测试适配：上游 Windows 工具查找测试以 herdr 为假工具名，负例在已安装 Herdr 的 macOS 上从 fallback 路径找到真实程序；改为临时目录派生的独立名称，仅改测试，不修改生产工具搜索。
- 补充 Codex 集成测试：日志回复替换终端尾部后，真正的中文段落、后续用户输入和 diff 底色保持，收起后恢复原始终端硬换行。
- 测试适配：包刷新测试改用 GNU/BSD sed 都支持的显式备份后缀和 POSIX 空白字符类；只作用于测试的临时副本，不改变正式包刷新工具。
- 前端全量：196 个文件，5608 项通过，30 项 todo；包括新增 Codex 集成测试及现有输入发送、通知、安全区、statusline 回归。
- 后端单元：bridge 2785、CLI 1308、scripts 52 项全部通过，共 4145 项。
- 前后端类型检查、全树 lint、根目录生产构建通过；本机无 Nix，使用既有 Bun 1.4.0，未安装或变更构建工具。
- CLI shim、payload loader、上游 Bun 来源、标签、flake 锁、pre-commit、Arch 包形态测试通过；包刷新测试经上述移植后单独验证。
- Chromium/WebKit：390px 竖屏、844px 横屏、1280px 桌面，亮暗主题共 12 组，全部通过。验证最新回复替换/收起、真实段落、输入和 diff 连续底色、四项 Composer 控件、直接输入不自动聚焦、页面不横向溢出。API 全部模拟，不向真实会话发测试消息；这不是 iPhone 真机 PWA 验证。
- 已知限制：根测试入口的 CLI shell 冒烟用例在 macOS 期待 Linux 的 systemd-run handoff，实际正确走 detached child；这个既有的平台断言问题不改变本次生产实现。
- 差异检查：除三份与上游字节一致的 OMP 终端采样保留原始行尾空格外，git diff --check 通过；采样不做格式化，以免改变识别测试的真实输入。

## 完整提交清单

以下 53 条为实际标签差异，避免遗漏没有出现在自动 PR 摘要中的提交。

| 提交 | 上游提交说明 |
| --- | --- |
| [87d2eee](https://github.com/AltanS/collie/commit/87d2eee) | test(update-card): wait for the reload-hold effect instead of racing it |
| [ea76e56](https://github.com/AltanS/collie/commit/ea76e56) | ci(release): publish only from a commit whose CI run is green |
| [bb46def](https://github.com/AltanS/collie/commit/bb46def) | feat(packaging): collie-bin wraps the release tarball and names us as maintainer |
| [43a23a2](https://github.com/AltanS/collie/commit/43a23a2) | feat(packaging): the flake exports collie, a wrapper around the release tarball |
| [93ab464](https://github.com/AltanS/collie/commit/93ab464) | docs(changelog): restore the intro and the Unreleased heading the 1.5.5 commit dropped |
| [a50e235](https://github.com/AltanS/collie/commit/a50e235) | feat(release): refresh-packages rewrites the package files from the release manifest |
| [d11c58a](https://github.com/AltanS/collie/commit/d11c58a) | test(packaging): a built collie-bin installs and classifies as packaged |
| [c09a035](https://github.com/AltanS/collie/commit/c09a035) | docs: the Arch and Nix install paths, and what a packaged member does in a pack |
| [994c227](https://github.com/AltanS/collie/commit/994c227) | chore(test): list the two packaging tests once, not twice |
| [ab6ff89](https://github.com/AltanS/collie/commit/ab6ff89) | fix(packaging): pkgrel follows the version, and the verify pass reads the PKGBUILD independently |
| [3f59a39](https://github.com/AltanS/collie/commit/3f59a39) | test(nix): the derivation runs the binary it just installed |
| [94335cc](https://github.com/AltanS/collie/commit/94335cc) | fix(release): the packaging branch is never force-pushed, and a failed PR says why |
| [1e888a1](https://github.com/AltanS/collie/commit/1e888a1) | docs(install): the AUR is not pacman, and how to remove either package |
| [23b5934](https://github.com/AltanS/collie/commit/23b5934) | feat(update): the bridge remembers a dismissed version, and one route records it |
| [2be3547](https://github.com/AltanS/collie/commit/2be3547) | feat(ribbon): one dismiss on every screen, and a true line on a packaged host |
| [f630c1c](https://github.com/AltanS/collie/commit/f630c1c) | fix(ribbon): two dismissals, two fields, and a packaged host states rather than instructs |
| [4503cfa](https://github.com/AltanS/collie/commit/4503cfa) | docs(changelog): one Unreleased heading after the rebase |
| [33df273](https://github.com/AltanS/collie/commit/33df273) | fix(release): the binaries compile on the upstream Bun, and a Nix store link fails the release |
| [17ab6ad](https://github.com/AltanS/collie/commit/17ab6ad) | docs(install): the pinned tag goes to sh, not curl, and the AUR line says the listing is not live yet |
| [9d07868](https://github.com/AltanS/collie/commit/9d07868) | fix(release): the loader gate allows only system roots, and the upstream Bun has its own script |
| [3ea0108](https://github.com/AltanS/collie/commit/3ea0108) | feat(pack): the journal names each leg change and each backoff |
| [bc73318](https://github.com/AltanS/collie/commit/bc73318) | chore(release): 1.5.6 |
| [d7dd6d9](https://github.com/AltanS/collie/commit/d7dd6d9) | docs(aur): the listing waits for AUR registration to reopen |
| [7c16dbb](https://github.com/AltanS/collie/commit/7c16dbb) | test(packaging): the refresh test no longer assumes the tree is one release behind |
| [8a672d2](https://github.com/AltanS/collie/commit/8a672d2) | chore(packaging): track 1.5.6 |
| [4480964](https://github.com/AltanS/collie/commit/4480964) | feat(packaging): collie-bin installs to /opt/collie, the layout Omarchy expects |
| [dd1a415](https://github.com/AltanS/collie/commit/dd1a415) | docs(packaging): Omarchy install steps, uninstall, and the order the package goes out in |
| [4cb544e](https://github.com/AltanS/collie/commit/4cb544e) | fix(doctor): restart-pending reads the executable, not the version |
| [e4e7e9f](https://github.com/AltanS/collie/commit/e4e7e9f) | docs(install): what a packaged Collie needs on Arch and Omarchy |
| [68bb345](https://github.com/AltanS/collie/commit/68bb345) | fix(cli): the Herdr commands Collie prints name the instance's own plugin id |
| [187a0dd](https://github.com/AltanS/collie/commit/187a0dd) | feat(packaging): pacman prints what to do after install, upgrade and removal, and a packaged lead keeps its pack |
| [c62e607](https://github.com/AltanS/collie/commit/c62e607) | docs(changelog): the packaging changes since 1.5.6 are all listed |
| [da8afeb](https://github.com/AltanS/collie/commit/da8afeb) | fix(serve): say when the tailnet has no HTTPS instead of waiting on a hidden prompt |
| [6fa2694](https://github.com/AltanS/collie/commit/6fa2694) | fix(push): recover failed notification setup |
| [86a168e](https://github.com/AltanS/collie/commit/86a168e) | docs(changelog): push setup fix credited, locale strings gated |
| [d80ebbe](https://github.com/AltanS/collie/commit/d80ebbe) | fix(tools): resolve external tools on Windows |
| [daa5bdb](https://github.com/AltanS/collie/commit/daa5bdb) | test(tools): the Windows tool search runs under test on every platform |
| [198fe20](https://github.com/AltanS/collie/commit/198fe20) | perf(state): skip enrichSessionNames readGrid for unchanged panes |
| [258341b](https://github.com/AltanS/collie/commit/258341b) | test(state): the session-name read follows the pane revision |
| [7d0720f](https://github.com/AltanS/collie/commit/7d0720f) | docs(push): the comment names the throw that guards the endpoint |
| [36d7b97](https://github.com/AltanS/collie/commit/36d7b97) | feat(zen): rotating to landscape can open zen, behind its own toggle |
| [3e1033d](https://github.com/AltanS/collie/commit/3e1033d) | fix(zen): the auto-landscape row hangs under the title, not the icon |
| [5af27c9](https://github.com/AltanS/collie/commit/5af27c9) | fix(zen): the matchMedia probe is an optional call, not a typeof check |
| [4bf3696](https://github.com/AltanS/collie/commit/4bf3696) | fix(zen): auto zen keeps a hand-opened zen and skips tall viewports |
| [0febef5](https://github.com/AltanS/collie/commit/0febef5) | docs(install): mise installs the release tarball on Linux and macOS |
| [0062b91](https://github.com/AltanS/collie/commit/0062b91) | fix(zen): auto zen is the operator's choice, and the release notes say what a Windows or Mac host gets |
| [7759b96](https://github.com/AltanS/collie/commit/7759b96) | test(cli): serve keeps no output file, so the shell test stops looking for one |
| [46d2fe6](https://github.com/AltanS/collie/commit/46d2fe6) | feat(pane): show the newest reply in full when the terminal clipped it |
| [d433ce8](https://github.com/AltanS/collie/commit/d433ce8) | chore(web): the latest-reply files pass the lint rules main gained |
| [72fbfec](https://github.com/AltanS/collie/commit/72fbfec) | fix(omp): recognize rule composer shape |
| [67b72e3](https://github.com/AltanS/collie/commit/67b72e3) | test(omp): complete rule composer coverage |
| [7b01833](https://github.com/AltanS/collie/commit/7b01833) | docs(fixtures): the rule composer corpus names its Herdr, and the changelog credits it |
| [2e3df8a](https://github.com/AltanS/collie/commit/2e3df8a) | chore(release): 1.6.0 |
