# v1.23.2 合并记录

从 `1.23.1+collie.9` 跟进至 `1.23.2+collie.1`。已交叉核对[官方发布说明](https://github.com/AltanS/collie/releases/tag/v1.23.2)、标签内 CHANGELOG 和 [v1.23.1…v1.23.2 完整差异](https://github.com/AltanS/collie/compare/v1.23.1...v1.23.2)：78 个文件、13 个非合并提交，包含发布提交。没有新增依赖或改动 flake.lock。

## 全部上游变化

| 范围 | 修复后的行为与保护 |
| --- | --- |
| Claude 无问号的问答 | 单问题 AskUserQuestion 即使写成陈述句，也能从问题标记与选项之间读取内容并显示卡片。权限、信任及计划提示仍要求原有问号和边界，避免把普通正文认成审批。[#548](https://github.com/AltanS/collie/issues/548)、[实现](https://github.com/AltanS/collie/commit/a9234f67) |
| pi 扩展输入框 | 支持 pi-powerline-footer 一类缩进一列的输入框、跨行草稿、运行状态、命令菜单，以及其下方的 widget 和自定义 footer。共享 frame/profile 能标识输入框自己的提示符，避免把换行草稿识别成选项菜单；原生选择器仍阻止普通发送。[#544](https://github.com/AltanS/collie/issues/544)、[实现](https://github.com/AltanS/collie/commit/bf90d38b)、[真实样本补充](https://github.com/AltanS/collie/commit/60696b8c) |
| Claude Heads up 后续界面 | Learn more 后的解释正文、Understood 等选项，以及 Dismiss 后的反馈选项都能继续显示为提示卡。解释保持终端原有排版；支持窄屏换行的按键行和同一行内的 Dismissed 标题。卡片不夺走仍可输入的 composer。[#550](https://github.com/AltanS/collie/issues/550)、[识别](https://github.com/AltanS/collie/commit/56f66756)、[正文展示](https://github.com/AltanS/collie/commit/ab85563d) |
| Claude 对话质量调查 | “是否允许 Anthropic 查看本次会话记录”的调查识别成使用字母键的提示卡，不再阻止普通消息。只有 profile 明确允许的调查标题才能使用字母按键，卡片草稿保护保留。[#559](https://github.com/AltanS/collie/issues/559)、[实现](https://github.com/AltanS/collie/commit/fc13f77c) |
| 未提交消息卡 | `typed_not_submitted` 也提供 Dismiss。用户已经在终端修改或清空草稿后，可以移除过时回执，不必等一小时；Dismiss 不会代替 Submit，也不会清除终端草稿。[实现](https://github.com/AltanS/collie/commit/1e79f2c3) |
| 消息首行误答提示 | 发送逐行写入时，第一行若只有提示所列的 `y`、`n`、`d` 或数字，可能被原生界面先当成回答。现在整条消息或首行命中时都要求先确认；单字符回答不额外按 Enter。运行中、Replace 及向空框 Add 等不合适路径继续拒绝，大小写字母一致处理。[实现](https://github.com/AltanS/collie/commit/122c8ac2) |
| Grok／OpenCode 运行状态 | 运行提示只在原生状态行位置匹配。普通草稿中提到 `Esc:cancel` 或 `esc interrupt` 不再被误判为正在运行，从而错误拦截发送。[实现](https://github.com/AltanS/collie/commit/83c2c994) |
| Hermes 文档边界 | 明确 profile 面向 classic CLI；Ink TUI（`hermes --tui` 或配置启动）仍未适配，需使用 Type here。没有据此扩大 Hermes 已验证版本范围。[#549](https://github.com/AltanS/collie/issues/549)、[文档](https://github.com/AltanS/collie/commit/53a30350) |

上游同时补充 Claude 2.1.304／2.1.306、pi 1.3.0 的真实捕获、来源记录、输入框与绑定 golden、变形回放规则、Playground 示例、12 种语言的相关提示文案，以及 ADR 0109 的提示卡规则。AGY 测试补入无问号纯文本样本作为已知识别结果；没有引入另一套 AGY 功能实现。

构建方面，上游 CI 和 Windows workflow 新增 `release-*` 分支触发，按本仓库既有决定继续不恢复 `.github/workflows/`。[CI 提交](https://github.com/AltanS/collie/commit/69a4581c)

官方发布说明另有打包限制：上游下载产物仍嵌入 Bun 1.4.1，尚未包含其所述 eMudhra 中间证书 TLS 修复（#568）。本机使用现有 Bun 1.4.3 从源码构建，没有更换工具链；本次未验证该证书场景，因此不将此合并描述成 TLS 修复。[官方 CHANGELOG](https://github.com/AltanS/collie/blob/v1.23.2/CHANGELOG.md#1232---2026-10-21)

## 下游取舍

本次没有独立的下游实现被上游替换。新增上游行为与现有定制兼容，冲突集中于版本文件、发布记录和样本登记；按各自增量合并，没有整文件覆盖定制。

保留 Codex Model／Resume／Agents 等卡片、Queue／Steer 设置和立即引导、warning 数量、模型切换保护，以及上一版的命令补全校验修复。保留 AGY Model／Resume 卡片、composer 命令按钮、原生 Queue／Send Immediately 行为、独立状态栏、额度字段和 SQLite Chat／History；这些是当前已验证的操作与展示能力，上游此次没有替代实现。保留 Input 内按键区与草稿缓存、Claude Settings／Agents 卡片、Hermes 本地发送及通知兼容、Cursor journal、字体／紧凑操作带／tab 图标。

维护方面，将新 Claude／pi 样本加入适配目录，并补齐前几轮遗漏的 12 个 AGY／Codex surface 标签、Codex corpus 清单和 AGY 两个名称的 journal 登记。Claude 新样本中的更新及 `/clear` 提示分别登记，不放宽原有菜单误识别断言。登记沿用已有捕获／只读验证证据，没有把回放标成新的原生交互认证。

## 验证与交付

- 发送与 surface 后端的 768 项检查通过；初次四项 Unix socket 检查受沙箱限制，改用 `/private/tmp` 和本机 socket 权限后通过。
- 共享逻辑的 104 个文件完成全量检查及失败项定向复验；保留既有 34 项预期失败和 58 项 todo。修正的是样本登记及固定计数，没有跳过失败用例。
- HeldCard、MenuBlock、客户端发送和 Codex 快捷模型切换共 120 项测试通过；适配目录回放通过。
- 320px 浏览器保存四张新 Claude 卡片截图并检查展示；本机证据在 `/private/tmp/collie-v1232-evidence/screenshots/index.md`。截图只证明这些捕获样本的渲染。
- 两侧类型检查、lint、版本一致性及正式标签构建按发布流程执行；代码和 annotated 标签推送后部署本机，只重启 Collie，核对 build、health、config、snapshot 和发布说明，并保留最近一个完整回滚包。

没有新增模型请求、当前 Claude／pi 的原生交互、跨机 Crew／Walky、Windows 或真机 iOS 测试。公网有 OAuth，按用户约定仅从本机验收；没有重启 Herdr、Headroom 或用户 Agent 会话，也没有启用定时巡检。
