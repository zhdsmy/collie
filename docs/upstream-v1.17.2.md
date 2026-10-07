# 跟进上游 v1.17.2

本次从上游 v1.17.0 跟进至 v1.17.2，包含 v1.17.1 的全部修复；下游版本为
`1.17.2+collie.1`，接续 `1.17.0+collie.5`。核对日期：2026-10-07。

来源：[v1.17.1 发布说明](https://github.com/AltanS/collie/releases/tag/v1.17.1)、
[v1.17.2 发布说明](https://github.com/AltanS/collie/releases/tag/v1.17.2)、
[完整标签差异](https://github.com/AltanS/collie/compare/v1.17.0...v1.17.2)及各标签 CHANGELOG。
上游范围共 10 个提交、128 个文件；大量差异来自真实终端样本的刷新。

## 上游完整变化

两个版本以卡片内容和 Claude Code 2.1.291 兼容修复为主，没有新增后端接口。

| 版本／范围 | 变化与用户影响 | 上游提交 |
| --- | --- | --- |
| 1.17.1 权限卡片 | 显示标题、来自哪个子智能体、命令或 diff、警告和问题；Chat 中不会只剩 Yes／No。长正文在卡片内部滚动，其他单选提示也显示问题。 | [0b9b1281](https://github.com/AltanS/collie/commit/0b9b1281) |
| 1.17.1 机器监测测试 | 测试等待告警状态写入完成，替代固定延时，避免慢机器漏掉一次判定。只改变测试同步，不改变告警运行逻辑。 | [3b86aa9e](https://github.com/AltanS/collie/commit/3b86aa9e) |
| 1.17.2 问题去重 | 调整 Codex、Grok、opencode、OMP、Antigravity 的卡片区域，已在卡片显示的问题不再同时留在 Terminal 正文。OMP 审批同时纳入标题和正文。下游 Codex 问答保持原生显示，见下文。 | [c57e04bc](https://github.com/AltanS/collie/commit/c57e04bc) |
| 1.17.2 滚动提示 | 命令或 diff 的底部还有内容时显示渐隐提示；滚到底部或内容未超出时消失。 | [c57e04bc](https://github.com/AltanS/collie/commit/c57e04bc) |
| 1.17.2 斜杠菜单 | 识别 2.1.291 新增的选中指针及四空格缩进；长命令列表不再使输入框丢失，保留旧布局识别。 | [3bc491b9](https://github.com/AltanS/collie/commit/3bc491b9) |
| 1.17.2 Effort | 新版滑块显示 low、medium、high、xhigh、max 五档；旁边的 Ultracode 开关及 “Tab to toggle” 不再被误算为档位。旧样本的六档仍按其实际内容读取。 | [72c88486](https://github.com/AltanS/collie/commit/72c88486) |
| 1.17.2 多行草稿 | `ctrl+g` 编辑提示只有结合真实计划弹窗内容才会被当成计划页，避免发送停在“已输入但未提交”。 | [ca016f2c](https://github.com/AltanS/collie/commit/ca016f2c) |
| 1.17.2 窄屏计划 | 40 列下换行的问题、操作提示及计划路径仍可识别，按钮与 82 列时一致；支持自定义配置目录的计划路径。 | [ca016f2c](https://github.com/AltanS/collie/commit/ca016f2c) |
| 1.17.2 输入边界 | 将输入框边界检查用于弹窗识别；草稿中引用计划、权限或菜单文本，仍属于草稿，不会变成可操作弹窗。 | [78234d4f](https://github.com/AltanS/collie/commit/78234d4f) |
| 1.17.2 样本和文档 | 刷新 Claude 2.1.291 多种宽度的 capture，加入子智能体权限、危险命令提示、信任页、通知和新 Effort 布局；更新 `/tasks`、`/resume`、rewind、model、config 样本及区域绑定。字节固定测试需要的旧样本保留为并列文件；同步 README、OMP 审批说明和版本证据。 | [619830cd](https://github.com/AltanS/collie/commit/619830cd)及上述修复提交 |
| 发布元数据 | 两次版本号及 CHANGELOG 更新；没有依赖、构建工具、运行接口或部署协议变更。 | [1ffc0dee](https://github.com/AltanS/collie/commit/1ffc0dee)、[3d562ae5](https://github.com/AltanS/collie/commit/3d562ae5) |

## 替换的下游实现

这次用上游更完整的输入边界判断替换旧的局部规则，并将共享提示卡片扩展为显示完整上下文。

| 旧行为 | 本次采用的行为 | 可见影响 |
| --- | --- | --- |
| Claude `ctrl+g` 必须位于行首才当作计划提示，单独的计划路径用一行规则判断。 | 上游同时检查真实计划文字、选项、输入框边界和换行路径。 | 状态栏编辑提示和引用弹窗的草稿继续可发送，40 列真实计划仍能卡片化。 |
| 普通单选卡片主要显示选项，问题和权限正文留在上方终端；仅 Codex 审批有定制上下文。 | 上游共享 subject／question 显示与有界滚动用于普通提示；Codex 的独立审批结构保留。 | Claude 子智能体权限可直接读到命令和警告，Chat 也能看清批准对象。 |

没有替换其他下游功能。

## 保留的下游差异

既有交互选择与这次修复兼容，因此继续保留。

| 保留项 | 原因与处理 |
| --- | --- |
| Codex 原生问答 | 不恢复已删除的 `codex/ask.ts`；问答页的 Esc 会中断整轮，不套用退出卡片。保留原生问答与输入保护测试。 |
| Codex Plan／review／Warnings | Chat 继续在原生内容卡片内显示；Terminal 保留正文及紧凑退出卡片。警告数字仍可进入 Warnings。 |
| Codex 审批和选中行 | 保留环境、原因、可展开命令、持久授权说明，以及反色选中行的可读性。 |
| Claude Settings／Agents | Settings 四页继续使用固定可滚动原生卡片，新版 Config 也按这一策略处理；Agents 继续使用现有列表卡片。旧 40 列分组说明换行样本单独保留以防回归。 |
| 共享紧凑卡片 | 保留 44px 点击区域、文本折行、小 Esc 二次确认、滚动容器键盘焦点及自定义布局插槽；RawMirror 增加上游 wrap 能力。 |
| 其他已有定制 | 保留紧凑操作带、按键滑动保护、中文全角问号、Claude 右侧提示识别、段落拼接实验、通知与其他 agent 适配。 |
| 发布方式 | 只推 main 和指定版本标签，不创建 GitHub Release，不恢复上游工作流；本机继续由 Herdr 管理 Collie。 |

## 验证与边界

使用真实 capture 回放及隔离浏览器样本验证受影响界面，没有额外触发模型任务。

| 检查 | 结果与范围 |
| --- | --- |
| Harness 逻辑 | 70 个测试文件覆盖受影响的 Claude、其他 agent 和绑定契约；保留原有预期失败及待覆盖项。合并后修正并通过 Claude corpus 的 401 条断言。 |
| 组件 | PromptSelectBlock、RawMirror、OptionButton、UnreadDialog、blocks 共 135 项通过。 |
| 适配目录 | 55 项捕获回放通过；目录引用检查通过。新增证据明确标注为上游 2.1.291 capture 回放，不冒充本机实时验证。 |
| 浏览器 | 12 项相关用例通过：320px 权限卡片在 Chat／Terminal 的正文滚动和按钮可见性，Claude Settings、小 Esc、Codex 原生页及审批、警告返回、图片／图文／路径混合及长文本发送。修正旧原生页测试，使其明确选择 Terminal。 |
| 截图 | 浏览器用例保存权限卡片及 Codex 原生卡片截图到 `web/test-results/`；这是本地可重跑证据，不纳入源码。 |
| 后端 | 机器告警的 37 项测试通过；后端运行代码没有变化。 |
| 发布检查 | 根目录和 web 类型检查、全仓 lint、版本一致性及根目录生产构建。 |
| 未覆盖 | 未重新调用 Claude 2.1.291 模型进行全套 live canary，未进行 iPhone 真机或 Windows 运行验证。样本成功不等于整个 CLI 获得新版认证。 |

实际部署由本次交付完成后回读本地及 Tailnet 构建标识和健康接口；仅重启 Collie。
