# 跟进上游 v1.21.3

2026-10-15 查询上游最新正式版为 `v1.21.3`，从 `1.21.2+collie.1` 跟进到 `1.21.3+collie.1`。

已交叉核对 [官方发布说明](https://github.com/AltanS/collie/releases/tag/v1.21.3)、
[CHANGELOG](https://github.com/AltanS/collie/blob/v1.21.3/CHANGELOG.md#1213---2026-10-14)
与 [完整标签差异](https://github.com/AltanS/collie/compare/v1.21.2...v1.21.3)。
上游标签 `2236900e`，范围包含 13 个提交、39 个文件；这是常规修复版。

## 上游变化

| 范围 | 变化和用户影响 | 依据 |
| --- | --- | --- |
| Claude 问题卡片 | Claude Code 2.1.299 将任务清单放在问题底部提示之后，曾导致问题退回未识别卡片，长清单甚至让问题完全不可见。现在解析前识别并移除末尾任务清单，恢复单题和多题卡片；弹窗关闭后正常工作状态的任务列表仍保留。 | [#436](https://github.com/AltanS/collie/pull/436)、[397f816b](https://github.com/AltanS/collie/commit/397f816b) |
| 问题点击保护 | 前端解析和 bridge 使用同一个清单识别函数。清单标题、总数、完成／进行中／待办数必须与各行及折叠计数一致；输入框存在时不剥离。完整清单不再挤占 bridge 的末尾匹配窗口，因此按钮仍能绑定当前问题，不放宽对替换提示的检查。 | 同上 |
| pi 输入框留白 | 修复 `editorPaddingX > 0` 时草稿被当作面板、手机不按 Enter 的问题。通过 pi 自己的反色光标格及每行留白识别编辑器，同时识别有缩进的命令候选列表。无留白行为保持原样，缺少光标证据时继续拒绝发送。 | [#442](https://github.com/AltanS/collie/pull/442)、[76811421](https://github.com/AltanS/collie/commit/76811421) |
| pi 设置菜单 | `/settings` 和 `/scoped-models` 的搜索行曾被误认作普通编辑器。现在用各自稳定的按键提示识别菜单，保留原生内容的未识别卡片，并阻止普通消息写进菜单搜索框。 | [2b1e4c44](https://github.com/AltanS/collie/commit/2b1e4c44) |
| Crew 隧道诊断 | peer 自己监听回环地址、也通过回环地址访问 lead 时，Doctor 接受同机或隧道配置；Crew 更新不再因此跳过成员。lead 的实际成员可达性检查仍负责发现单向或失效隧道。 | [#437](https://github.com/AltanS/collie/pull/437)、[3798e6b1](https://github.com/AltanS/collie/commit/3798e6b1) |
| Bun 兼容性 | 源码更新预检查的建议最低 Bun 从 1.3.14 改为 1.4.0。旧版显示警告但不阻断；本机使用 1.4.3，无需升级工具链。 | [09ba7b79](https://github.com/AltanS/collie/commit/09ba7b79)、[079ec554](https://github.com/AltanS/collie/commit/079ec554) |
| 测试安全与证据 | durable 无限响应测试增加生成上限，让 Bun 1.3.14 的流取消问题以断言失败结束，避免持续占用大量内存。pi 输入样本换为真实 1.2.0 终端捕获；新增 Claude 任务清单样本、绑定区域和反例测试，README 记录来源。 | [#439](https://github.com/AltanS/collie/pull/439)、[866ae2cf](https://github.com/AltanS/collie/commit/866ae2cf)、[c3f88240](https://github.com/AltanS/collie/commit/c3f88240) |

本次没有新增依赖、构建流程或打包渠道；三个版本文件同步为下游版本。共享 ANSI 模块导出已有反色颜色常量，供 pi 读取光标，颜色本身没有改变。

## 本地取舍与维护

没有独立的本地实现被上游替换。Claude 入口冲突是相邻代码重叠：先执行上游任务清单清理，再执行原有 Agents 检测，二者兼容。

- 保留 Codex 模型、Resume、Agents、Plan、Review、权限卡片、警告数量和受保护发送。
- 保留 Claude Settings／Agents 卡片、Hermes 中文历史与提示、Cursor 历史。
- 保留紧凑操作带、tab 图标、字体及显示设置、PWA 视口处理；Keys 仍用上游实现。
- 在适配清单中补充 Claude 问答、pi 编辑器及菜单的来源、测试和新样本，继续区分样本回放与本机实测。
- Doctor 的旧快照仍写 9 个日志目录，与此前合并 OpenClaw 并保留 Cursor 后的 10 个不一致，本次修正这两处预期文本，运行逻辑不变。
- 保留 `+collie.N`、main 和注释标签交付，不创建 GitHub Release、不恢复 Actions、不启用定时监控，只重启 Collie。

## 验证

- 共享 harness 检查 82 个文件通过：24,232 项通过，32 项预期失败、79 项已有待办。
- 问题操作、组件、受保护发送与清单反例检查：5 个文件，211 项通过。
- bridge 绑定、durable 流、Doctor、更新预检查及目录回放共 501 项；Doctor 旧计数修正后，该文件 162 项重跑通过，其余 339 项首轮通过。
- 64 项适配目录回放全部通过；新增 5 张 320px 样本截图，单题、多题和 pi 菜单按预期呈现。
- 本机 Claude Code 2.1.299 隔离问答探针 4 项通过：识别、文本输入选项锁定、退出文本选项、选择 Apple 并收到回答。复用现有 Haiku 探针，测试会话和临时项目已清理，并保存 4 张截图。
- 前后端类型检查、全仓 lint 通过。发布从干净标签构建；部署后本地与当前配置的外部访问地址构建标识一致，认证、健康、snapshot、Files 和发布说明检查均通过，临时配对设备已撤销。

任务清单场景依据上游真实捕获、绑定测试和本机截图回放；本机实时问答没有附带任务清单，不宣称完整实测该组合。pi 未安装，未新增安装或模型请求；未进行真实 Crew 隧道及 Windows VM 演练。
