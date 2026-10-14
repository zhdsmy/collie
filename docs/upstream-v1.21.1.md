# 跟进上游 v1.21.1

从 `1.21.0+collie.1` 跟进到 `1.21.1+collie.1`。本版采用上游更新可靠性修复，保留现有 Collie 定制。

已交叉核对 [官方发布说明](https://github.com/AltanS/collie/releases/tag/v1.21.1)、
[CHANGELOG](https://github.com/AltanS/collie/blob/v1.21.1/CHANGELOG.md#1211---2026-10-14)
与 [完整标签差异](https://github.com/AltanS/collie/compare/v1.21.0...v1.21.1)。
范围为 6 个提交、47 个文件；上游标签指向 `c7ddd1e8`，包含版本提交之后的 Windows 测试修复。

## 上游变化

| 范围 | 变化和用户影响 | 依据 |
| --- | --- | --- |
| Crew 更新失败提示 | 红色“无法更新”提示现在可用关闭按钮真正关闭。关闭时间随版本保存；同版本后续重试再次失败或更新版本失败时，仍会重新提示。未连接的成员在已结束的更新中按失败处理，更新页可单独重试。 | [21e5d537](https://github.com/AltanS/collie/commit/21e5d537) |
| 应用内发布说明 | 更新页按分组展示待更新版本的要点；没有待更新版本时显示当前版本的要点。完成页增加“版本变化”入口，并保留成员重试按钮。正文引用发布说明原文，分组与按钮走现有翻译系统。 | [827144e2](https://github.com/AltanS/collie/commit/827144e2) |
| 发布说明数据 | `collie-release.json` 增加可选 `notes`；当前版本从本机 CHANGELOG 读取并缓存。更新检查 API 返回说明，不增加独立网络请求，也不把说明加入高频 snapshot。未知分组、错误字段被忽略，每组最多 40 条、每条最多 240 字符。 | 同上 |
| Crew 重复更新 | 同一进程对同一 run 和 tag 成功启动更新后，不再因 lead 重复询问而再次启动，保护期一小时；启动失败仍可重试。修复两个 updater 同时构建、互相破坏产物后仍运行旧版本的问题。 | [60b7100d](https://github.com/AltanS/collie/commit/60b7100d) |
| CLI 更新互斥 | 三种安装更新路径在开始前检查现有更新锁及运行记录；原地 checkout 更新全过程持锁，结束时仅释放自己的锁。超一小时的锁可过期，避免崩溃后 PID 被复用而长期阻止更新；较新的失效锁仍保留保护窗口。 | 同上 |
| 会话切换器 | needs-you 三角提醒从 12px 缩为 10px，减少对底下图标的遮挡。 | [173a2a42](https://github.com/AltanS/collie/commit/173a2a42) |
| 文档 | 更新指南增加 Crew 成员 checkout 已到新 tag、运行构建仍旧时的排查与手动重建说明。旧版成员在首次升级到本版时仍可能遇到原问题。 | [60b7100d](https://github.com/AltanS/collie/commit/60b7100d) |
| 工具、测试与版本 | 发布脚本把 CHANGELOG 要点写入 sidecar；补充 API、解析、交互及更新锁测试。Windows 竞态测试按锁文件名匹配路径，避免平台分隔符差异。版本文件同步到 1.21.1，无依赖或构建流程变化。 | [c7ddd1e8](https://github.com/AltanS/collie/commit/c7ddd1e8)、[1fc045f7](https://github.com/AltanS/collie/commit/1fc045f7) |

新增字段兼容旧数据：没有时间戳的旧关闭记录继续生效；1.21.1 以前没有 notes 的发布不会显示说明列表。新增界面文案的非英文语言本次仍采用上游英文占位，发布说明正文也保持原文。

## 本地取舍

本次没有独立的本地实现被上游替换。冲突仅涉及版本号和 CHANGELOG，按既定发布规则合并；没有新增终端卡片或识别规则。

- 保留 Codex 模型、Resume、Agents、Plan、Review、权限卡片、警告数量和受保护发送，包括 Plan 模式发送修复。
- 保留 Claude Settings／Agents 卡片、Hermes 中文历史与操作提示、Cursor 历史支持。
- 保留紧凑操作带、tab 智能体图标、字体及显示设置、PWA 视口修复；Keys 仍采用上游实现。
- 保留通知已读处理和经济型 harness 验证；不启用定时监控。
- 保留 `+collie.N` 版本、main 与注释标签交付，不创建 GitHub Release、不恢复 Actions，只重启 Collie。

## 验证范围

- 更新流程、锁、Crew 跟随、发布说明和 solo 数据基线：8 个后端／脚本文件，517 项通过。
- 更新卡片、失败提示、完成页、操作带及相关逻辑：7 个前端文件，255 项通过。
- 前后端类型检查及全仓 lint 通过。
- 发布时从干净标签构建；随后验证手机宽度的更新面板及提示布局，并回读本地与 Tailnet 构建、健康、认证、snapshot 和 Files。最终交付消息记录实际结果。

未调用模型或重复执行未改动的终端卡片探针，未对真实 Crew 成员触发更新，也未进行 Windows VM 演练。本次交付为本机 macOS 安装。
