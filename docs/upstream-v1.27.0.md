# 跟进上游 v1.27.0

基线为 `v1.26.4+collie.1`，目标为 `v1.27.0+collie.1`。已交叉核对 GitHub Release、CHANGELOG 和 `v1.26.4..v1.27.0`：232 个提交（含功能分支合并）、342 个文件，新增 18,047 行、删除 1,492 行。上游将第一版 Edge 后的工作合并到同一 Stable 说明，因此发布说明还重复列出已随下游 v1.26.4 交付的三项修复。

来源：[Release](https://github.com/AltanS/collie/releases/tag/v1.27.0)、[完整差异](https://github.com/AltanS/collie/compare/v1.26.4...v1.27.0)、[CHANGELOG](https://github.com/AltanS/collie/blob/v1.27.0/CHANGELOG.md)。

## 界面和主题

- 大屏侧栏和 Switch pane 列表显示各 pane 的状态标记，与首页保持一致，切换前就能看到哪个 agent 在等待或已完成。[8a4591b](https://github.com/AltanS/collie/commit/8a4591b)
- 主题增加 `surface.tabs = plain | folder`。文件夹式标签用页面底色、侧边框和顶部边框衔接正文；多 pane 时当前 pane 使用染色与描边。可选 `tab-active` 颜色受页面 3:1 对比度约束，省略时使用主题正文色，主题 schema 升至 3。[eb4e35d](https://github.com/AltanS/collie/commit/eb4e35d)
- 增加 `surface.composer = field | box`。box 在空白时保持一行，有文字、附件或进入 Type 模式时向上展开；文字占整行，操作按钮另占一行，不挤窄正文。清空后收拢，减少动态效果时立即切换，保留发送、草稿和语音协议。[b70f0a4](https://github.com/AltanS/collie/commit/b70f0a4)
- 上游 Collie 默认主题采用新的底色、边框、字重、文件夹标签和 box 输入框；新增 Atkinson Hyperlegible Next 字体并作为上游默认，保留其他字体选择。主题初始绘制、preload、CSS 和主题设置同时更新；旧 `collie-new` 主题标识迁移至 `collie`。[4ee291e](https://github.com/AltanS/collie/commit/4ee291e)
- Settings 首项改为 Updates；Telemetry 放入独立页面。iOS 安装提示更新 Share 按钮所在位置；修复高屏宽布局横向溢出。[101e339](https://github.com/AltanS/collie/commit/101e339)、[fae2367](https://github.com/AltanS/collie/commit/fae2367)、[e3c74ce](https://github.com/AltanS/collie/commit/e3c74ce)、[b9e27e7](https://github.com/AltanS/collie/commit/b9e27e7)
- Chat 中工具打印的工作区图片路径在当前 pane 的弹层打开，无须离开对话。[b2bf9bc](https://github.com/AltanS/collie/commit/b2bf9bc)
- 语音接管在录音器真正产生第一段音频后才显示 live，不再把“请求开始”当作“已录到声音”。[c6e61c7](https://github.com/AltanS/collie/commit/c6e61c7)

## 通知和匿名统计

- 默认每个 agent 单独通知，携带名称和位置；打开或回答某个 agent 只清除该 agent 的通知。设备离线后回来会补齐各条通知。Settings → Notifications → Finished 下可关闭，恢复按机器汇总。[a02ad1e](https://github.com/AltanS/collie/commit/a02ad1e)
- 新增默认开启、每天最多一次的匿名安装统计。载荷包含本机生成的匿名 ID、日期、版本、OS／架构、安装方式、Stable／Edge 和 solo／lead／member 角色；不包含主机名、路径、pane、会话正文或凭据。任何一个关闭开关都会关闭统计，支持环境、配置和本机设置；无效环境开关保守关闭。启动日志和 doctor 显示实际决定，设置只影响这台机器。[3f02671](https://github.com/AltanS/collie/commit/3f02671)、[750ed95](https://github.com/AltanS/collie/commit/750ed95)
- “未识别界面”和“发送未落地”卡片出现时按实例／界面记录次数；每日统计使用 v2 载荷携带故障类型、agent 名／版本、multiplexer 和数量，不传屏幕内容。已有关闭开关同样覆盖这些计数，不另增外发请求。[e8ca22c](https://github.com/AltanS/collie/commit/e8ca22c)
- 接收端实现移到上游网站项目，本仓库保留协议和维护说明；本次不会部署接收端。ADR 0129 替代旧的“完全不收集”描述，README、配置、安全、安装、故障排查和相关 ADR 一并更新。

## 输入、界面识别和 herdr-core

- Claude Code 2.1.317 的评分调查下方带 context 行时允许发送；同一 notice 读取结果用于界面和发送判断。[e55cd24](https://github.com/AltanS/collie/commit/e55cd24)
- Codex 0.166.0 在 herdr-core 的全无样式读取中，按有界文本形状识别状态栏和提示行，不再在正常发送后误显示未识别卡片。仍拒绝选项箭头、对话 footer、过长字段等伪输入框。[6a9ba44](https://github.com/AltanS/collie/commit/6a9ba44)
- herdr-core 多行输入不再逐行等待最多三秒；明确区分粘贴文本和按键，保留不支持的 raw key 边界与测试说明。[1c57e5e](https://github.com/AltanS/collie/commit/1c57e5e)
- 空 OMP 编辑器不把 key hint 当作草稿。OMP answer editor 的回复重新落入正确字段；18.16 的隐藏 glyph／自定义回答、note 和多行回答使用同一有界输入结构。[60bb138](https://github.com/AltanS/collie/commit/60bb138)、[e2c8859](https://github.com/AltanS/collie/commit/e2c8859)、[88948b7](https://github.com/AltanS/collie/commit/88948b7)
- OMP 18.17 的 `/switch` 在 Nerd Font 配置下识别为选择卡片；`/usage` 仪表盘视为打开的对话，避免把普通消息输入其中。[0816197](https://github.com/AltanS/collie/commit/0816197)
- pi 的模型没有价格字段时，herdr-core 上仍能识别权限问题卡片。[86dab21](https://github.com/AltanS/collie/commit/86dab21)
- Claude 凭据在会话中途过期时，认证卡片也会抬升；模型选择器在 usage notice 下只识别一次，避免重复菜单。[8d39216](https://github.com/AltanS/collie/commit/8d39216)、[c63c4f0](https://github.com/AltanS/collie/commit/c63c4f0)
- 有附件且正文以斜杠开始时按图片消息处理，避免误当成命令。[7e1f713](https://github.com/AltanS/collie/commit/7e1f713)
- 后台任务停止后，从 Jobs 标记移除。[e98c99a](https://github.com/AltanS/collie/commit/e98c99a)
- 发布说明再次列出的 iPhone 首次发送、Linux dash beacon 和 Zoom 仅在终端显示，已在下游 v1.26.4 交付；本次合并相应分支及新输入框兼容，不重复计为新增功能。

## 历史、用量和运行可靠性

- Markdown blockquote 的内容递归渲染为 block，保留列表、代码块和表格，不再压成一条行内文本。[7f1380d](https://github.com/AltanS/collie/commit/7f1380d)
- pi／OMP 历史根目录允许 home 经过符号链接，读取实际文件前仍受路径约束。[e209818](https://github.com/AltanS/collie/commit/e209818)
- herdr-core 支持 `<harness>.session_file` 标签，直接绑定 pane 的会话文件，解决同目录 OMP 邻居串历史。OMP extension 在启动、branch、turn 结束等时机更新标签，等待写入完成并处理失败重试；标签长度与 HC API 文档同步。[91a3857](https://github.com/AltanS/collie/commit/91a3857)
- Claude 5 小时／7 日用量按各 pane 的 `CLAUDE_CONFIG_DIR` 区分，从对应凭据文件或 macOS 带目录哈希的 Keychain 项读取，不再共用默认 profile 的余额；自定义缓存有界。[1737ac6](https://github.com/AltanS/collie/commit/1737ac6)
- gentle-pi 的问题卡片显示已回答内容；清空 todo 时同步清空计划和 Tasks 标记；失败的前台 subagent 标记失败，过期后台 notice 能结束后台 agent；运行中的前台 subagent 出现在 Agents 标记。[965a90c](https://github.com/AltanS/collie/commit/965a90c)
- web search／fetch 工具行显示首个 query／地址，方便识别实际请求。[e03b514](https://github.com/AltanS/collie/commit/e03b514)
- 设置 `COLLIE_TRUSTED_USER` 时，`collie status` 的 sessions 块仍能读取；bridge 无法打开端口时退出，让服务管理器重启，而非留下假运行进程。[d8ba10d](https://github.com/AltanS/collie/commit/d8ba10d)、[c3ab694](https://github.com/AltanS/collie/commit/c3ab694)

## Crew、文档和开发工具

- `crew add` 同时读取 SSH config、Herdr TUI 和 `hc machine ls --json` 的候选主机，标明来源；支持一次多选，逐机探测后确认再写入；某台失败不妨碍下一台。最终逐行报告 member／mux 或失败原因，并用退出码区分完成、失败和全取消。无终端不能确认时拒绝写入。[238484b](https://github.com/AltanS/collie/commit/238484b)、[fbcdd39](https://github.com/AltanS/collie/commit/fbcdd39)
- 仅运行 herdr-core、没有 Herdr TUI 的 member 也可加入。候选列表名称可作为 member 名称，但不可变成 SSH option；多选时拒绝 `--label`／`--peer-address` 的单值歧义。移除 lead pin 后的残留 member 不再被误报为已加入。[7399c93](https://github.com/AltanS/collie/commit/7399c93)
- start、doctor 和 crew status 报告 multiplexer 机器列表与 Crew 的差异；只有 lead 查询整组列表，保留没有本地 add 记录的成员。[64dec75](https://github.com/AltanS/collie/commit/64dec75)
- 更新 Crew、安装、配置、手机使用、主题、语音／推送、HC API 和相关 ADR；加入主题／输入框／通知／blockquote／更新信号等 playground 示例和独立静态构建入口。
- AUR 和 Nix source 元数据更新到前序 1.26.4 制品；本地仍使用下游固定签名构建。更新 Windows skip 预算至 191、测试和 E2E 配置；没有依赖或 `flake.lock` 变更。本地下游不恢复 `.github/workflows/`，也不导入读取已禁用 workflow 的断言。

## 下游取舍与验证

没有独立下游功能被整套替换。Codex 的无样式状态栏合并上游文本识别，保留本地 working／custom footer、精确斜杠命令、粒子归一化、草稿绑定和 Esc 保护：`esc to interrupt` 不成为模态返回键；丢失样式后无法区分的旧粒子／空段／同名占位文字，仍不承诺无损还原。无样式对话可以回退原生／未识别卡片，不强求与有样式卡片完全相同。

保留 Queue／Steer 与立即引导、模型／模式切换互斥、输入区 Keys／草稿缓存、Standard／Fast 单控件、1000 行镜像和当前屏幕发送保护、Hermes／AGY 适配与状态栏、AGY `.pb` 历史后备、固定 Settings／Agents 卡片、小 Esc、16px agent 图标和设备字体设置。新 blockquote 类型同步接入本地完整 Plan 原文匹配，新增嵌套引用列表测试，避免依赖旧 `spans` 结构。

**外观决定：** 用户选择采用上游默认外观。默认 Collie 主题使用文件夹式标签、随内容展开的 box 输入框和 Atkinson 字体；保留 16px agent 图标、已有设备字体／主题选择及输入区 Keys／草稿行为，不强制清除个人设置。原固定 field 输入框和旧默认字体由上游默认样式替代；设备已明确选择的主题／字体继续优先。

已完成受影响后端 40 文件回归（doctor 由 13 roots 修正为保留本地 Cursor 后的 14 roots）；前端 logic、30 个 DOM 文件及发送保护回归、两端类型检查和 lint。修复了合并时重复 import／字段、遗漏的新 fixture 和本地只读 Settings 的旧 menu 绑定。适配目录增加 14 个新样本，79 项回放通过；这些仅为录制样本识别证据，不提升 CLI 原生认证状态。

完整 logic 中既有 Cursor `idle-bottom-docked` 失败仍在，本次没有修改 Cursor profile；其余新增失败已分别定向复验。Chromium／WebKit 手机浏览器共 14 项通过，覆盖 Codex／Claude Queue／Steer、立即引导、Standard／Fast 单控件、首次触摸发送、忙碌按钮焦点及 Zoom；宽屏用例按项目设计在手机上跳过，另在 tablet 项目 3 项通过，覆盖 Auto／Off 和长行不撑宽页面。当前是合并树的前端预览构建，不冒充正式标签构建或已部署版本。

正式标签构建、推送和固定签名部署结果将在验收后补齐。未新增模型调用或定时巡检，不把 stub／样本通过表述为真实 agent 交互、iPhone 键盘、Linux 或 Windows 原生认证。
