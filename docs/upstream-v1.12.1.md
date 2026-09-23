# 上游 v1.12.1 合并报告

本报告覆盖上游 `v1.12.0..v1.12.1` 的完整 release 摘要，并以 tag-to-tag diff 核对
代码、文档、测试、兼容和打包变化。发布与部署的实际构建标识以交付回读为准。

## 基线与范围

- 上游起点：`v1.12.0`，发布提交 `f994ab84`；目标 tag：`upstream/v1.12.1`，指向
  `f2ac0ab1`。
- 下游合并前 HEAD：`052cab2e`。下游版本号由独立 release commit 决定，本报告不预判
  release tag 或部署状态。
- 上游 tag-to-tag diff：80 个文件，新增 3,352 行、删除 482 行；共 16 个提交，其中
  13 个 first-parent 提交。差异包括 crew 更新状态机、pane 稳定排序、终端单元格绘制、
  更新提示条、测试、协议文档、打包元数据及 release notes 工具。
- 链接：[上游 Release](https://github.com/AltanS/collie/releases/tag/v1.12.1) ·
  [完整比较](https://github.com/AltanS/collie/compare/v1.12.0...v1.12.1) ·
  [上游 CHANGELOG](https://github.com/AltanS/collie/blob/v1.12.1/CHANGELOG.md#1121---2026-09-23) ·
  [tag 提交](https://github.com/AltanS/collie/commit/f2ac0ab1bcb9fe29159e6bda913a8db581d77f46)

## 上游完整变化

v1.12.1 没有 `Added` 条目；以下覆盖 CHANGELOG 中全部 2 条 `Changed` 和 5 条 `Fixed`，
并补充 tag-to-tag diff 中的交付变化。

### 改变（Changed）

| 项目 | 上游行为与用户可见变化 | 主要提交 |
| --- | --- | --- |
| 删除附件 marker 后明确插入位置 | 删除正文中的附件 marker，表示发送时把该附件路径插到文本前面。发送前 chip 改用虚线边框和箭头提示，并更新标题及屏幕阅读器名称；把 marker 输入回来可恢复原位置。见 [ADR 0060](../.adr/0060-an-attachment-is-a-chip-not-a-path.md)。 | [f61a3a4e](https://github.com/AltanS/collie/commit/f61a3a4e) |
| pane 状态变化时保持位置 | 各 pane 列表按 mux/工作区位置稳定排序，不再因为 pane 进入或离开 blocked 状态而上下跳动。Dashboard 按 workspace 分组，顶部汇总 needs-attention 数量；crew 中 pane strip 不会混入另一台机器上 id 相同的 pane。详见 [ADR 0063](../.adr/0063-a-pane-keeps-its-place-when-its-state-changes.md)。 | [bac490b4](https://github.com/AltanS/collie/commit/bac490b4)、[3c40b9f9](https://github.com/AltanS/collie/commit/3c40b9f9) |

### 修复（Fixed）

| 项目 | 上游行为与用户可见变化 | 主要提交 |
| --- | --- | --- |
| 块字符与 Powerline glyph 填满终端单元格 | `█`、半块和 Powerline 边缘不再受字体内容区高度影响而留下细缝；同一行堆叠后边缘对齐。 | [41483043](https://github.com/AltanS/collie/commit/41483043)、[0dbefc92](https://github.com/AltanS/collie/commit/0dbefc92) · [PR #268](https://github.com/AltanS/collie/pull/268) |
| crew 更新沿 lead 指定目标前进 | Lead 只在自己已报告目标版本时才给成员发更新 turn。成员在同一 run 中完成中间版本后，可以在一小时窗口内继续升级到目标版本；其它近期尝试仍受每小时限制，并显示预计等待时间。Lead 回滚、卡住或中断时会关闭尚未启动的成员项并说明原因；run 最长两小时，同一时间只运行一个 crew 更新。详情见 [ADR 0062](../.adr/0062-a-crew-run-levels-to-its-target-and-its-second-step-is-not-a-new-attempt.md)。 | [2beed08a](https://github.com/AltanS/collie/commit/2beed08a)、[a169b75b](https://github.com/AltanS/collie/commit/a169b75b) |
| 手机更新提示条适配窄屏 | 提示文字以省略号截断而不从屏幕边缘溢出；整条 44px 高的提示可以键盘访问并导航到 `/settings/updates`，无障碍名称保留完整句子，关闭按钮仍可独立点击。 | [876132a1](https://github.com/AltanS/collie/commit/876132a1) |
| `OneOf` 替代层限制最小宽度 | Grid 替代层增加 `min-w-0`，避免其中的 nowrap 文本撑宽整列，导致提示条、composer 状态区等窄屏内容越界。另加真实浏览器用例覆盖 jsdom 不提供的布局尺寸。 | [c72125f8](https://github.com/AltanS/collie/commit/c72125f8)、[e48616e3](https://github.com/AltanS/collie/commit/e48616e3) |
| Switch pane 使用完整 pane 地址 | Crew 中多台机器可以拥有相同 pane id；切换列表现在按完整 host-scoped 地址比较和打开，避免把相同裸 id 的另一台机器误标为当前 pane 或打开错误 pane。 | [3c40b9f9](https://github.com/AltanS/collie/commit/3c40b9f9) |

## 兼容、文档、测试与构建变化

### 协议与兼容

- pane 行的紧急程度仍由 triage 状态标记表达，但状态不再决定列表顺序。Lead pane 在前，crew peers 按 member id 排列；每台机器内部按 workspace、合并后 tab 顺序、tabPosition 和 pane id 排序。旧 peer 仍按状态排序时，phone 客户端也会重新计算位置顺序。状态汇总保留“需要关注”的入口，不再靠 blocked 行跳到列表顶部。
- `SnapshotResponse` 的 agents/shellPanes 文档和 `MUX_CONTRACT.md` 说明改为描述稳定位置排序。切换 pane 使用 host-scoped address；与 crew 更新有关的 target、限速及失败原因写入现有 run 状态和文档。ADR 0062 明确该 crew 更新流程没有增加 header 或字段。
- crew 的兼容边界覆盖新旧 lead/member 组合：旧 lead 仍可能先让成员安装中间版本，新 member 能在同一 run 内继续前进；较旧 member 的 hourly limit 由 lead 展示为等待原因。Lead 状态不匹配、回滚和 run 超时均有终止路径。

### 文档与本地化

- 新增 [ADR 0062](../.adr/0062-a-crew-run-levels-to-its-target-and-its-second-step-is-not-a-new-attempt.md) 记录 crew 更新目标、第二步限速豁免、回滚与 run 生命周期；新增 [ADR 0063](../.adr/0063-a-pane-keeps-its-place-when-its-state-changes.md) 记录列表稳定位置、紧急状态汇总和完整 pane 地址。
- `CREW_PROTOCOL.md` 补充 merge 顺序、更新 turn 限速原因和 run 结束规则；`MUX_CONTRACT.md` 将 agentDetection 描述从 triage 排序改为状态标记；`ARCHITECTURE.md`、`docs/upgrading.md`、ADR 索引及附件相关 ADR 同步修订。
- 各语言消息文件（de、en、es、ja、ko、zh、zh-TW）同步 pane 状态计数、提示条、附件 marker 等界面文案。

### 测试与浏览器覆盖

- Crew follow/lead/merge 与更新 action 的单元测试覆盖目标版本 turn、同 run 第二步、每小时限速、lead rollback/stuck/interrupted、等待原因和 run 生命周期。
- UI 测试覆盖附件 marker 与 chip、pane 稳定顺序和分组、pane 数量汇总、ANSI/单元格绘制、Notice/更新提示条、OneOf 窄宽行为及多语言消息。
- 新增 `web/e2e/cell-glyphs.spec.ts` 和 `web/e2e/update-band-overflow.spec.ts`，用真实浏览器分别检查 glyph 单元格高度和手机更新提示条的越界布局。
- `scripts/release-notes.test.ts` 扩展 release note 贡献者署名规则测试。以上是上游新增的覆盖范围；本节不表示本次合并已运行这些测试。

### 打包与发布工具

- `herdr-plugin.toml`、根 `package.json` 和 `web/package.json` 在上游 release commit 中版本改为 `1.12.1`。AUR 的 `PKGBUILD`/`.SRCINFO` 与 Nix `sources.json` 在这段 tag-to-tag diff 中由 `1.11.1` 更新到 `1.12.0`（[0bfc1b31](https://github.com/AltanS/collie/commit/0bfc1b31)），并没有跟进 `1.12.1`；不要把它们描述成已有 v1.12.1 二进制来源。
- `scripts/release-notes.ts` 新增从 CHANGELOG 显式署名提取贡献者的逻辑。只识别紧跟 `Thanks`、`Reported by` 等署名短语的 GitHub handle；代码片段中的文字不参与扫描，维护者自己的 handle 排除，同一 handle 去重后按首次出现顺序保留。生成的 Release bullet 会打印署名，使 GitHub Release 页面能够展示贡献者并生成对应 avatar。该逻辑由 [f2ac0ab1](https://github.com/AltanS/collie/commit/f2ac0ab1) 加入，并配有解析和输出测试。
- 上游 release/version 提交为 [4bf79047](https://github.com/AltanS/collie/commit/4bf79047)。本仓库的发布约束仍以 `CLAUDE.md` 为准，不因上游 release tooling 自动创建或推送 GitHub Release。

## 下游取舍与用户可见差异

本次没有用上游实现替换已采用的下游功能；重叠处合并行为，以下列明。

### 采用及合并方式

- pane 稳定位置、workspace 分组、needs-attention 汇总和 host-scoped 切换均采用上游行为；状态变化不会让行跳动，但紧急程度仍可从汇总、标记和通知辨认。
- 采用上游 `renderCells` 单元格绘制与 OneOf 窄屏修复，同时保留下游 `renderFind` 的镜像查找高亮行为，避免终端查找颜色和原生镜像主题被上游 cell 绘制覆盖。
- `agent-chat` 合并上游 pane 顺序和 `ServerSummary` 行为，同时保留下游 Claude mode/statusline 状态读取。提示条沿用上游截断、可访问和整行导航修复，但继续使用下游既有位置与连接错误优先级，避免更新提示遮住断连状态。

### 保留的下游边界

- Codex 的原生 QA、Plan、Review 对话及状态行继续由终端原生画面表达，不用通用未识别对话卡片覆盖。通用卡片无法保证与 Codex 各类原生对话的退出键和当前焦点一致，覆盖原生选项还可能使用户误以为正在操作原生界面；保留现有 pane/session/input 检查和发送前阻断更可验证。v1.12.1 没有新增该类 prompt card 改动，本次不扩大 Codex 卡片解析范围。
- 本次 Codex warning 入口保持在已识别的 inline statusline：Plan 状态仍由原生彩色标识判定，只移除重复的切换提示；完整警告尾部显示琥珀色图标，数量进入 tooltip/无障碍名称。点击通过现有 prompt binding，重新核对当前 pane、Codex session、warning 与 input 状态后至多发送一次 `f2`。不新增独立 composer warning 卡片或恢复旧的 warning-only composer 尾行兼容，避免把 stale warning、草稿或原生对话误当成安全的键盘输入目标。
- 保留已有 composer 发送校验、草稿状态保护、iOS safe-area/viewport 行为和原生对话输入保护；状态栏动作不绕过这些边界，也不要求后端新增 warning API。

## 验证

- 六处文本冲突已解决；`git ls-files -u` 为空，暂存差异通过 `git diff --cached --check`。
- 根目录完整测试、web 单测（287 个文件、11,314 项通过、67 项 todo）、两侧类型检查和根目录 lint 通过。输入相关 5 组单测共 262 项通过。
- 手机和平板上的新增 glyph、更新提示和 Codex 图文输入浏览器用例共 16 项通过。Codex 用例覆盖纯图片、两图混排、绝对路径与图片标记混合、万字级文本，并核对 multipart 图片字节、发送正文及 320px 横向溢出。它使用模拟 API，不能据此声称真实 Herdr/Codex 端到端已验证。
- 完整 Playwright 套件：合并后 354 项通过、14 项跳过、38 项失败；合并前 `052cab2e` 基线也有同样 38 个失败目录，集合完全一致。失败集中在旧 Claude diff/statusline、Codex model/statusline 和导航键布局断言，不是本次新增输入用例。
- 版本提交、推送及部署后的本地/Tailnet 构建标识以最终交接回读为准。
