# 跟进上游 v1.27.1

基线 `v1.27.0+collie.1`，目标 `v1.27.1+collie.1`。已交叉核对 GitHub Release、CHANGELOG 与实际 `v1.27.0..v1.27.1`：26 个提交（含合并提交）、69 个文件，新增 3,699 行、删除 106 行。正式标签包含 release commit 之后的修复，均已纳入。

来源：[Release](https://github.com/AltanS/collie/releases/tag/v1.27.1)、[完整差异](https://github.com/AltanS/collie/compare/v1.27.0...v1.27.1)、[CHANGELOG](https://github.com/AltanS/collie/blob/v1.27.1/CHANGELOG.md)。

## 功能与行为

- 新增 `/slot/<n>`（1–99）固定浏览器标签页入口。该标签页随后访问的 pane 保存在本设备，浏览器重启后再次访问槽地址即可恢复；每槽独立保存，多个标签同时切换不会相互覆盖。保存的 pane ID 若被其他工作区复用，转到该作用域首页，避免把话发给错误项目。无存储权限或 bridge 暂时不可达时保守降级；解除配对会清除槽记录，重新验证密码则保留。[53224f9](https://github.com/AltanS/collie/commit/53224f9)、[4e44805](https://github.com/AltanS/collie/commit/4e44805)、[846a4c1](https://github.com/AltanS/collie/commit/846a4c1)
- 标签栏末尾的“+”改为裸图标，24px 外框内绘制 16px 图标，与折叠箭头对齐；保留横向 44px 点击范围，纵向覆盖整条 30px 标签栏，不侵入下方正文。首页和工作区栏仍用原来的虚线圆形按钮。[c42953b](https://github.com/AltanS/collie/commit/c42953b)

## 通知修复

Chrome 对最终没有显示通知的 push 有额度限制；上一版每 agent 单独通知增加了清除推送，容易触发浏览器自带的“此站点已在后台更新”提示。本版从服务端减少这些无效推送：

- 按真实配对设备的最近轮询判断是否正在看 Collie，前台设备暂缓通知；继续轮询说明已经看到，停止轮询则延迟补发，避免锁屏瞬间漏通知。
- 页面主动读取已看过的 pane 时，在本设备关闭对应通知并将该槽角标归零；服务端只在新页面声明支持这套行为时省略重复 clear，旧页面和无法识别的订阅仍沿用原来的推送方式。设备身份来自认证凭据，不能由请求正文冒充。
- 同一批 clear 在 400ms 内合成每设备一条，携带全部槽名。保持单槽旧协议，并在后续推送补齐前台暂缓期间遗漏的角标计数；多槽 clear 不使用会吞掉其他槽清除动作的单槽折叠 topic。
- 本机 pane、命名 session 和 Crew 成员按各自作用域处理，预取或失败读取不作为“已经看过”的依据。运行时账本有容量上限，重启后未知状态默认继续发送。
- 日志按设备记录发送、静默清除、暂缓、延迟补发及省略数量，便于排查。

对应提交：[a1bc0fc](https://github.com/AltanS/collie/commit/a1bc0fc)、[ccaf634](https://github.com/AltanS/collie/commit/ccaf634)。这是减少 Chrome 误提示的实现与自动回归证据，不能代替真实手机长期推送观察。

## 布局修复

- Switch pane 等可下拉关闭的面板，在轮询触发父组件重绘时不再重置拖动距离，慢速拖动可持续跟手；关闭回调通过 ref 读取最新值。[faa8489](https://github.com/AltanS/collie/commit/faa8489)
- 大手机／折叠屏双栏：顶部安全区交给侧栏与标签栏，嵌入正文的标题不再重复加 inset；底部侧栏按钮与输入区都避开手势条。[50e19e1](https://github.com/AltanS/collie/commit/50e19e1)
- 给侧栏滚动区和应用根容器建立定位包含块，防止远处列表项的无障碍文字撑高整个 document。只有各列表滚动，页面不会被拖到状态栏下面。[aedcb5f](https://github.com/AltanS/collie/commit/aedcb5f)

## 文档、测试与构建

- 安装文档增加槽入口说明；通知文档解释减少 silent push、逐设备判断与旧订阅兼容；DESIGN 更新“+”按钮例外及触控几何。
- 增加槽恢复、并发写入、工作区 ID 复用、解除配对测试；新增真实浏览器五标签恢复、拖动中轮询、双栏安全区和页面滚动回归。
- 通知新增逐设备／批量 clear／角标回归；补录 Claude Code 2.1.319 的权限、问答、发送、旧历史与 Walky cassettes。这些是上游录制样本，不代表本机重新跑过对应真实 CLI。
- 三处版本元数据更新至 1.27.1；无依赖、锁文件、CLI 安装或后端发送协议变更。没有新增或恢复 GitHub Actions，也不创建下游 GitHub Release。

## 下游取舍

本次没有独立下游实现被上游替换。

- 继续采用用户上一轮选择的上游主题、文件夹标签、box 输入框与默认字体，接收本版“+”和布局修复；保留 16px agent 图标及已有设备偏好。
- 保留静默通知更新且不重新弹出已关闭通知的策略，在现有 `displayPush` 中支持上游多槽清除，并增加一条回归；同时保留代理子路径下的通知图标地址处理。
- 根容器合入 `relative`，保留已有 `h-full` 与 iOS viewport 配套尺寸，避免回退此前真实设备验证的安全区修复。
- 双栏浏览器回归发现固定 16px 底边距在模拟 30px 手势区下仍有 5px 重叠；仅在双栏设置输入区的安全区边距变量，手机单栏仍留 16px，键盘打开仍留 8px，无安全区的双栏也保留 16px。语音接管复用相同边距，避免录音按钮错位。
- 保留 1000 行镜像、内部 guard 仅读当前屏幕、输入发送保护、Queue／Steer、Keys 缓存草稿、Codex／Claude／Hermes／AGY 卡片、紧凑状态栏与 AGY `.pb` 历史后备。本版不触碰这些协议，避免无关重写。

## 验证与交付

- 通知相关后端：3 文件、131 项通过。
- 前端相关 DOM：16 文件、640 项通过，覆盖槽记忆、角标、通知、弹层、标签和双栏；API 边界另 102 项通过。输入区、双栏与语音接管补检 367 项通过。
- 手机 Chromium／WebKit：29 项通过、1 项按设计跳过（拖动采样依赖 Chromium CDP），包含 320px 标签栏、五标签恢复和笔记本布局恢复。双栏 6 项通过，包含 40px 顶部／30px 底部模拟安全区、长列表与整页滚动。没有修改上游安全区断言；首次发现输入区 5px 重叠，补齐双栏边距后复测通过。
- [WebKit 标签栏截图](/private/tmp/collie-v1271-tabs-webkit.png)、[双栏安全区截图](/private/tmp/collie-v1271-wide-safe-area.png) 已目视检查，图标／按钮没有重叠；样本 API 无真实历史会话，因此截图中的历史提示不是运行中会话故障。
- 两端类型检查通过；全树 lint、版本一致性检查与正式标签构建按交付流程执行。
- 仅使用本机验收，不绕过公网 OAuth；不调用新模型、不重启用户会话或其他服务。真实 iPhone 键盘、折叠屏硬件、Chrome 长期推送与跨机 Crew 未在本轮重新实测。
