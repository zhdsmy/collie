# v1.25.2 上游跟进

基于 `v1.25.1+collie.2` 及其后的部署约束、发送回归测试，合入上游 `v1.25.2`，交付版本为 `v1.25.2+collie.1`。

核对依据：[正式 Release](https://github.com/AltanS/collie/releases/tag/v1.25.2)、[CHANGELOG](https://github.com/AltanS/collie/blob/v1.25.2/CHANGELOG.md)、[完整标签差异](https://github.com/AltanS/collie/compare/v1.25.1...v1.25.2)。实际范围为 46 个提交、121 个文件，没有新增依赖；包含首次发布提交之后重新切入正式标签的两项 core 修复。

## 输入、卡片与状态修复

- **herdr-core 的 revision 按窗格画面计算。** 同一画面被不同读取者查看时不再增加多个 revision，减少画面刚变化后卡片被误拒绝为 `changed`。([f89160f](https://github.com/AltanS/collie/commit/f89160f))
- **慢历史读取不再持续阻塞按键。** 每个窗格最多一个历史读取；程序或 bridge 判断为等待问答的窗格不读历史。一次慢读取后暂停 30 秒，连续慢读取将暂停时间翻倍至最多 5 分钟，快速读取复位；画面重绘不再提前结束暂停。([a05cbae](https://github.com/AltanS/collie/commit/a05cbae)、[fb85e0a](https://github.com/AltanS/collie/commit/fb85e0a))
- **历史读取挂起时仍能显示对话框。** 同时读取当前屏幕，历史请求超过 2 秒则返回屏幕并标注截断，每个窗格只记录一次故障。([be55f2f](https://github.com/AltanS/collie/commit/be55f2f))
- **超时按键表示“未确认”，不会自动重发。** core 可能在请求超时后才投递按键，因此按键板提醒检查终端；问答操作继续读回，确认指针仍在目标上才提交，无法确认结果则保留未知状态。([8e837b1](https://github.com/AltanS/collie/commit/8e837b1))
- **不完整屏幕不能决定发送。** core 的 `complete: false` 转成 `partial`，发送协议等待完整读回；始终不完整则拒绝且不输入、不提交。([46abf1d](https://github.com/AltanS/collie/commit/46abf1d))
- **Codex、Hermes、Muse 的纯文本提示不再当作草稿。** 补齐 Codex 的默认提示、Hermes 的空闲／运行提示及 Muse 的快捷键提示。文本规则仅用于没有样式的读取，不改变带样式的判断。([6c13faf](https://github.com/AltanS/collie/commit/6c13faf)、[5a6e56d](https://github.com/AltanS/collie/commit/5a6e56d)、[b02e4e1](https://github.com/AltanS/collie/commit/b02e4e1)、[53844f0](https://github.com/AltanS/collie/commit/53844f0))
- **Claude 的纯文本建议不再拦住发送。** 任意建议文本通过探针实际落点与 Backspace 读回来区分于真实草稿，保留真实草稿保护；Walky 被草稿暂存的投递也复用此证明。([de9e658](https://github.com/AltanS/collie/commit/de9e658)、[9a6bbf0](https://github.com/AltanS/collie/commit/9a6bbf0))
- **pi 的纯文本问答可以显示选项并回答。** 使用 footer、编号、指针和状态行共同判断，保留带样式的原有路径。([0dfb204](https://github.com/AltanS/collie/commit/0dfb204))
- **Claude 权限卡片支持无粗体标题的读取。** 全部无样式时按已知标题定位边界，避免手机回答被拒绝为找不到顶部。([d92a5d8](https://github.com/AltanS/collie/commit/d92a5d8))
- **屏幕上的可回答问题优先决定“需要你”。** 即使 core 上报 working，识别出的问答仍将状态提升为 blocked，以便展示标记及触发通知。([77897e6](https://github.com/AltanS/collie/commit/77897e6))

## core 兼容、hooks 和诊断

- macOS 上按 `HC_SOCKET`、运行时目录、会话状态目录的顺序寻找 core socket，覆盖没有 `/run/user/<uid>` 的机器。([09d58ac](https://github.com/AltanS/collie/commit/09d58ac))
- 通知按窗格所属 session 名称寻址，修复名称读取之后状态转换未触发的问题。([3c2e62d](https://github.com/AltanS/collie/commit/3c2e62d))
- 大写按键保持大小写；没有程序报告时也可从前台程序识别 omp。([c50d8c5](https://github.com/AltanS/collie/commit/c50d8c5)、[8cd88b0](https://github.com/AltanS/collie/commit/8cd88b0))
- Claude hooks 的安装、卸载、状态和 doctor 优先使用 `CLAUDE_CONFIG_DIR/settings.json`。技能安装仍保留默认 `~/.claude` 目标，没有因 hooks 路径调整而漏掉它。([0700fe4](https://github.com/AltanS/collie/commit/0700fe4)、[6261186](https://github.com/AltanS/collie/commit/6261186))
- 问答操作被拒绝时，bridge 日志记录 ask ID、窗格及原因；crew 成员的窗格读取失败时，lead 按成员、窗格及状态记录一次，持续失败期间不刷屏。([02b8450](https://github.com/AltanS/collie/commit/02b8450)、[6f9534f](https://github.com/AltanS/collie/commit/6f9534f))

## 测试、文档和构建工具

- 新增 Claude、pi、omp 的 core 实录、纯文本整个样本库对照、探针／不完整屏幕／历史阻塞／按键超时等故障测试，并更新对应区域和 Surface 基线。
- 浏览器 rig 支持 `MUX=herdr-core` 及混合 crew；nightly 记录 hc 版本并在同一记录下运行 core solo leg。nightly 仍保持暂停，本轮不安装定时任务。([41d06cc](https://github.com/AltanS/collie/commit/41d06cc)、[760fd1f](https://github.com/AltanS/collie/commit/760fd1f))
- 上游 macOS Release runner 从 macos-14 改为 macos-15。本 fork 继续不恢复 GitHub Workflows、不创建 GitHub Release，采用本机构建及固定签名部署。([6a6bf59](https://github.com/AltanS/collie/commit/6a6bf59))
- `HC_API.md`、multiplexers、troubleshooting 和 rig README 更新 core 的无颜色镜像、历史 hooks、发送时延、宽度及已知限制。上游协作规则新增 core browser leg 说明，本地经济型验证覆盖约定继续生效。([07c1614](https://github.com/AltanS/collie/commit/07c1614)、[8bcdda7](https://github.com/AltanS/collie/commit/8bcdda7))

## 下游取舍

本轮没有以独立上游实现替换已有下游功能；以上为上游修复的直接合入。

保留 Queue／Steer 设置、合并输入区的 Keys、Codex Model／Resume／Agents 等卡片与警告数量、Claude Settings／Agents、Hermes 展示、AGY 紧凑状态栏及 `.pb` 历史后备、字体和操作带定制、固定签名及备份维护规则。`readPane` 继续提供本地模型／首次 token 元数据，同时从已有 StateEngine 参数派生上游 blocked 读取提示；发送协议保留本地 `surfaceRows` 归一化，并在其前加入上游不完整屏幕保护。

新增的纯文本对照测试显式登记 95 个下游既有样本差异：70 个 Codex 卡片、13 个 Claude Agents／Config 卡片、4 个 AGY 输入提示和 8 个 Hermes 历史／本地化提示。它们此前依赖 SGR，去掉样式不保证得到同一结构；本次没有放宽运行时识别。这些是 core 的覆盖边界，不代表正常 Herdr 的现有带样式画面新增了故障。具体文件及原因见 [`fold.plain.allow.json`](../web/src/lib/surface/fold.plain.allow.json)。

pi 问答及 Claude 权限的新增 core 实录已加入适配清单；登记为上游捕获回放，不更新为本机 CLI 的现场认证。

## 验证边界

运行受影响的 core、发送协议、路由、状态、crew、Walky、hooks／doctor 测试，两端类型检查、lint、逻辑样本回放和定向手机浏览器检查。前一轮新增的延迟／不完整粘贴测试随本次合并保留并再次执行。

本机继续使用 Herdr；未安装或切换到 herdr-core，也未启动完整 core browser rig、Windows VM、额外模型调用或定时监测。core 的故障恢复结论来自其隔离 socket／fake-core 测试与上游实录回放；本机部署验收另外检查构建标识、鉴权、snapshot、Documents 文件读取和固定签名。最终数量及部署结果见本次交付消息。
