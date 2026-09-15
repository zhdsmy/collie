# 上游 v1.9.1 合并记录

本报告核对上游 `v1.9.0` 到 `v1.9.1` 的 Release、CHANGELOG、提交历史和实际文件差异，并记录下游冲突取舍。目标下游版本为 `v1.9.1+collie.1`。

| 项目 | 核对结果 |
| --- | --- |
| 上游起点 | `71678c20e61d000f97fe87c7782cd3c7b99b01f9`（`v1.9.0` tag 指向的提交） |
| 上游终点 | `6fb0f1f511f976a1cef246e945d94b29e2331c2f`（`v1.9.1` tag 指向的合并提交） |
| 上游 release commit | `f7064e573e102e181adf71ac7b1bb60a32bae03d` |
| 上游范围 | 18 个提交，71 个文件，新增 2,769 行、删除 399 行 |
| Release | [v1.9.1](https://github.com/AltanS/collie/releases/tag/v1.9.1)，2026-09-15 |
| 完整差异 | [v1.9.0...v1.9.1](https://github.com/AltanS/collie/compare/v1.9.0...v1.9.1) |

正式 tag 位于版本提交之后的 Codex PR #224 合并提交，因此完整范围终点是 `6fb0f1f5`，不能只比较到 `f7064e57`。

## 冲突取舍

用户要求冲突功能先说明两侧变化，再由用户选择。本次已按选择完成合并。

| 功能 | 本地方案 | 上游方案 | 最终方案 |
| --- | --- | --- | --- |
| Composer 按键区 | 32px 紧凑高度、统一背景、取消右侧渐隐；按键合入输入且点击不自动弹出键盘 | 40px belt、Harness/Agent 分区着色、右侧 64px 渐隐和固定 Switch；输入行增加 4px 顶部间距 | 采用上游 `actions-row.tsx`、测试和 `harness-bar.tsx` 的完整实现：40px、分区着色、渐隐和固定 Switch；保留本地合并 Input、无自动聚焦/弹键盘及独立安全区实现 |
| Codex 输入与 diff 背景 | 已发送输入和 diff 使用连续整行矩形，ANSI segment 不改变 | 共享 `light-fill.ts`，用亮度阈值识别近白背景，并在移动端透明化 | 保留本地整行矩形和 ANSI segment 行为；采用上游 `isLightFill(..., NEAR_WHITE_FILL_LUMA)` 检测，覆盖 240/244；不采用上游的移动端透明化呈现 |
| Muse 显示接入 | 无对应本地功能 | 以 `rendersNativeMirror` 为唯一入口，亮色原生渲染 | 采用上游实现；属于机械接入，不改变本地输入、statusline 或安全区功能 |

本次因此替换了本地 Composer 的统一背景、32px 高度和无渐隐方案；Codex 只替换固定色值检测，不替换本地矩形渲染。其余本地卡片化、模型列表、statusline、字体、Hermes/Claude 显示、通知去重、输入发送保护和 iOS 安全区实现继续保留。

## 上游用户可见变化

### 紧急补丁通知

补丁版本可以在 CHANGELOG 版本标题下、首个 `###` 分组前添加一行：

```md
**Urgent.** Updating from 1.9.0 leaves the service stopped.
```

发布脚本从同一份 CHANGELOG 生成 `collie-release.json`，其中包含版本、crew 协议版本和可选的紧急原因。原因必须是单句纯文本、以句号结束且不超过 140 个字符；近似格式、空原因、反引号或 Markdown 链接都会阻止发布。release 页面把该句放在最前面。

Bridge 会读取更新差异中最新 10 个版本的 sidecar，区分明确不存在的 404 和临时读取失败，并缓存成功读取结果。最新的 urgent 版本决定提示原因。超过本地 09:00 后，尚未通知的 urgent 更新会立即突破当天普通窗口发送；早于 09:00 发布则等到当天 09:00。通知后，包含该 urgent 版本的 patch 队列使用 daily cadence，不再使用普通 patch 的 weekly cadence。

更新推送正文以发布者原文开头；设置更新卡片显示完整原因和 `Urgent` 或 `Urgent since <version>`；更新横条只显示短标签。标签翻译为七种语言，原因保持发布者英文原文。旧 Collie 会忽略该可选字段，继续使用原来的更新节奏，直到完成一次升级。

来源：[53dbaaa2](https://github.com/AltanS/collie/commit/53dbaaa2)、[ef171a8d](https://github.com/AltanS/collie/commit/ef171a8d)、[ADR 0046](../.adr/0046-an-urgent-patch-keeps-the-daily-cadence.md)。

### Composer belt 与输入间距

上游把按键 belt 的可见高度从 32px 调整为 40px，按钮上下各保留 4px；Harness 分区同步延伸着色，并通过 `overflow-y-hidden` 保证 belt 只横向滚动。输入行增加 4px 顶部间距，让输入框 focus ring 不贴住 belt 底边，底部不额外增加重复间距。

下游最终采用上游 belt 的完整布局，同时保留本地合并 Input、点击不自动打开键盘和安全区处理。

来源：[a0ae39e7](https://github.com/AltanS/collie/commit/a0ae39e7)。

### Herdr 0.9 完成状态

Herdr 0.9 API 可能把已完成 agent 报为 `idle`，而终端客户端根据自己的回执显示 `done`。上游让两种 settled 状态都参与 Collie 自己的 `Ready · unseen` 判断，仍以 `lastActiveAt > lastSeenAt` 为准并排除 shell。

只有 `working` 或 `blocked` 转为 `idle` 才算一次新的完成； `done → idle` 的 Herdr 确认和 `unknown → idle` 的识别抖动不会重新制造未读。agent 退出时清除其活动记录，避免后续 shell 或新 agent 继承旧未读状态。tmux 和 zellij 的 beacon 完成状态同样适用。升级后，之前完成但未打开的窗格可能补显示一次未读，打开后清除。

来源：[PR #222](https://github.com/AltanS/collie/pull/222)、[2be89b59](https://github.com/AltanS/collie/commit/2be89b59)、[412b63ce](https://github.com/AltanS/collie/commit/412b63ce)。

### Muse 亮色显示

Muse 在亮色主题下使用页面背景和原生中间色调，不再整体套用镜像反色滤镜，避免正文变成低对比度灰字。亮色前景色通过亮度判断后改为深色，已有背景的文字保持原色，muted 装饰色使用亮色主题对应的灰色；暗色渲染保持原有颜色。

适配覆盖正常镜像、关闭语法优化后的原始终端视图和搜索当前匹配，仅对 `muse` agent 生效。显示逻辑通过共享 `rendersNativeMirror` 入口接入，不注册完整 Harness adapter，因此不会改变回复发送行为。

已记录 Herdr 0.9 通过 OSC 10/11 返回主题颜色的实测背景；旧版 Herdr 无返回值时仍使用已记录的 fallback。未设置明确 light/dark 偏好的操作系统存在亮色前景可读性边缘情况。

来源：[PR #221](https://github.com/AltanS/collie/pull/221)、[27160517](https://github.com/AltanS/collie/commit/27160517)、[00ea3459](https://github.com/AltanS/collie/commit/00ea3459)、[efa861f2](https://github.com/AltanS/collie/commit/efa861f2)、[8ecf2c53](https://github.com/AltanS/collie/commit/8ecf2c53)。

### Codex 浅色背景兼容

Codex 0.154.0 的浅色背景可能从 `rgb(240,240,240)` 变为 `rgb(244,244,244)`。上游把 OMP 原有的背景判断抽到 `web/src/lib/harness/light-fill.ts`，使用 Rec.709 亮度而不是固定颜色：OMP 阈值为 180，Codex 阈值为 220，并支持 RGB、hex 和 ANSI 颜色变量。

下游保留本地输入和 diff 的整行矩形、连续留白以及原始 ANSI segment；Codex display 只改用上游亮度检测，仍保留本地呈现规则。因此 240/244 都会被识别，但不会因上游的 mobile-transparent 处理而改变本地矩形显示。

来源：[PR #224](https://github.com/AltanS/collie/pull/224)、[ebd63ffd](https://github.com/AltanS/collie/commit/ebd63ffd)。

## 文档、发布和测试

安装页重排为 Install、Update、Uninstall，并分别说明 Herdr plugin、独立安装和包管理器的命令、配置路径、状态路径及卸载后保留的数据。README 和升级文档同步引用新结构，通知文档修正 prompt-cache 锚点。新增 ADR 0046、0047，并更新 ADR 索引、Herdr 0.9 状态契约、镜像反色例外和 `CLAUDE.md` 的 urgent/WebKit 说明。

Playwright 增加手机 WebKit 项目，与 Chromium 使用同一组应用测试；CI 中始终启用，本地通过 `COLLIE_E2E_WEBKIT=1` 启用，使用 iPhone 设备描述而不是仅缩窄桌面视口。新增 belt 几何测试，验证只横向滚动且最后按钮不被固定 Switch 覆盖。

发布读取脚本把 urgency 和 crew protocol 从同一份 CHANGELOG、同一份协议常量生成到 sidecar，并补充解析、缓存、更新卡片、更新横条、状态和单机兼容测试。三个上游版本文件更新为 1.9.1；没有 crew 协议号、Herdr 最低版本或 lockfile 调整。下游继续删除 workflows，不恢复 GitHub Actions。

## 上游完整文件清单

以下列出 tag-to-tag 差异中的全部 71 个文件。

### 决策、协议与文档（12）

`.adr/0002-invert-the-light-terminal-mirror.md`、`.adr/0003-one-shared-seen.md`、`.adr/0046-an-urgent-patch-keeps-the-daily-cadence.md`、`.adr/0047-muse-panes-render-natively.md`、`.adr/README.md`、`CHANGELOG.md`、`CLAUDE.md`、`HERDR_API.md`、`README.md`、`docs/install.md`、`docs/upgrading.md`、`docs/voice-and-push.md`。

### Bridge 与更新逻辑（7）

`bridge/activity-tracking.ts`、`bridge/index.ts`、`bridge/solo-baseline.test.ts`、`bridge/state-engine.test.ts`、`bridge/types.ts`、`bridge/update.test.ts`、`bridge/update.ts`。

### CI、发布和版本元数据（5）

`.github/workflows/ci.yml`、`.github/workflows/release.yml`、`herdr-plugin.toml`、`package.json`、`web/package.json`。

### 发布脚本（4）

`scripts/release-notes.test.ts`、`scripts/release-notes.ts`、`scripts/release-reading.test.ts`、`scripts/release-reading.ts`。

### 浏览器测试（2）

`web/e2e/belt.spec.ts`、`web/playwright.config.ts`。

### Composer、镜像和更新组件（15）

`web/src/components/actions-row.test.tsx`、`web/src/components/actions-row.tsx`、`web/src/components/agent-chat.test.tsx`、`web/src/components/agent-chat.tsx`、`web/src/components/agent-list.test.tsx`、`web/src/components/agent-sidebar.test.tsx`、`web/src/components/ansi-output.test.tsx`、`web/src/components/ansi-output.tsx`、`web/src/components/composer.tsx`、`web/src/components/harness-bar.tsx`、`web/src/components/mirror-space.test.ts`、`web/src/components/mirror-space.ts`、`web/src/components/update-card.test.tsx`、`web/src/components/update-card.tsx`、`web/src/components/update-ribbon.tsx`。

### 终端 fixtures（2）

`web/src/fixtures/panes/README.md`、`web/src/fixtures/panes/codex--v0154-submitted-fill.txt`。

### 渲染与 Harness（11）

`web/src/index.css`、`web/src/lib/ansi.ts`、`web/src/lib/harness/codex.test.ts`、`web/src/lib/harness/codex/display.ts`、`web/src/lib/harness/index.test.ts`、`web/src/lib/harness/index.ts`、`web/src/lib/harness/light-fill.test.ts`、`web/src/lib/harness/light-fill.ts`、`web/src/lib/harness/muse/display.test.ts`、`web/src/lib/harness/muse/display.ts`、`web/src/lib/harness/omp/display.ts`。

### 国际化（7）

`web/src/lib/i18n/messages/de.ts`、`web/src/lib/i18n/messages/en.ts`、`web/src/lib/i18n/messages/es.ts`、`web/src/lib/i18n/messages/ja.ts`、`web/src/lib/i18n/messages/ko.ts`、`web/src/lib/i18n/messages/zh-TW.ts`、`web/src/lib/i18n/messages/zh.ts`。

### 分类与更新状态（6）

`web/src/lib/solo-baseline.test.ts`、`web/src/lib/triage.test.ts`、`web/src/lib/triage.ts`、`web/src/lib/types.ts`、`web/src/lib/update-ribbon.test.ts`、`web/src/lib/update-ribbon.ts`。

## 上游全部提交

- [236941d6](https://github.com/AltanS/collie/commit/236941d6) `test(e2e)`: WebKit 加入浏览器测试层。
- [ef776e9b](https://github.com/AltanS/collie/commit/ef776e9b) `docs(install)`: 重排安装、更新、卸载文档。
- [96e451a4](https://github.com/AltanS/collie/commit/96e451a4) `docs(push)`: 修正 prompt-cache 文档锚点。
- [27160517](https://github.com/AltanS/collie/commit/27160517) `fix(mirror)`: Muse 亮色模式原生渲染。
- [00ea3459](https://github.com/AltanS/collie/commit/00ea3459) `[pr-staff-review]`: 修正 Muse review 发现的问题。
- [efa861f2](https://github.com/AltanS/collie/commit/efa861f2) `docs(adr-0046)`: 用实时 pane.read 数据修正颜色说明。
- [a0ae39e7](https://github.com/AltanS/collie/commit/a0ae39e7) `fix(composer)`: belt 使用 40px，输入 focus ring 留出间距。
- [2be89b59](https://github.com/AltanS/collie/commit/2be89b59) `fix(triage)`: 暴露 Herdr idle 完成。
- [8ecf2c53](https://github.com/AltanS/collie/commit/8ecf2c53) `fold(#221)`: Muse 决策编号统一为 ADR 0047。
- [53dbaaa2](https://github.com/AltanS/collie/commit/53dbaaa2) `feat(update)`: urgent patch 保持 daily cadence。
- [ef171a8d](https://github.com/AltanS/collie/commit/ef171a8d) `docs(adr-0046)`: 明确 urgent 原文和后续处理约束。
- [412b63ce](https://github.com/AltanS/collie/commit/412b63ce) `fold(#222)`: 只有真实结束的 turn 才计为新活动。
- [ebd63ffd](https://github.com/AltanS/collie/commit/ebd63ffd) `fix(codex)`: 浅色背景按亮度识别。
- [f7064e57](https://github.com/AltanS/collie/commit/f7064e57) `chore(release)`: 1.9.1。
- [7e521c6d](https://github.com/AltanS/collie/commit/7e521c6d)：合并 Muse PR #221，关联 issue [#220](https://github.com/AltanS/collie/issues/220)。
- [2d47d768](https://github.com/AltanS/collie/commit/2d47d768)：合并 `fold-222` 分支。
- [769cdaa8](https://github.com/AltanS/collie/commit/769cdaa8)：合并 Herdr idle PR [#222](https://github.com/AltanS/collie/pull/222)。
- [6fb0f1f5](https://github.com/AltanS/collie/commit/6fb0f1f5)：合并 Codex PR [#224](https://github.com/AltanS/collie/pull/224)，关联历史 issue [#144](https://github.com/AltanS/collie/issues/144)。

## 验证与部署

本次验证覆盖上游变更和两项冲突取舍，不依赖实际会话发送测试消息。

- 后端、CLI 和发布脚本：4,873 项通过，附加 shell 与打包检查通过。沙箱内的 socket
  用例因 EPERM 失败后，在宿主环境完整复跑通过，没有修改产品代码规避权限。
- 前端：全量运行后修正受合并影响的测试并定向复跑，覆盖 8,037 项通过，53 项既有 todo。
  Composer 外观断言同步为上游；Hermes 横线断言读取 CSS 变量的内联值，避免 jsdom
  无法计算变量边框色造成假失败；旧、新 Codex 底色均验证完整矩形、链接与查找偏移。
- 手机浏览器：Chromium 与 WebKit 共 16 项通过，覆盖中、英、德文、亮暗主题、
  320/430px 输入布局，以及按钮区只横向滚动、最后按钮不被 Switch 遮住。
  合并 Input 没有自动聚焦，Ctrl/方向键、Fn 切换和重新打开后的状态均已检查。
- 根目录 lint、两端 typecheck、完整 build、版本一致性与冲突标记检查通过。
  diff 空白检查仅豁免上游原样保留的真实终端捕获，其行末空格是终端列数据；
  已核对该 fixture 与上游逐字节一致。
  浏览器截图已检查；这是隔离的手机浏览器模拟，不是连接 iPhone 的真机验收。

发布版本采用 `v1.9.1+collie.1`，只推送 main 和对应 annotated tag，不创建 Release。
按默认流程部署到 `/Users/michael/.local/share/collie` 并重启 `herdr.collie`；
保留旧二进制和前端产物作为回退副本，不修改运行配置。
交付前必须确认新 PID 监听 8788，本机和 Tailscale 入口的 build-info、api/config、
api/snapshot 都返回 200 且 build ID 与安装产物一致。
