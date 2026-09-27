# 上游 v1.14.1 合并报告

从下游 `v1.13.3+collie.1` 跟进上游 `v1.14.0` 和 `v1.14.1`，目标发布为
`v1.14.1+collie.1`。核对了各版本的发布说明、CHANGELOG 和标签差异：
[v1.14.0 发布说明](https://github.com/AltanS/collie/releases/tag/v1.14.0)、
[CHANGELOG](https://github.com/AltanS/collie/blob/v1.14.0/CHANGELOG.md)、
[v1.13.3...v1.14.0](https://github.com/AltanS/collie/compare/v1.13.3...v1.14.0)；
[v1.14.1 发布说明](https://github.com/AltanS/collie/releases/tag/v1.14.1)、
[CHANGELOG](https://github.com/AltanS/collie/blob/v1.14.1/CHANGELOG.md)、
[v1.14.0...v1.14.1](https://github.com/AltanS/collie/compare/v1.14.0...v1.14.1)。
前者涉及 53 个提交、249 个路径，后者涉及 3 个提交、14 个路径。

## v1.14.0 新增

- [真实对话框 canary](https://github.com/AltanS/collie/commit/644edb03)：新增 `--dialogs` 和忙碌时发送场景，让 Claude、Codex 在独立会话中展示实际审批、问答及计划界面，检查卡片与发送保护；不自动运行。
- [Pi 实时图片](https://github.com/AltanS/collie/commit/65516178)：Pi/Oh My Pi 直接绘制的图片不在终端网格内；完成一轮后从日志读取最新图片，显示于实时镜像下方。已有占位符图片仍按原路径显示，不重复展示；历史中保留旧图。
- [pane 固定](https://github.com/AltanS/collie/pull/286)：长按或从 pane 菜单固定，在 Panes、Focus、Changes 和切换器顶端显示；顺序及状态不会因刷新跳动，偏好保存在本设备，关闭 pane 时清理固定项。
- [机器筛选](https://github.com/AltanS/collie/pull/288)：Machines 面板可按机器隐藏 dashboard 工作区；隐藏机器仍计入摘要、Focus 数字与通知，当前机器仍显示。原有 workspace 隐藏能力继续存在。
- [workspace 标题新建 tab](https://github.com/AltanS/collie/pull/290)：标题末尾的加号在该 workspace 的目录和所属机器中开新 tab；不支持创建 tab 的 multiplexer 不显示按钮。
- [OpenCode 读屏器](https://github.com/AltanS/collie/pull/255)：新增输入区与草稿验证、命令/编辑/网页权限及 Always allow 二次确认卡片、picker 的 Escape 操作；按钮沿原生指针移动并按 Enter，在 50 列下也有抓取样本。
- [操作带清空与撤销](https://github.com/AltanS/collie/pull/291)：输入框有文字或附件时显示 X，清除本 pane 草稿并保持键盘；在下次编辑、发送、切 pane 或操作带点击前可撤销。合并时保留下游 40px 紧凑操作带及其滚动占位尺寸。
- [常用目录](https://github.com/AltanS/collie/pull/289)：新建空间面板可选本机收藏与最近目录，每台机器独立保存在 `folders.json`；旧版机器无此数据时不显示。为此新增 `/api/folders` 与 `/api/folders/star`。
- 长按 pane、工作区和 tab 时增加渐进按压反馈，尊重减少动态效果设置；无固定 pane 时在 dashboard 一次性提示长按可固定。

## v1.14.0 修复

- 更新流程用新 `runId` 区分当前执行与旧结果，不再把上一次“更新完成”误显示为刚启动的任务。
- [Codex 忙碌状态](https://github.com/AltanS/collie/commit/b138538d)：识别首次回复时状态行尾部的 spinner，避免丢失输入区。[Codex 0.157](https://github.com/AltanS/collie/commit/8139d9fb) 全屏布局新增的快捷键/排队提示行也被纳入输入区边界；保留已有发送保护。
- Windows 更新子进程继承 `Path`，构建后的 `.exe` 文件按 Bun 实际产物名替换；Windows 生命周期仍为社区维护。
- Claude `/plugin` marketplace 的选择、更新及应用步骤可在手机操作；不可安全确认的 Remove 仍不提供按钮。
- Muse 后台任务列表不再遮住输入区与可绑定的审批卡片；弹窗过长或键盘焦点在任务列表时仍拒绝不安全操作。
- [Claude 历史](https://github.com/AltanS/collie/pull/306)过滤 `isMeta` 注入文本，Claude 自己发出的触发消息仍保留为 System note。
- [镜像重排](https://github.com/AltanS/collie/pull/302)用 `text-wrap: pretty` 减少末行孤词；Safari 遇宽表格等内容仍按原样折行。

## v1.14.1 修复

- [Grok 1.0.41](https://github.com/AltanS/collie/commit/7c9f6497) 在草稿下方绘制 `Shift+Enter/Opt+Enter:newline` 时仍识别输入区并允许发送，也接受 Linux 的 `Alt` 拼法；其他按键提示的保护条件保持不变。[PR #294](https://github.com/AltanS/collie/pull/294)。

## 文档、兼容与下游行为

- 上游同步了 Codex、OpenCode、Muse、Claude 和 Grok 的真实 pane 抓取、适配测试、E2E、六种语言文案、README、DESIGN、CREW_PROTOCOL 和 ADR；AUR/Nix 跟进上游已发布的下载来源。没有新增必须迁移的配置，也没有恢复本 fork 禁用的 GitHub 发布工作流。
- **本次没有替换既有下游实现。** 上游也删除了 Codex 0.149 `Yes, continue / No, quit` 信任提示分支；下游在合并前已经让旧文案原样显示，0.156.1 起的 `Trust this folder?` 仍为信任卡片。这符合此前清除旧版适配并采用上游信任卡片的决定。
- 保留 Codex `resume`、`/model`、`/permissions`、警告数量与动作、审批上下文、发送保护；保留 Hermes 会话提示、Cursor 历史适配、workspace 隐藏、已有的镜像占位符图片路径、紧凑同底操作带和实体底部导航。合并时补齐 Codex 0.157.1 的无颜色 50 列状态行、避免擦除输入中的 Braille，并给清空按钮出现时的滚动尾部增加 16px 间距。上游新 pane 固定、机器筛选及 Pi 图片与这些能力并存。
- 用户可见变化集中在新 dashboard 操作、OpenCode 权限和发送、Pi 实时图片、输入框清空/撤销，以及 Codex、Grok、Muse 和 Claude 的读屏/历史修复。新维护命令及 canary 不自动对普通会话运行。
