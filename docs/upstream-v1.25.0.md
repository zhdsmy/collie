# v1.25.0 上游跟进

基于 `v1.24.3+collie.1` 合入上游 `v1.25.0`，交付版本为 `v1.25.0+collie.1`。

核对依据：[正式 Release](https://github.com/AltanS/collie/releases/tag/v1.25.0)、[CHANGELOG](https://github.com/AltanS/collie/blob/v1.25.0/CHANGELOG.md)、[实际 v1.24.3…v1.25.0 差异](https://github.com/AltanS/collie/compare/v1.24.3...v1.25.0)。本轮实际比较包含 194 个提交、561 个文件。上游 Release 的比较起点是 v1.24.2，因此其中的 Codex Ultra 提示符和慢速下载修复已随上一版采用，本轮保留，并合入新的真实捕获和后续兼容修复。

## 用户可见变化

- **图片先预览再附加，可裁剪和标注。** 相册选择后先看预览，再选择 Attach 或 Edit；编辑支持画笔、圆、箭头、撤销、重做和重置，使用浏览器 canvas 输出 PNG。没有修改时保留原文件；浏览器无法解码预览时仍可附加原图，上传失败可重试，切 pane 后不会把迟到的编辑结果发给新 pane。
- **输出放大。** 操作带增加 Zoom，打开只读全屏输出，可双击、捏合与拖动浏览，最大 6 倍；保持终端原列宽，不改变远端 pane 尺寸。原来的输入区、草稿和 pane 留在挂载状态，返回后恢复焦点；不会从放大页跟随正文链接或发送键盘输入。
- **Diff 批量评论。** Changes 可选择多个 diff 行，一次提交评论；离开再返回会保留草稿，按完整智能体地址选择发送目标，解除配对时一起清除。活动行号通过无障碍状态表达，轮询不反复修改标签。
- **Chat 图片与查找。** 展示 Claude 工具结果和附件中的图片，点击在面板中打开；图片大小有界限，超限明确给出占位说明。History 查找包含工具输出并自动展开命中的工具。Claude 记录的 `<pasted_content>` 包装在 Chat、History 和排队预览中去除，长排队消息显示省略号。
- **通知和机器分组。** 安装版 PWA 图标可显示等待处理的 pane 数量，只有完整仪表盘更新全局计数；打开完成的 pane 会撤回提醒，使用完整 pane 地址避免跨机器重复。Crew 和 Machines 按宿主机组合多个 mux 实例；部分实例不通显示降级，全不通才是离线，pane 芯片在需要时显示主机和 mux。
- **移动端与字体。** 软键盘布局要求可输入控件确实有焦点，避免 iOS 关闭键盘后仍保持压缩布局。保存的 Chat 按会话实例隔离，复用 pane id 不会出现旧会话；升级后旧格式离线 Chat 缓存会重新从线上读取一次，真实历史文件不删除。新增约 19KB 的 JuliaMono 符号子集 Terminal Symbols（OFL 授权），按需缓存，emoji 继续使用系统字体。

## 智能体与发送

- **AGY 1.4.8：按用户决定采用上游历史读取主体，保留 `.pb` 后备与界面定制。** SQLite/WAL 通过共享只读读取器读取；未变化的数据库跳过重复归并，原地流式更新仍能刷新，读取期间发生写入则丢弃不稳定快照。无有效 SQLite 时先读原生 `transcript.jsonl`，再用本地认证解密的 `.pb` 后备；保留路径包含检查、会话 ID 绑定、体积上限和解密认证失败时不展示数据。过程不写原始历史。
- AGY 卡片覆盖 `/model`、`/effort`、`/usage`、`/context`、`/artifact` 和原生 Keyboard 面板，保留本地权限上下文、灰色 ghost 文本、别名补全、紧凑状态栏、任务轨道、Resume 和弹窗保护。弹窗尾部状态只显示一次。新上游捕获是回放证据，不能当成本机 1.4.8 发送认证。
- **Claude** 的 awsAuthRefresh Authentication 登录盒子变为卡片，并进入 detector drift guard。2.1.312 的纯图片、图文和仅上传路径发送，以及新会话 usage 行得到修复；剪裁或右侧填充的运行提示不再误判为弹窗。图片绝对路径不当作 slash 命令。
- **Codex** 增加报告者的真实 0.165 Ultra 170 列捕获，兼容 0.166 Logo 和独立 warning 页脚（包括窄屏形式）；保留本地 Ultra 跨空行识别和严格发送保护。Lab 将设置写入隔离 config.toml，避免 `-c` 自己触发警告。
- **Muse / pi** 修复多行草稿误判、弹窗与状态栏重复，以及窄屏 Cancel 提示。新增 **dsh-tui** Chat/History 及进程持有锁发现，限制压缩块展开大小；其镜像保持原始输出。
- **发送协议** 等待刚启动的智能体第一屏，启动期间本地草稿仍可编辑，发送与 Quick 提交被锁定。探测字符和 Backspace 的写入耗时不再挤占回读预算，Backspace 后至少读一次；回执记录 probe / probeWrite，保留本地回读、召回队列与 Notice 处理。
- 命令面板向每个有智能体的 pane 查询磁盘命令，由 bridge 判断是否支持 loader；新增七类智能体的 skills/commands，保留受信项目与 symlink 路径约束。

## Herdr core、CLI 与 Crew

- 新增 `herdr-core` 适配器（hc 0.1.14 预览），使用 `HC_SOCKET` 或运行目录下的会话 socket。支持列举终端、纯文本读屏、文本／按键、新 tab 和关闭；尚无 focus、rename、新 space、worktree 功能。Claude hook 可提供会话和历史，其他智能体不承诺相同 hook 能力。
- 仅检测到 core 且没有 Herdr TUI socket、安装或插件时才自动选择 core。服务单元、配置目录、更新和 Doctor 与 Herdr TUI 区分；Doctor 实际连接 core socket，而非只看文件存在。本机继续使用现有 Herdr TUI，没有迁移或启动第二套服务。
- `herdr-app-mod/` 是手动安装的实验面板，使用 status/pair 单行 JSON；配对码和 QR 不持久化。本轮合入代码与测试，不安装到用户 herdr-app。
- `collie status` 改为多实例总览，原服务详细状态移到 `collie serve status`；新增 `mux list` 和 `sessions`，支持 JSON、筛选、Crew 主机、mux 与 pane 数；`doctor --instance` 优先于环境并提前拒绝不存在的实例。
- `spaces.toml` 持久化会话显示标签与默认文件夹，标签不会改变真正的会话 ID，也不串用别的机器的标签。创建工作区和 Dashboard 启动使用相应默认目录。
- Doctor 增加发送、held send 和过期 screen 诊断，Report problem 携带同类信息；普通 shell 的发送统计只作信息。所有文本行按终端宽度换行，启动和设置检查明确指出缺项。
- Tailscale 调用全部有进程内超时，区分慢响应、未登录和证书问题，识别其他端口的手工映射，不再无期限等待。Windows start 可发布 Tailnet 入口；停止、卸载与 unserve 的说明明确区分。
- Walky 支持 workspace、here 和 branch 范围，在 Crew 内展开至有界的 pane 集合并给每个目标回执；支持从 member 的 pane 发送，兼容较旧 bridge，拒绝有歧义的地址。
- Crew invite stdout 只输出 token，等待 lead 重启就绪再给邀请；HTTPS 默认 443 地址不误拨 8787。成员名字冲突直接拒绝，不自动加后缀。bundle 部署保留操作员指定 origin，仅修复临时 bundle origin；转发 focus 使用正确的审计名称。
- 一个 sweep 超时先显示重连，连续两次才判不可达，旧 hello 日志限频；已被 lead 拨通的 loopback member 不再误报 bind。开发构建 SHA 固定长度，同提交的不同缩写不当成版本差异。
- 多 mux 的非本地 edge 统计为 foreign-mux，不重复写错误日志；session beacon 写到所有注册的 bridge，第二个实例也能得到 History 链接。
- Push 忽略格式错误的 tag，并从标签和内容去除双向控制与控制字符，防止通知文字被重排。

## 文档、工具与打包

- 新增 HC_API、Herdr core 安装／诊断／契约与 ADR，重写手机五分钟安装入口，补充 iPhone/iPad Web Push FAQ、Windows 手工映射与卸载说明、Crew census、Walky 范围和发送诊断文档。
- 上游增加 `docs/<tag>` 网站发布分支规范；本分支继续不启用 `.github/workflows/`，删除本轮新引入的 docs-line workflow，不自动发布 GitHub Release 或网站。
- 浏览器 rig 支持回放 Claude 录制的模型流，包含 2.1.312、2.1.314 和 M75 skill 文本，回放无需 Claude 登录；case 29 只在特定回合结束竞态下重试一次。Lab 的 npm 新版本年龄例外只在隔离 prefix 内生效，不改全局 npm 设置。
- React Router 独立拆包；字体及字体许可随前端分发。终端 fixtures 固定 LF，补充跨平台路径与 Windows skip 预算、安装提示测试。保留本机固定证书签名与现有 Herdr 插件部署入口。

## 本地实现取舍

本轮替代的独立实现：**AGY 本地 SQLite 读取主体改为上游共享只读 SQLite/WAL + JSONL 实现**；`.pb` 只作为小范围后备保留。AGY 原有卡片识别与上游有共同来源，合并 1.4.8 兼容，不重复保留两套解析器。其余没有额外删除独立下游功能。

继续保留 Codex／Claude Queue/Steer 设置与立即引导、严格发送和模型切换互斥；Input 内联按键及原草稿缓存；Codex Model/Resume/Agents/Plan/Review/权限卡片和 warning 数量；Claude Settings 固定滚动卡片、Agents 与问答；Hermes 适配及状态栏；AGY 紧凑图标和冷热状态；Cursor 历史；紧凑同底操作带、tab 智能体图标、字体、显示和 PWA 定制；经济型 adaptation catalog／canary，不开启周期监控。

新增 Zoom 使用同一操作带测量路径；补齐本地紧凑尺寸在四／五个固定按钮下的回退宽度，不改变用户选定的尺寸。Claude Authentication 进入适配清单，AGY 标明上游回放和本机旧版验证的边界。

## 验证与部署

已完成受影响的 CLI、bridge、发送协议、SQLite/WAL／`.pb`、Crew、Herdr core 适配器和前端逻辑／组件测试；修正合并后的注册表计数、固定样本顺序与紧凑宽度断言。79 项适配清单回放、66 项本地录制流 rig 检查、根目录和 web 类型检查、全树 lint 均通过。

Chromium 与 WebKit 手机宽度共 22 项浏览器检查通过：Codex Ultra／Queue／立即引导、Claude 发送选项、AGY 后台任务／Model／Resume、Files/Diff、Zoom 返回保留草稿且不发终端写入，以及图片标注实际导出不同于原图的 PNG。截图人工核对无遮挡。Diff 批量评论引入嵌套按钮后，更新旧 E2E 的行定位；同步使用本地 32px 紧凑操作带尺寸。

正式版本在干净标签提交构建并推送。部署仅重启 Collie，使用既有固定签名；从 localhost 校验构建、鉴权、健康、snapshot 和 Documents 实际文件读取，读回其他服务进程并清除临时设备。部署回执与构建标识以本轮交付结果为准。按用户约定不探测前置 oauth-proxy 的公网域名。

没有进行新增模型调用、Windows 真机或 Herdr core／herdr-app 的现场演练；新版本智能体 captures 回放不等同于该版本完整原生交互认证。iPhone 软键盘和安装图标仍需设备侧实际体验确认。
