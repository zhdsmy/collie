# 跟进上游 v1.25.5

采用 [v1.25.5 正式标签](https://github.com/AltanS/collie/releases/tag/v1.25.5)，发布为 `1.25.5+collie.1`。已核对发行说明、CHANGELOG 与 [v1.25.4…v1.25.5 全部差异](https://github.com/AltanS/collie/compare/v1.25.4...v1.25.5)。该正式标签还包含最初 1.25.5 版本提交之后的合并和 edge.2 提交，以下覆盖到标签实际 HEAD，而非停在第一次 release commit。

## 上游完整变化

- **问题报告不再空白**：GitHub issue URL 限制在 4800 字符内，为登录重定向留空间；忽略空白行占用，从屏幕顶部裁切并注明删掉行数，保留输入框、签名和环境。仍放不下时先复制完整报告，再打开注明剪贴板内容的 issue；复制失败不打开。长链接造成原报告空白是最可能的原因，尚未经原报告者确认。[#629](https://github.com/AltanS/collie/commit/57fc7de)
- **延迟探针等待与恢复**：空闲输入框在最初未看到探针时，额外约 3 秒两次读回；及时响应的会话不增加等待，运行中发送保留原规则。延迟探针伴随整屏重绘时，清理后从严格校验的新基线再试一次；有新提示、新正文或新模态等变化仍拒绝。回执包括完整探针等待时间。[等待](https://github.com/AltanS/collie/commit/55da725)、[重绘恢复](https://github.com/AltanS/collie/commit/779c4c5)
- **pi 消息中的横线**：窄于输入框的横线当作用户正文，避免边框、表格和 Markdown 分隔线令消息输入完整却无法提交。与框等宽的横线仍可能被认作边界；带标签的 Claude 框顶也保持兼容。[修复](https://github.com/AltanS/collie/commit/4095897)
- **tmux 下 Claude 两段消息**：忽略会随着多段草稿消失的 `tmux focus-events off` 已知提示，避免误判界面变化而留下未提交内容；其他新行仍触发保护。[修复](https://github.com/AltanS/collie/commit/d802e11)
- **macOS core beacon**：hook 发射端、bridge 读取端和 hook-target 注册改用一致的 `/bin/ps -o lstart=` 启动时间探针，固定 C locale/UTC、超时并缓存读取。修复 macOS 无 `/proc` 导致 beacon 无法生成/确认、Claude Chat/History 缺会话的问题；permission hold 同样受益。Linux 的 `/proc` 数值保持不变，旧 beacon 可继续存活；其他平台仍保守拒绝不可靠来源。doctor 更新说明。[#647](https://github.com/AltanS/collie/commit/41e2997)
- **Claude 评分调查**：2.1.316 更新行上的 `new task? /clear to save … tokens`（单独或与更新提示并列）不再遮蔽评分提示识别，恢复卡片与原有发送流程。[#648](https://github.com/AltanS/collie/commit/bf63283)
- **Claude Recently denied 卡片**：跳过 `/permissions` 内部命令虚线框，向上找真正对话边界，恢复 Recently denied／Recently blocked 的按钮。[#649](https://github.com/AltanS/collie/commit/7f078da)
- **Esc 提交语义明确**：勾选被拒调用后，Esc 实际会批准或重试；卡片根据原生 `Esc will …` 显示“Leave and approve/retry …”，移除取消按钮语义，避免与 Enter 的 Approve 混淆。没有该提示时继续 Close。[#650](https://github.com/AltanS/collie/commit/79d51a1)、[措辞补充](https://github.com/AltanS/collie/commit/b683ac4)
- **自动拒绝倒计时不使点击过期**：仅规范化 Claude 自动拒绝那一句中的倒计时及其换行，稳定 ask id；命令参数、其他时间和实质内容变化仍使操作失效。[#651](https://github.com/AltanS/collie/commit/e78cd1c)
- **文档与测试工具**：HC_API 记录颜色能力请求 herdr-core#68；multiplexers/troubleshooting 补延迟等待说明；HARNESS_CONTRIBUTING 记录动态时钟不应进入稳定绑定的规则；ADR 0109 同步 `/clear` 提示边界。OpenClaw 文件尾变化测试改为确定性门控，减少高负载超时；rig 的模型选择器仅在快捷命令确认成功后继续，拒绝时不再额外发送 Enter；补 pi 横线和 Claude 多段发送样本。十二种语言补报告剪贴板说明。除版本文件外没有新增打包平台或依赖；继续不恢复 workflows、不创建 GitHub Release。

## 下游取舍

本次没有以新增上游功能替换独立下游实现。macOS beacon 修复与本地 PID/锁/参数/会话文件发现后备互补，保留后备以覆盖没有 hook 或原生 session id 的会话。

保留 Standard/Fast 合并后的单个 guarded Fast 控件、Queue/Steer、输入区 Keys 和草稿缓存、默认 1000 行镜像及屏幕优先发送检查、慢历史读取保护、Hermes Python bootstrap 身份识别、各类 journal、卡片/紧凑状态栏/图标/字体/PWA 定制与 AGY `.pb` 后备。

唯一源码冲突是 Claude profile 相邻配置：采用上游 `/clear` notice gap，保留本地 interrupted/stoppedRows；版本文件和 CHANGELOG 按既定下游发布规则机械合并。适配目录同步 Claude ask、notice 和共享 menu 的相关回归来源，不冒充当前 CLI 的现场认证。

## 验证

- 发送、ask 绑定、beacon、hold/hooks、doctor 和 OpenClaw：1407 项通过。
- core adapter、纯文本发送、prompt binding 与适配目录：570 项通过，3 项明确跳过（两项非 Claude 分支、一个 Windows 路径）。
- 菜单、输入框边界、notice、全样本 Surface/纯文本对照：1654 项通过；相关 Claude 问答变体 218 项通过。
- Report/menu 组件 40 项、报告正文 32 项通过；两端类型检查、lint、版本检查与正式构建通过后部署。
- 本机只读原生探针确认 emitter、reader 和 hook-target 对同一进程的启动时间一致；未改现有 hooks，也未向用户会话发送探针或消息。
- 浏览器检查报告卡、Claude Settings/问答和单个 Fast 控件：18 项中 17 项通过，桌面 Chromium 1280px 的 Settings 滚动几何断言失败。失败在已部署旧版 `v1.25.4+collie.2` 上也复现，两次均失败；当前版两次定向复现为一通过一失败。字体等待没有解决旧版失败，已撤掉无效改动。此为既有桌面布局时序/几何问题，未修复，不宣称整组全绿；320px 手机和 WebKit 桌面均通过。首次失败、带 trace 复现及旧版对照分别保存于 `/private/tmp/collie-v1255-e2e`、`/private/tmp/collie-v1255-settings-recheck`、`/private/tmp/collie-v1255-settings-baseline`。浏览器样本 API 不等于用户真实 CLI 原生交互认证。

部署维持固定签名，替换前和重启前验证 designated requirement；只重启 Collie，验收 localhost 构建、鉴权 API、snapshot、Documents 实际读取和其他服务不变。按约定仅从本机验证，公网域名前置 OAuth 不作验收。

未新增模型调用、小时巡检、Windows VM、跨机 Crew 或真机 iOS 验证。core ANSI 样式和 Hermes 完成状态的既有缺口仍在；未因升级放宽未知界面或精确内容保护。
