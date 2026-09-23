# 上游 v1.12.0 合并报告

本次从 `v1.11.1+collie.8` 跟进上游 `v1.12.0`，目标下游版本为
`v1.12.0+collie.1`。本报告按上游 Release、上游 `CHANGELOG.md` 和最终
`v1.11.1..v1.12.0` tag-to-tag diff 交叉整理；验证结果由主代理在完成全部冲突处理、构建和部署后补入。

## 基线与范围

- 下游起点：`d2182396`（`v1.11.1+collie.8`，Codex 0.156 空输入框兼容修复）。
- 上游起点：`v1.11.1`（`400151e5`）；目标 tag：`v1.12.0`，其发布提交为
  `f994ab84`，annotated tag 对象为 `715c8689`。
- 上游 tag-to-tag diff：295 个文件，新增 15,933 行，删除 4,809 行。
  其中较大部分是 Harness 语料、单元/浏览器测试、ADR 和多语言文案；不是全部产品逻辑。
- 官方链接：[Release](https://github.com/AltanS/collie/releases/tag/v1.12.0) ·
  [完整比较](https://github.com/AltanS/collie/compare/v1.11.1...v1.12.0) ·
  [上游 CHANGELOG](https://github.com/AltanS/collie/blob/v1.12.0/CHANGELOG.md#1120---2026-09-23) ·
  [发布提交](https://github.com/AltanS/collie/commit/f994ab843201ea6ab5342154be50aa1e46a12454)。

## 上游完整变化

以下覆盖 v1.12.0 `CHANGELOG` 的全部 Added、Changed、Fixed 项，并补充 tag-to-tag
diff 中没有在发布摘要逐项展开的兼容、文档、测试和打包变化。

### 新增功能（Added）

| 项目 | 变化与实际效果 | 主要提交 |
| --- | --- | --- |
| 未识别对话卡片 | 当 Harness 无法确认当前画面仍有可安全输入的对话框时，显示“Collie cannot read dialog”卡片，并展示该 Agent 声明的退出键。Claude、Codex、Muse、AGY 使用 Escape，grok 使用 Ctrl+C，Escape 在 grok 中进入滚动回看。卡片锁定自由文本输入；Send 仍提供一次备用发送路径，避免误判把用户永久锁在输入区。OMP 暂未纳入。 | [11ce4aa6](https://github.com/AltanS/collie/commit/11ce4aa6) |
| `/effort` 等级卡片 | 读取 Claude `/effort` 当前 marker，把 low、medium、high、xhigh、max、ultracode 显示成可点击选项；点击选项移动原生 marker，Confirm、This session only、Cancel 仍由原生界面处理。窄窗格下也能从折行后的 slider/footer 中重建完整等级。 | [4e7dde57](https://github.com/AltanS/collie/commit/4e7dde57)、[acbe8d99](https://github.com/AltanS/collie/commit/acbe8d99)、[35870a5f](https://github.com/AltanS/collie/commit/35870a5f)、[c3a82215](https://github.com/AltanS/collie/commit/c3a82215) |
| 任意子路径部署 | 新增 `COLLIE_BASE_PATH`，也可在 `[serve]` 配置中设置 `base_path`。bridge、API、静态资源、manifest、service worker、导航回退、字体缓存和 Tailscale Serve 都使用同一挂载路径；同一个构建产物可部署在 `/` 或 `/collie/`，不需要重新构建。更换挂载路径后，手机上的 PWA 需要删除并重新添加到主屏幕。 | [2b9fe4c1](https://github.com/AltanS/collie/commit/2b9fe4c1)、[462ddfa3](https://github.com/AltanS/collie/commit/462ddfa3)、[23055728](https://github.com/AltanS/collie/commit/23055728)、[ADR 0052](../.adr/0052-one-build-serves-any-mount.md) |
| GitHub release check token | 更新检查可使用 `COLLIE_GITHUB_TOKEN`、`GH_TOKEN` 或 `GITHUB_TOKEN`，按此顺序取第一个非空值；token 只用于 GitHub API 的 tag 查询，不用于下载，不打印其值。无 token 时仍使用匿名请求，并将 401 与 403/429 区分。 | [0b44e3ca](https://github.com/AltanS/collie/commit/0b44e3ca) |
| 无 Git checkout 的 crew lead | 由 standalone install 或包管理器安装的 lead 现在可以通过自身 release 给成员安装同一版本，不再要求 lead 有 git checkout。远端安装使用随 SSH 发送的 installer、release manifest 和 sha256 校验；`--path` 在该路径表示安装根目录，已有相反安装类型的成员会被拒绝覆盖。 | [0e06e4ff](https://github.com/AltanS/collie/commit/0e06e4ff) |
| 每个窗格的原生渲染开关 | Light theme 下默认 mirror 反色可能把本来是浅色的 agent 窗格变得难读。Display 设置新增按窗格的 native/mirror 选择，可独立覆盖反色方向；重新选择 agent 自己的默认答案会清除覆盖，不会把旧检测结果永久锁死。 | [351ca2df](https://github.com/AltanS/collie/commit/351ca2df)、[fca2754a](https://github.com/AltanS/collie/commit/fca2754a)、[939f5317](https://github.com/AltanS/collie/commit/939f5317)、[faae4c0d](https://github.com/AltanS/collie/commit/faae4c0d) |
| 多照片选择 | 附件选择器可以一次选择多张照片，按选择顺序逐张上传，并沿用单照片的大小与类型校验；普通文件选择器不变。 | [73807566](https://github.com/AltanS/collie/commit/73807566) |

### 交互和布局变化（Changed）

| 项目 | 上游行为与用户可见变化 | 关联提交 |
| --- | --- | --- |
| Effort 卡片收敛 | Effort 卡片只显示等级 chips，不再在 chips 上方重复渲染已经折行的原生 slider 行。`/model`、`/tasks` 等没有结构化等级解析的通用菜单仍保留原生 mirror。 | [3b9616da](https://github.com/AltanS/collie/commit/3b9616da) |
| Composer 单框 | 附件入口、文本输入和 Send 合并到一个边框内，长草稿增长时按钮保持贴在底部，整框获得焦点边框。Ctrl+Enter 发送，裸 Enter 换行；草稿仍按原有路径发送给终端。 | [e2d040ec](https://github.com/AltanS/collie/commit/e2d040ec)、[4e77501f](https://github.com/AltanS/collie/commit/4e77501f)、[5d97d957](https://github.com/AltanS/collie/commit/5d97d957) · [ADR 0057](../.adr/0057-the-composer-is-one-box.md) |
| 卡片固定停靠 | QA、菜单、选择器等可解析卡片统一停靠在 Keys belt 上方，不再跟随正文滚动；卡片很高时在自己的区域内滚动，不会把 Composer 推出屏幕。 | [721499d8](https://github.com/AltanS/collie/commit/721499d8) · [ADR 0059](../.adr/0059-a-card-docks-above-the-belt.md) |
| 附件 chip | 已选择的照片以缩略图、文件名和编号 chip 显示，删除使用 chip 自己的操作；正文中保留 `[Image #N]`/`[File #N]` 短标记，真正发送时才替换为路径，避免路径撑大输入框。 | [24aca425](https://github.com/AltanS/collie/commit/24aca425) · [ADR 0060](../.adr/0060-an-attachment-is-a-chip-not-a-path.md) |
| 终端草稿提示浮层 | 在终端直接输入产生的草稿提示浮在底部 belt 上方，不再参与 Composer 的普通布局高度；可以关闭提示，直到草稿消失、接管或发送。 | [0471476a](https://github.com/AltanS/collie/commit/0471476a)、[61be3d37](https://github.com/AltanS/collie/commit/61be3d37) · [ADR 0061](../.adr/0061-the-terminal-draft-notice-floats.md) |
| Tab/Panes 密度 | 当前 tab 用字重和墨色表示，不再依赖下划线；tab 行和 pane 行高度缩小，同时保留 44px 触控命中区，减少窄屏底部空间浪费。 | [b1430d56](https://github.com/AltanS/collie/commit/b1430d56) |

### 修复（Fixed）

- **Dashboard filter strip 不再被横向拖出屏幕。** 修复 overflow 导致 chip 被裁剪、失去点击区域的问题。[6b6292ed](https://github.com/AltanS/collie/commit/6b6292ed)
- **Keys tray 的 Enter 改为跨两行的独立按键。** Enter 与箭头分区，箭头形成倒 T，Space、Shift、Tab 和方向键使用图标；同时修复 Enter 跨行和窄宽度下 Ctrl+C 显示为 `^C`。[6d7e701a](https://github.com/AltanS/collie/commit/6d7e701a)、[879c1eab](https://github.com/AltanS/collie/commit/879c1eab)
- **长机器名不再撑宽 Dashboard。** 主机名在窄屏上截断为省略号，避免 375px 手机横向滚动。[8034a656](https://github.com/AltanS/collie/commit/8034a656)
- **Muse 引用式对话仍可发送。** 识别 question、checkbox、note、review 等对话形状时，只接受位于实时输入框上方的结构，避免把 transcript 里的相似文本误判为当前 dialog。[fe44ae0e](https://github.com/AltanS/collie/commit/fe44ae0e)
- **Claude shell mode 恢复为可识别的 live input。** `!` prompt 被当作 shell 输入框，shell 提示移入 status strip；其他普通正文行中的 `!` 不会被误识别。[c9c3f3d8](https://github.com/AltanS/collie/commit/c9c3f3d8)
- **crew 成员休眠不再阻止本机更新。** 只要当前 lead 本机健康，成员故障显示为可说明的 crew fault，不会让本机更新按钮整体变红；需要成员更新时仍保留明确的失败和跳过原因。[a11b81e4](https://github.com/AltanS/collie/commit/a11b81e4)
- **`collie doctor` 优先询问 bridge 的 restart-needed。** 不再只依赖 systemd、launchd、pidfile 或 `/proc` 猜测，无法读取进程信息的平台也能基于 bridge snapshot 给出结果。[fcef456c](https://github.com/AltanS/collie/commit/fcef456c)
- **Codex 不再保留 statusline 上方的深色空条。** mirror 清理原生 composer prompt 后，连带移除其背景空行，输入绑定和正文段距不变。[e46e8ce5](https://github.com/AltanS/collie/commit/e46e8ce5)
- **crew add 会处理多 mux 成员。** 成员运行多个 multiplexer 时由 lead 提问或接受 `--mux`，写入 `COLLIE_MUX`；只有一个 mux 时沿用自动选择，没有 mux 时只警告不写入。[ef2edf42](https://github.com/AltanS/collie/commit/ef2edf42)
- **Harness chip 不因完成图标而缩窄。** `✓` 出现时保留原有文字宽度，避免相邻控件短暂位移。[ec262d3e](https://github.com/AltanS/collie/commit/ec262d3e)
- **Effort slider 恢复 Confirm/Cancel。** 不再把 `/effort` 的 “Enter confirm” 误判为 folder trust prompt，卡片恢复确认与取消控制。[90a74a55](https://github.com/AltanS/collie/commit/90a74a55)
- **新版 Claude 无编号 folder trust prompt 可操作。** 通过箭头移动当前行并使用 Enter 确认，当前行显示指示；旧的有编号版本仍受支持，默认 “No, exit” 行不会被隐藏。[62f6a8c6](https://github.com/AltanS/collie/commit/62f6a8c6)
- **Claude `/resume` picker 可从卡片恢复。** 点击会移动原生指针并提交选中的会话；卡片只在当前行显示确认提示，不伪造终端没有打印的 Enter 文案。[106d0fdb](https://github.com/AltanS/collie/commit/106d0fdb)、[840fd60d](https://github.com/AltanS/collie/commit/840fd60d)
- **Dashboard 返回时保留滚动位置。** 从 pane 返回列表不再强制跳回顶部。[b12a6a92](https://github.com/AltanS/collie/commit/b12a6a92)

## 兼容、文档、测试与构建变化

### 子路径与服务边界

- `bridge` 配置 schema、server 路由、静态资源、manifest、service worker、导航 denylist、字体缓存和 PWA 注册统一使用运行时 mount；`COLLIE_BASE_PATH` 与 `[serve].base_path` 只描述部署路径，不要求前端重新构建。
- `collie serve`、`collie doctor` 和部署文档开始区分前门和应用路径，新增 Tailscale、Cloudflare Tunnel、Nginx Proxy Manager、NetBird、Caddy 的单一前门示例，并强调 HTTPS、可信 origin 和 pairing 的不同职责。
- service worker 不能把根路径的 `/index.html`、字体或通知资源误当成子路径资源；缓存名称也按 mount 隔离，避免同一 origin 的两个 Collie 互相清理字体缓存。

### Crew、更新和安装

- CLI 新增/扩展安装类型探测、release installer embed、mux probe 和远端 testdata；checkout lead 与 release/package lead 采用不同的成员更新路线。
- release/package lead 对 git checkout 成员明确跳过并给出 `collie update --to-tag v<version>`；checkout lead 对 install.sh 成员交给手机 Updates 页面，不停止整个 crew run。
- 更新检查、安装脚本和配置文档同步 GitHub token 的读取顺序、401/403/429 错误语义和不把 token 带入 release 下载的约束。
- `doctor`、crew update、member preflight、远端安装和 server snapshot 的测试覆盖新增成功、拒绝、休眠、混合安装类型及无 git lead 的边界。

### Harness、UI 和浏览器测试

- 新增 `unread-dialog`、`effort`、`resume`、`card-dock`、`attachment-chip`、`option-button` 等模型、组件和交互测试；通用 blocks/prompt/menu contract 也同步更新。
- Claude 2.1.278 capture-lab corpus、shell mode、无编号 trust prompt、Effort slider 的 40/60/80/120/132 列样本加入契约；Muse 两段引用草稿和 dialog-lookalike 样本加入回归覆盖。
- 新增 `codex-padding`、filter strip、pane top bar、nav-tray Enter 等移动浏览器场景；多语言字典同步新增 effort、card、attachment、draft notice、base path 和更新提示文案。
- ADR 0050 至 0061 记录 crew 故障边界、React Router library mode、任意 mount、未读 dialog 退出、可点击 scale、指针确认、卡片回退终端、单框 Composer、resume Enter、CardDock、attachment chip 和浮动草稿提示；ADR 0002、0015、0047 及 DESIGN/贡献文档同步修订。

### 打包与发布

- `herdr-plugin.toml`、根 `package.json`、`web/package.json` 从 1.11.1 更新至 1.12.0。
- AUR 与 Nix 源文件在此上游 tag 中仍以可获得的 1.11.1 归档及校验和为准，未凭空填写尚未生成的 1.12.0 归档；这是上游 tag-to-tag 的实际状态，不应被报告成 1.12.0 二进制已发布。
- 上游 tag 自带发布流程和 release notes；下游仓库保留自己的发布约束，不恢复 GitHub Actions，不创建 GitHub Release，只推送下游 `main` 和精确注释标签。

## 下游取舍与用户可见差异

前三项交互冲突按用户选择采用上游实现；Codex 通用未识别卡片按用户选择保留原生画面。本地可靠性和 iOS 适配继续保留。替换关系如下：

| 功能 | 原有下游行为 | 本次合并行为 | 用户可见差异 |
| --- | --- | --- | --- |
| Composer | 附件在输入框内、发送按钮在框外；按键面板和底部安全区是本地下游布局。 | 采用上游单一边框，把附件入口、输入和 Send 放入同一框，并采用附件 chip 与多照片选择。保留本地按键面板、发送前校验、点击直接输入不自动弹键盘、iOS 底部安全区。 | 输入区边界统一，附件不再以长路径占据正文；发送与附件动作位于同一框内，长草稿仍不会把按钮顶出可视区域。 |
| CardDock | QA、菜单和选择卡片跟随正文镜像滚动，卡片位置随终端输出变化。 | 采用上游固定停靠位，统一放在 statusline/Keys belt 上方，卡片内部独立滚动。 | 从不同正文滚动位置打开同一选择器时，卡片出现在稳定位置；高卡片不再推走 Composer，但卡片内容需要在自己的区域内滚动。 |
| 终端草稿提示 | 草稿提示在 Composer 布局中占据普通高度，可能推高底栏或改变安全区布局。 | 采用上游浮层，可关闭，不参与底部栏普通 flow；仍保留接管和发送保护。 | 提示不再挤压输入区，关闭后不会立即改写手机输入；终端草稿仍然需要明确接管或发送。 |
| Codex 未识别对话 | QA、Plan、Review 等低价值卡片维持原生画面，发送前 guard 阻止文字误入对话框。 | 不为 Codex 声明通用卡片的退出键；其他 Agent 继续使用上游未识别对话卡片。 | Codex 原生选项不会被整屏兜底卡片覆盖，未知画面仍无法直接发送普通文字。 |

### 明确保留的本地下游差异

- 保留可靠发送链路：工作中发送、纯文字、单/多图片、图文混排、空行、斜杠命令、直接输入模式和发送前 guard 不因上游 Composer/CardDock 改造而绕过校验。
- 保留紧凑 statusline、模型显示、上下文 remaining 圆环、Fast/Plan 状态、Hermes/Claude/Codex/Cursor 适配，以及已经确认的输入/diff 矩形背景和换行兼容策略。
- 保留 `useAppViewport`、`100lvh`/`visualViewport`、Composer 覆盖底部安全区和 iOS 键盘收起后的稳定定位；上游 AppShell/Provider 拆分只调整承载位置，不移除这些 viewport 规则。
- 保留本地下游通知行为，包括 `displayPush` 的重复通知抑制、撤回和静默更新；子路径通知资源使用上游 `under()` 兼容，不回退到上游绕过本地通知决策的直写实现。
- Codex 可靠输入绑定、动画星点归一化、statusline 和低价值 QA/Plan 原生显示保持本地既有边界；本次新增的通用 CardDock 不应重新扩大 Codex 专属解析范围。
- 上游通用“未识别对话”卡片在 Codex 90 份样本中会覆盖 37 份（含 QA、Plan、Review）；按用户选择，Codex 不声明该卡片的退出键，因此继续显示原生画面。其他 Agent 仍使用上游卡片；Codex `composerReady` 和发送前 guard 仍阻止普通文字写入原生对话框。
- 当前 Codex fullscreen TUI 在状态行下方多了一行快捷提示；下游只在识别到有效状态行与原生输入框时将提示随输入区移出镜像，保留完整状态行和原有发送校验。
- 不恢复 `.github/workflows/`，不创建 GitHub Release；下游版本使用 `v1.12.0+collie.1`，只推送 `main` 与对应注释标签。

## 验证记录

合并阶段的实际验证（2026-09-23）：

- `git ls-files -u` 为 0，源码无冲突标记。暂存 diff 的非原始终端样本部分通过 `git diff --cached --check`；原始 TUI 样本保留屏幕宽度空格和 CR，因此完整命令会报告这些样本的尾随空白。
- 根目录 `bun run test` 在宿主环境通过；沙箱内 Unix socket 监听被拒绝为 `EPERM`，没有据此修改产品代码。
- Web/Vitest 全套 282 个文件通过，11,275 项通过、67 项现有 `todo`；Codex 原生 QA/Plan/Review 的发送前阻断和 fullscreen 状态行识别另有定向验证。
- Playwright 的 `app-phone`／`app-tablet` 定向检查中，Composer、belt、Codex 原生对话和 PWA 共 33 项通过、9 项跳过；Codex/Claude 间距另有 4 项通过。未把这些检查称作桌面或真机 iOS 测试。
- 合并阶段 `bun run build` 通过；该次构建仍使用合并前的 `1.11.1+collie.8` 版本号。`1.12.0+collie.1` 的版本一致性、正式构建、远端引用和本机服务回读在 release commit 之后逐项验证并于交接时报告。

## 上游提交索引

以下是本次 tag-to-tag diff 中与行为或交付直接相关的提交；完整文件级变化以
[`v1.11.1...v1.12.0`](https://github.com/AltanS/collie/compare/v1.11.1...v1.12.0) 为准：

- 基础、部署与更新：`2b9fe4c1`、`462ddfa3`、`23055728`、`0b44e3ca`、`0e06e4ff`、`ef2edf42`、`a11b81e4`、`fcef456c`。
- 原生渲染与 Codex：`351ca2df`、`fb96f289`、`fca2754a`、`939f5317`、`faae4c0d`、`e46e8ce5`。
- Harness 与 agent 兼容：`90a74a55`、`4e7dde57`、`f853a01e`、`11ce4aa6`、`249a2649`、`c9c3f3d8`、`fe44ae0e`、`acbe8d99`、`62f6a8c6`、`35870a5f`、`106d0fdb`、`c3a82215`、`8ffdf98e`。
- Composer、卡片和移动布局：`b12a6a92`、`3b9616da`、`a4a59832`、`e2d040ec`、`e5303208`、`4e77501f`、`721499d8`、`840fd60d`、`5d97d957`、`24aca425`、`0471476a`、`6d7e701a`、`879c1eab`、`8034a656`、`6b6292ed`、`b1430d56`。
- 文档、样本与发布：`a53e39a0`、`f6bee2c2`、`780bdf76`、`1810c922`、`fcfca1bd`、`67b706dc`、`61be3d37`、`7313470e`、`7dfee360`、`f994ab84`。
