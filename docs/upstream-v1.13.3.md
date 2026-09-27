# 上游 v1.13.3 合并报告

从下游 `v1.13.2+collie.1` 跟进上游 `v1.13.3`，目标版本为
`v1.13.3+collie.1`。逐项核对了[发布说明](https://github.com/AltanS/collie/releases/tag/v1.13.3)、
[上游 CHANGELOG](https://github.com/AltanS/collie/blob/v1.13.3/CHANGELOG.md) 和
[v1.13.2...v1.13.3 标签差异](https://github.com/AltanS/collie/compare/v1.13.2...v1.13.3)：
共 9 个提交、54 个文件路径，没有后端接口或配置迁移。

## 上游变化

### Codex 与历史记录

- [无客户端启动修复](https://github.com/AltanS/collie/commit/764300f0)：Codex 0.156.1 在没有 Herdr 客户端连接时，状态行分隔符可能不带颜色。读屏器现在接受这种分隔符，恢复空闲窗格的输入区和草稿识别；仍要求其余字段、分隔符及输入区位置满足原有约束，防止正文误认成输入框。新增真实的无客户端空闲及草稿抓取样本和测试。
- [首次消息的会话说明](https://github.com/AltanS/collie/commit/2a3594bf)：Codex 直到第一条消息发出才向 Herdr 报告 session。新窗格的手机提示现在说明这一时机；若发送后仍无历史，可检查 Codex 的 `/hooks` 或更新集成。`collie doctor` 的 `agent-sessions` 和 `integration-codex` 不再仅因新窗格尚未上报而判故障，真正缺少 hook 的错误仍会显示。

### 验证工具

- [版本台账与漂移检查](https://github.com/AltanS/collie/commit/6fcf98b0)：`verified-versions.json` 记录各 Agent 读屏器最后验证的版本、日期和证据；`bun run harness:drift` 只读检查本机版本，支持筛选 Agent、JSON 输出和严格退出码。OpenCode 与 Pi 当前标为未验证，不声称已有对应读屏器。
- [真实代理 canary](https://github.com/AltanS/collie/commit/0852cc7b)：`bun run canary` 在独立 Herdr session 中驱动 Claude、Codex、OpenCode、Pi 的草稿与少量发送，以产品的读屏器、发送保护及 bridge 回复处理判断结果；结束时清理自己的 session。支持用 `--readers` 比较旧 checkout，以及用 `--record` 更新验证台账。合并时把 canary 的读屏调用接到下游现有的 `readPane` 参数签名。
- [共享不变量测试](https://github.com/AltanS/collie/commit/156a6dc4)检查输入草稿、镜像和状态行的读回结果。合并时让生成的 Codex 草稿保留真实捕获中的输入箭头样式，以匹配下游已有的输入区判定。

### 文档与打包

- [问题模板与排错指南](https://github.com/AltanS/collie/commit/d017c327)要求提供 `herdr pane read <pane-id> --source recent --lines 200 --format ansi` 原始抓取，保留截图看不到的颜色与淡化信息；[fixture 文档](https://github.com/AltanS/collie/commit/865ba212)修正 ADR 0055 链接。
- [打包跟进](https://github.com/AltanS/collie/commit/54d76632)把 AUR 与 Nix 来源更新到上游 1.13.2；上游发布提交将三个版本文件升到 1.13.3。下游版本文件只在独立发布提交中升到 `1.13.3+collie.1`，不把打包下载地址改成不存在的下游资产。

## 下游合并决定

- **没有用上游实现替换既有下游功能。** 上游修复的是 Codex 无客户端时的状态分隔符和首次消息前的会话提示；下游原有的信任、审批、`resume`、`/model`、`/permissions` 卡片及发送保护继续工作。
- 保留 Hermes 首条消息前的专用历史提示，同时给 Codex 使用上游新增的首次消息提示；其他 Agent 仍显示现有的集成排查提示。两者分别针对不同的 session 上报时机。
- 保留紧凑同底操作带、实体底部导航与本 fork 不发布 GitHub Release 的策略。上游此次未触及这些界面和发布决策。

用户可见的变化是：无客户端启动的 Codex pane 不再误显示无法读屏卡片；新 Codex pane 的历史提示不再把正常的首次上报延迟说成集成故障；`collie doctor` 对这种新 pane 给出相同判断。版本台账、漂移检查和 canary 是新增的维护命令，不自动运行，也不改变普通会话。
