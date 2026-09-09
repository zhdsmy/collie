# v1.7.0 上游合并记录

本次从 `v1.6.0+collie.5` 合入上游 `v1.7.0`，下游交付版本为 `v1.7.0+collie.1`。

## 核对范围

本报告交叉核对 Release、CHANGELOG 和实际标签差异，覆盖全部 22 个上游提交。

- [上游 Release](https://github.com/AltanS/collie/releases/tag/v1.7.0)。
- [上游 CHANGELOG](https://github.com/AltanS/collie/blob/v1.7.0/CHANGELOG.md)。
- [完整标签差异](https://github.com/AltanS/collie/compare/v1.6.0...v1.7.0)：221 个文件，新增 14601 行、删除 1768 行。
- 标签落在 `35b60df7`，包含版本提交 `6580f71d` 之后的内嵌文档检查修正。
- Release 正文按 CHANGELOG 的分组摘要生成；以下补充摘要之外的行为、限制和工具变更。

## 多主机功能与兼容性

上游现在将多主机组称为 crew，能力和会话视图按目标主机判断。

| 范围 | 完整变化与使用影响 | 来源 |
| --- | --- | --- |
| pack 改名 crew | CLI 使用 `collie crew`，页面使用 `/crew`，菜单、帮助、七种语言和文档同步改名。`collie pack`、`/pack`、`collie docs pack` 保留别名，计划到 2.0.0 才移除。旧 CLI 名称仅在终端向 stderr 提示，管道 stdout 不变。 | [15f1f987](https://github.com/AltanS/collie/commit/15f1f987) |
| 现有配置兼容 | 协议仍叫 pack；`/pack/v1/*`、`/api/pack`、请求头、`COLLIE_PACK_*`、磁盘状态文件不改名，不需要迁移已有 crew。协议版本仍为 1，新增字段及路由均按可选扩展处理，支持 1.6.0 与 1.7.0 成员混用。 | [15f1f987](https://github.com/AltanS/collie/commit/15f1f987)、[PACK_PROTOCOL](../PACK_PROTOCOL.md) |
| crew 名称 | 新建时未传 `--name`，默认名称改为 `collie crew`；已有名称保持。新增 `collie crew rename <name>`，仅 lead 可执行，写入后重启其 Collie bridge。新成员得到新名字，旧成员本地那份未使用的名称不追溯改写。 | [db6f9a5e](https://github.com/AltanS/collie/commit/db6f9a5e)、[4d2f3f5b](https://github.com/AltanS/collie/commit/4d2f3f5b) |
| 添加候选主机 | 不带目标的 `collie crew add` 从 SSH config 和 Herdr 已保存机器列出候选，标注来源，按 `ssh -G` 解析结果去重；已入组机器不再提供添加。只跟随 `~/.ssh/` 下的一层 Include，列举时不连接远端，选择后仍需确认。显式目标的原有用法不变。 | [e54780ab](https://github.com/AltanS/collie/commit/e54780ab) |
| 多路复用器职责 | 机器拓扑由 Collie crew 管理，adapter 只回答本机。Herdr 的机器列表只用于候选发现，不自动变成 crew，不远程直连 Herdr socket。新增 host-candidates 及 Herdr machine-list 解析边界。 | [bdc5bb83](https://github.com/AltanS/collie/commit/bdc5bb83)、[bd3adc5f](https://github.com/AltanS/collie/commit/bd3adc5f) |
| 按主机显示能力 | 成员在 hello 报告自身 mux 能力，lead 缓存并通过 `/api/config?host=` 提供。输入、按键、重命名、关闭、聚焦、历史、滚动历史及相关主机控件询问目标机器，不再套用 lead 的能力。旧成员没有新字段时沿用 lead 答案；页面按主机缓存，失败可在后续挂载重试。 | [bd3adc5f](https://github.com/AltanS/collie/commit/bd3adc5f) |
| 本机会话发现 | SessionRegistry 改用 adapter 的实例列表和端点声明。Herdr 继续支持配置目录中的命名会话；tmux 无可靠 server 枚举、zellij 无相同 socket 模型，因此明确不支持该能力，一份 Collie 驱动所指定的会话。`COLLIE_MULTI_SESSION` 含义不变。 | [bd3adc5f](https://github.com/AltanS/collie/commit/bd3adc5f) |
| 全会话与主机选择 | `?all=1` 与机器选择正确组合：选中成员时扩展该成员的会话，不再误扩展 lead。lead 在原有 sweep 请求成员全部会话，按页面请求缩小缓存结果；成员第二个会话的窗格也可访问，旧成员仍可只返回主会话。 | [bd3adc5f](https://github.com/AltanS/collie/commit/bd3adc5f) |
| 连接状态 | 区分“正在重连”和“需要处理”：暂时重连采用较温和的琥珀色，身份、协议等不能靠重试解决的问题给出原因。主机标签与 crew 页面使用相同判断，屏幕阅读器同步描述。每次拨号带序号，过期响应被丢弃并记录，不覆盖新连接状态。 | [bd3adc5f](https://github.com/AltanS/collie/commit/bd3adc5f) |
| zellij 与远程启动 | Tab 的窗格数按 Collie 实际公开的 pane 计算，排除 tab/status bar 等内部 pane；空 cwd 不作为路径传给 launcher，三种 mux 都使用各自默认目录。转发写请求获得独立 5 秒预算，减少远程启动成功却被 lead 报超时。 | [bd3adc5f](https://github.com/AltanS/collie/commit/bd3adc5f) |
| 版本偏差提示 | 成员较旧才建议 `crew update`；lead 较旧建议在 lead 执行 `collie update`，避免将新成员降级。同一语义版本但字符串不同不建议错误的更新命令。 | [bd3adc5f](https://github.com/AltanS/collie/commit/bd3adc5f) |

## 更新过程与恢复修复

更新状态、计时、错误和重试统一采用上游实现。

| 范围 | 完整变化与使用影响 | 来源 |
| --- | --- | --- |
| staging 即时进度 | staging 开始就写 run record，fetch/build 步骤写入小型日志并合入已有 `logTail`，最长的构建阶段也能看到进度。失败及时终结；并发第二次更新不会覆盖正在运行的记录。失败的服务日志不会被较旧构建日志覆盖。 | [90fc363a](https://github.com/AltanS/collie/commit/90fc363a) |
| 四阶段与本地计时 | Updates 页面展示四阶段，每秒按手机时钟计时，bridge 重启不可达时仍继续计时；更新期间提高轮询频率，去掉一处重复 poller。重启超过 90 秒改为排障提示。 | [90fc363a](https://github.com/AltanS/collie/commit/90fc363a)、[bd3adc5f](https://github.com/AltanS/collie/commit/bd3adc5f) |
| 协议头缺失 | 无 `X-Pack-Protocol` 的响应先当作暂时不可达，附 HTTP 状态和持续时间；持续超过 60 秒才退回退避阶梯。明确不同协议或协议拒绝才进入不兼容路径；401 保留自身处理。接收端对缺协议头的请求仍拒绝，未放宽协议校验。 | [90fc363a](https://github.com/AltanS/collie/commit/90fc363a) |
| crew 更新必定收敛 | 正在升级的成员每次 sweep 都检查，不被旧退避延迟十分钟。单 leg 二十分钟无状态进展就失败，全部 leg 终态后 run 结束；崩溃遗留且已超时的 run 不重新复活。超时失败保持，只有实际达到目标版本才能清除。 | [90fc363a](https://github.com/AltanS/collie/commit/90fc363a) |
| 成员恢复触发重拨 | 通过双重认证的成员请求可清除该成员退避，使下一次 sweep 立即重拨；每十秒最多一次，最多五次重置，之后恢复 lead 自己的退避约束。 | [90fc363a](https://github.com/AltanS/collie/commit/90fc363a) |
| 仅更新成员也有进度 | peers-only run 可在 status 顶层携带 leg 与结束时间，不再因为 lead 没有本地更新记录而丢失；新 run 不误用旧 run 的 leg。页面读取最新轮询内容，更新后成员版本自动刷新，重试一轮 poll 内显示进展。 | [90fc363a](https://github.com/AltanS/collie/commit/90fc363a) |
| 横幅与 Updates 一致 | 两处读取同一个进度函数；成员仍在更新时横幅持续显示，不再十分钟后自行消失。超过两分钟提示耗时；成员失败时两处给出相同原因、可重试和可收起操作。 | [90fc363a](https://github.com/AltanS/collie/commit/90fc363a) |
| 更新按钮位置 | preflight 和成员列表在按钮下方展开，确认控件留在原位置及手机视口中；预检查未返回时按钮禁用并显示检查中。 | [90fc363a](https://github.com/AltanS/collie/commit/90fc363a) |
| 刷新提示与点击恢复 | 需要刷新页面用刷新图标，避免误读成再次升级。自动刷新与手动点击共用导航保护；自动刷新没有真正离页时，三秒后手动点击可再生效。 | [90fc363a](https://github.com/AltanS/collie/commit/90fc363a) |
| 成员自升级诊断 | 成员拒绝自行跟进时，在自身日志写出具体 guard 原因；仅在轮到该成员时记录，不增加日常噪声或协议字段。 | [90fc363a](https://github.com/AltanS/collie/commit/90fc363a) |
| 更新任务交接 | linked checkout／binary 安装在退出 staging 前等待服务管理器接受 runner，最多十五秒；失败携带 tier、退出码或 timeout 及首条诊断并终结。无管理器可确认的 tier 拒绝从服务内部启动不可靠交接，避免卡在 staging。 | [c7191904](https://github.com/AltanS/collie/commit/c7191904)、[bd3adc5f](https://github.com/AltanS/collie/commit/bd3adc5f)、[#194](https://github.com/AltanS/collie/issues/194) |
| systemd 环境探测 | Herdr action 未携带会话环境时，systemd 用户服务探测失败后补充推导的 `XDG_RUNTIME_DIR`／bus 地址重试一次；不覆盖用户已有值，容器无管理器仍判为 unsupervised。 | [c7191904](https://github.com/AltanS/collie/commit/c7191904)、[bd3adc5f](https://github.com/AltanS/collie/commit/bd3adc5f) |
| binary 切换后重启 | pidfile 校验忽略同一安装根目录中的版本目录差异，能识别旧版本 bridge 并完成重启，避免旧进程占端口导致回滚；仍拒绝其他安装根目录和不匹配的实例。 | [f3c3c22c](https://github.com/AltanS/collie/commit/f3c3c22c)、[9975839a](https://github.com/AltanS/collie/commit/9975839a)、[#195](https://github.com/AltanS/collie/pull/195) |

## 图片与内嵌手册

Pi／OMP 图片来自会话日志；终端镜像中的图片位置仍有上游明确注明的近似限制。

| 范围 | 完整变化与使用影响 | 来源 |
| --- | --- | --- |
| OMP transcript | `omp` 作为 pi journal 的别名，共用解析器。默认依次搜索 `~/.omp/agent/sessions` 和 `~/.pi/agent/sessions`；显式 `COLLIE_PI_ROOT` 覆盖两者，已有 pi 用户也可能看到同机 OMP 会话。 | [fd28d018](https://github.com/AltanS/collie/commit/fd28d018)、[#181](https://github.com/AltanS/collie/pull/181)、[#193](https://github.com/AltanS/collie/pull/193) |
| History 图片 | 保留并显示用户附图、agent 图片和工具截图；搜索仍按文本进行。接受内联图片数据和受控 journal blob，不加载日志中任意网络图片地址。 | [fd28d018](https://github.com/AltanS/collie/commit/fd28d018)、[ba8e19a0](https://github.com/AltanS/collie/commit/ba8e19a0) |
| 终端图片占位 | 将 Kitty 图形占位单元聚成图片卡；带文字的行保留文字及 find/link 偏移。图片从末尾按顺序匹配，卡片说明这是近似对应，准确对应请看 History；无匹配显示 `[Image]`。不声称解决文本硬换行。 | [fbae4cf6](https://github.com/AltanS/collie/commit/fbae4cf6)、[8e8cf78a](https://github.com/AltanS/collie/commit/8e8cf78a)、[797318d6](https://github.com/AltanS/collie/commit/797318d6)、[#180](https://github.com/AltanS/collie/issues/180) |
| 图片读取节奏 | 最终实现不在 pane 轮询里附加图片或扫描 journal；镜像出现新的占位簇才按需请求历史，最多一笔读取在途，避免每轮 poll 做日志 I/O。 | [ba8e19a0](https://github.com/AltanS/collie/commit/ba8e19a0)、[797318d6](https://github.com/AltanS/collie/commit/797318d6) |
| blob 路由 | `GET /api/blobs/:hash` 限定配置根目录并检查 realpath 包含关系，按内容识别 MIME，单文件上限 16 MiB，支持 ETag、304 与不可变缓存；图片按所属 host 通过 lead 转发。旧 peer 无路由或文件消失时降级图片徽标，不显示坏图。 | [fd28d018](https://github.com/AltanS/collie/commit/fd28d018)、[ba8e19a0](https://github.com/AltanS/collie/commit/ba8e19a0)、[797318d6](https://github.com/AltanS/collie/commit/797318d6) |
| 离线手册 | `collie skill`／`collie --skill` 输出给 AI agent 的简介；`collie docs` 列十篇操作手册，`docs <name>` 输出单篇，`docs --all` 用明确标记串联。内容编译进二进制，无需网络或 checkout，packaged 安装行为一致。 | [3edb9667](https://github.com/AltanS/collie/commit/3edb9667)、[bd3adc5f](https://github.com/AltanS/collie/commit/bd3adc5f) |

## 文档、构建、测试与仓库维护

没有新增 npm 依赖或工具链 pin 变更；上游发布工具的改进仍纳入源码，但不启用下游 Actions。

| 范围 | 完整变化 | 来源 |
| --- | --- | --- |
| CHANGELOG 与 Release 生成 | 采用 Added／Changed／Fixed／Packaging／Docs 分组和粗体首句，新增 `scripts/release-notes.ts`。Release 首先显示更新命令，再列每项首句、完整 CHANGELOG 和真实前置 tag 的 compare，最后折叠校验步骤；不再依赖遗漏直接提交的 GitHub 自动 PR 摘要。无法解析的条目阻止生成。 | [fc98468b](https://github.com/AltanS/collie/commit/fc98468b) |
| 提交与发布检查 | pre-commit 检查 Unreleased 分组及粗体首句，加入 shell／Bun 测试；发布检查验证二进制内嵌手册，最终修正为 `docs crew`。下游继续删除整个 workflows，不创建 GitHub Release。 | [fc98468b](https://github.com/AltanS/collie/commit/fc98468b)、[35b60df7](https://github.com/AltanS/collie/commit/35b60df7) |
| 包配方 | AUR PKGBUILD、SRCINFO、Nix sources 从 1.5.6 的官方包更新到 1.6.0 的官方 URL 和 SHA256，这是 v1.7.0 tag 内实际状态。本次不伪造下游 Release 包或改写为不存在的下载。 | [61d224d1](https://github.com/AltanS/collie/commit/61d224d1) |
| 构建依赖 | 两份 bun.lock、flake.nix、flake.lock、npm 依赖版本均无变化。oxlint 仅增加 Herdr machine-list JSON 解析边界，保留严格 lint。 | [bd3adc5f](https://github.com/AltanS/collie/commit/bd3adc5f) |
| 一致性探针 | 新增 `scripts/pack-mux-probe.ts`，可经 lead 对成员做只读 mux conformance 检查；不能转发的四个端口操作、固定形状的 pane.read、会修改状态的能力检查明确标为不能评分，不冒充通过。上游曾验证 Herdr lead 加 tmux／zellij 成员，本次没有在本机新建该拓扑。 | [bd3adc5f](https://github.com/AltanS/collie/commit/bd3adc5f) |
| 架构与手册 | 新增 ADR 0036（机器拓扑归属）、0037（升级交接确认）、0038（crew 名称与 pack 协议）；更新 ADR 索引、0012、0028、ARCHITECTURE、MUX_CONTRACT、PACK_PROTOCOL。`docs/pack.md` 移至 `docs/crew.md`，补齐 Herdr 列表对照、添加候选、改名、恢复步骤；同步 commands/configure/deployment/install/multiplexers/troubleshooting/upgrading、环境样例和 PR 模板。 | [bdc5bb83](https://github.com/AltanS/collie/commit/bdc5bb83)、[bd3adc5f](https://github.com/AltanS/collie/commit/bd3adc5f)、[15f1f987](https://github.com/AltanS/collie/commit/15f1f987) |
| 品牌与赞助 | README 的旧 WebP hero 换成 collie-brand 提供的完整社交卡 PNG；更新 GitHub Sponsors 用户名。 | [76b31d18](https://github.com/AltanS/collie/commit/76b31d18)、[c54b6192](https://github.com/AltanS/collie/commit/c54b6192) |
| 回归覆盖 | 增加 SSH 候选及配置解析、per-host mux、多会话、旧响应丢弃、重连／退避／升级终态、staging 日志、runner 交接、pidfile、图片和 blob、更新计时／布局／重载、多语言及文档生成测试。 | 上述功能提交及 [6580f71d](https://github.com/AltanS/collie/commit/6580f71d) |

## 上游取舍与保留的下游功能

本次没有独立的下游功能被上游等价实现替换；新能力和既有上游模块的修复直接采用上游。

| 位置 | 升级前 → 升级后 | 取舍 |
| --- | --- | --- |
| 多主机控件及状态标签 | 统一套用 lead 能力、故障统一告警 → 按目标机器能力展示，区分重连与需处理 | 全部采用上游，接入现有 statusline 最前方的 HostChip，不新增第二行目标条 |
| 更新页与横幅 | 旧 staging 和成员进度 → 新日志、计时、稳定按钮、统一状态和重载保护 | 采用上游逻辑，保留下游压缩的横幅间距 |
| 镜像与 History | Pi／OMP 图片缺失或占位黑块 → 上游按需图片读取、卡片及 blob 转发 | 采用上游图片实现，和下游文本底色共存，不恢复曾撤销的启发式硬换行拼接 |
| Codex 输入 | 已有纯文字、图片、多图、图文混排、空行、图片标记／绝对路径、工作中引导发送保护 | 没有等价上游改动，全部保留；错误信息完整显示仍保留 |
| 文本与 diff 底色 | 输入灰色加粗、连续矩形底色、左右等宽留白 | 没有等价上游改动，保留；正文换行继续跟随上游，不额外猜测原文 |
| Composer 与安全区 | 四个紧凑 icon+文字按钮、输入与按键合并、直接输入不自动聚焦、底部区域延伸覆盖 iOS 安全区 | 没有等价上游改动，保留；中文“输入”继续与上游一致，按键与多语言换行布局不改回旧式 |
| statusline | 横向滚动、上下文 used／remaining 圆环与容量颜色、Fast 空心／实心闪电、沙漏动画、目标主机前置 | 没有等价上游改动，全部保留，包括输入时持续显示 |
| 顶栏 | 窗格切换在溢出菜单旁，专注按钮在切换左边且由 Settings 控制 | 保留入口布局及既有专注交互、退出、横屏自动模式 |
| 通知 | 按会话命名、已读同步、静默撤回及旧通知不复活 | 上游本次未替代这部分，保留本机及 peer 的通知清理 |
| 字体与显示 | Geist／Geist Mono web font、重命名输入 16px 防 iOS 放大、展示版本无 dev／dirty | 没有等价上游改动，全部保留 |
| 本机运行及发布 | main、带注释 `+collie.N` 标签、Herdr 管理的 Collie 安装 | 保留；不创建 Release、不恢复 workflow、不切换主题分支、不重启 Herdr 或 Headroom |

## 合并适配与验证

采用双亲 merge，功能合并与版本发布分开提交。

- 源码自动合并成功；手动处理版本文件、两边 CHANGELOG 历史和已删除 workflow 的冲突。
- 内嵌手册的目录覆盖测试排除下游 `upstream-v*.md` 升级审计报告，十篇操作手册仍完整检查；不把历史升级报告塞入产品的 CLI 手册。
- 发布脚本对版本字符串做完整正则转义，新增 `+collie.1` 的回归测试；合并时将最新旧下游条目迁移为上游分组格式，新版本采用同一格式。
- Pi blob 路径测试改为比较 realpath，兼容 macOS `/var` 与 `/private/var` 指向同一路径；生产路径包含检查不变。
- root `bun run build` 通过，包含两侧类型检查、CLI 编译及前端构建；全树 lint 通过。未安装 Nix，按仓库支持的本机 Bun 流程验证。
- 前端全量：200 个文件，5723 项通过，30 项 todo。
- 后端全量初次 2978 项通过，唯一失败是上述 macOS 路径断言；修正后 Pi 与内嵌手册相关 42 项全部通过。CLI 全量 1401 项、scripts 全量 82 项全部通过。
- collie-ctl、payload 链接、Bun 下载脚本、tag、flake guard、pre-commit、AUR 配方和包刷新共八组 shell 检查通过。
- `scripts/collie-cli.test.sh` 保留一项已知平台限制：本机 macOS 走 detached-child 交接，而 Linux 专用断言要求 `systemd-run --user --collect`，该脚本未全绿；未为测试改写正确的平台行为。
- 隔离 Chromium／WebKit 验证 320／390px、中英文、明暗主题共 16 组：顶部按钮顺序、44px 点击区域、无页面横向溢出、Settings 显隐及专注进入／退出均通过。API 全部模拟，不向真实 agent 发送内容；不把浏览器模拟声称为 iPhone PWA 真机验证。
- 本机部署仍使用已安装 checkout 构建，随后只调用 `herdr.collie` 的 restart；交付时核对本机与 Tailnet 的配置、snapshot、前端 build ID 及实际连接状态。
