# 上游 v1.14.2 合并报告

从下游 `v1.14.1+collie.2` 及其后的备份维护规则提交 `69b2989f` 跟进上游
`v1.14.2`，本次下游发布为 `v1.14.2+collie.1`。

已交叉核对 [发布说明](https://github.com/AltanS/collie/releases/tag/v1.14.2)、
[上游 CHANGELOG](https://github.com/AltanS/collie/blob/v1.14.2/CHANGELOG.md) 和
[v1.14.1...v1.14.2 完整差异](https://github.com/AltanS/collie/compare/v1.14.1...v1.14.2)。
该范围有 6 个提交、11 个文件，增加 216 行、删除 24 行。

## 文档与 CLI

- **新增手机操作 Claude Code 的完整指南。**
  [首次指南提交](https://github.com/AltanS/collie/commit/326b1c5c) 和
  [面向 tmux、Herdr 用户的修订](https://github.com/AltanS/collie/commit/2bec9cbd)
  形成 [claude-code-on-your-phone.md](./claude-code-on-your-phone.md)。它先介绍 tmux、
  Herdr、zellij 的启动、分离与重新连接，让 SSH 断开后 agent 继续运行；再介绍用独立
  checkout/worktree 运行多个会话，避免同时修改同一份文件。
- **覆盖从安装到手机回复的六个步骤。** 指南包含安装和启动 Collie、在 pane 中启动
  Claude Code、手机配对与添加到主屏幕、输入回复与 Keys 托盘的 Esc/Ctrl 等按键，以及
  可选 Web Push。说明 tmux/zellij 的 beacon hooks 仅支持 Linux，安装 hooks 后需要
  重新启动已有 Claude Code 实例，iPhone Web Push 需要主屏幕安装；这些是已有能力的
  使用说明，没有新增运行时限制。
- **补充使用前提和其他访问方式。** 包含 Tailscale/HTTPS、主机与手机要求、远程 shell
  的安全说明，并比较 Claude Code Remote Control 与 SSH 手机客户端。主流程也适用于
  Codex、OpenCode 等终端 agent，只需更换 pane 中的启动命令。
- **CLI 内置这篇指南。** `cli/docs-embed.ts` 在 install 之后注册新页面，操作手册由
  10 篇增加到 11 篇；`collie docs` 的列表和 `--all` 包含它，
  `collie docs claude-code-on-your-phone` 可以离线输出正文。未更改既有命令行为。
- **README 更清楚地标出使用对象。**
  [开头文案提交](https://github.com/AltanS/collie/commit/f6f7a2f4) 明确 MIT、自托管、
  Claude Code/Codex/OpenCode 和 iPhone/Android；文档导航增加新指南入口。

## 测试与打包

- **修复 Changes 页面测试的异步时序。**
  [d3b05d95](https://github.com/AltanS/collie/commit/d3b05d95) 将当前 pane 所属仓库的
  自动滚动断言放入 `waitFor`，等待 React passive effect 完成。仅修改测试，页面的
  滚动行为没有改变。
- **AUR/Nix 下载元数据跟进已发布的 v1.14.1。**
  [PR #308](https://github.com/AltanS/collie/pull/308) 更新 AUR 的 `PKGBUILD` 和
  `.SRCINFO` 中 Linux x64/arm64 的版本、下载地址与 SHA256，同时更新 Nix 的 Linux
  x64/arm64 和 macOS arm64 来源与校验值。此次 `v1.14.2` 标签内的这些元数据仍指向
  `v1.14.1`，本次按上游实际内容保留；本机部署使用源码构建的 `v1.14.2+collie.1`。
- **上游版本提交。**
  [887a37db](https://github.com/AltanS/collie/commit/887a37db) 同步三个版本文件为
  `1.14.2` 并归档文档 CHANGELOG；下游独立发布提交使用 `1.14.2+collie.1`。

## 功能、兼容与下游取舍

- **本次没有替换任何既有下游实现。** 11 个改动文件与下游实现没有功能重叠，冲突仅在
  版本号和 CHANGELOG；没有新增 bridge API、配置迁移、agent 版本适配或运行时 UI 改动。
- **保留现有界面。** 16px tab agent 图标、30px tab 行、折叠摘要、紧凑同底操作带和
  实体底部导航均保持现状；本次指南不会引入新导航形态。
- **保留现有适配与保护。** Codex resume/model/permissions 卡片、历史会话识别、警告
  数量及动作、信任卡片、审批上下文、发送保护，以及 Hermes、Cursor 的历史适配和
  workspace 隐藏等下游差异均保留，因为上游没有修改这些路径。
- **保留仓库交付约定。** `AGENTS.md` 的备份入口及 `CLAUDE.md` 的集中备份、保留一个
  完整回滚包和清理暂存规则继续生效。GitHub 发布工作流保持禁用，只推送 main 和注释
  版本标签，不创建 GitHub Release。

手机端已有会话和操作方式不变；可见新增内容是 README/指南和 CLI 文档入口。
