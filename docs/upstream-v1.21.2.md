# 跟进上游 v1.21.2

从 `1.21.1+collie.1` 跟进到 `1.21.2+collie.1`，保留现有 Collie 定制。

已交叉核对 [官方发布说明](https://github.com/AltanS/collie/releases/tag/v1.21.2)、
[CHANGELOG](https://github.com/AltanS/collie/blob/v1.21.2/CHANGELOG.md#1212---2026-10-14)
与 [完整标签差异](https://github.com/AltanS/collie/compare/v1.21.1...v1.21.2)。
上游标签 `575e7218`，范围包含 7 个提交、21 个文件。

## 上游变化

| 范围 | 变化和用户影响 | 依据 |
| --- | --- | --- |
| Claude 长文本与多图 | 修复长文本末尾多个图片路径只计入最后一张、因此不按 Enter 的问题。按 Claude 的粘贴分段规则统计图片及剩余文本；图片数量和剩余文本行数必须匹配，图片尚未附上时继续等待。仅认定 Collie 上传路径，不放宽对未知内容的发送保护。上游实测版本为 Claude Code 2.1.299。 | [e94848d4](https://github.com/AltanS/collie/commit/e94848d4) |
| 图片编号 | 草稿已有无附件对应的 `[Image #1]` 等标记时，新附件从所有已有 Image／File 编号之后分配，避免两个同号标记都被替换成新图片路径，导致重复发送。旧标记保留为文本。 | [e32ecb57](https://github.com/AltanS/collie/commit/e32ecb57) |
| Crew 列表刷新 | 转发到成员的启动、新建 workspace／tab、关闭或改名成功后，让 lead 暂时使用快速轮询。成员新 pane 的出现和智能体识别不再等待最长约 12 秒的空闲周期；不改变常态轮询。 | [cee70af6](https://github.com/AltanS/collie/commit/cee70af6) |
| 顶部状态图标 | pane 顶部智能体图标上的状态标记增加实心底色，工作中标记停止旋转，避免底图透出和加载动画的歧义。下方 pane chip 的工作中动画保留；尺寸不变。 | [ce8d8adf](https://github.com/AltanS/collie/commit/ce8d8adf) |
| 新工作区命名 | 从 New 页用启动器创建 workspace 时，工作区改用目录名，启动器名称放到 tab。已有同名工作区时依次使用 `app-2`、`app-3`。已有工作区和旁边新建 tab 不改名，临时命令仍以命令词命名。适配器不支持 tab 改名或改名失败时，启动继续。Crew 各成员按自己运行版本执行。 | [2e91f43c](https://github.com/AltanS/collie/commit/2e91f43c) |
| 文档 | 配置指南同步上述 workspace／tab 命名规则。 | [configure.md](https://github.com/AltanS/collie/blob/v1.21.2/docs/configure.md) |
| 打包与测试 | AUR／Nix 的上游二进制来源和校验值跟进 1.21.1，这是本次标签包含的打包更新，并非本机版本号。增加粘贴、附件、状态图标、启动和转发回归；版本文件更新到 1.21.2，无新增依赖。 | [#435](https://github.com/AltanS/collie/pull/435)、[575e7218](https://github.com/AltanS/collie/commit/575e7218) |

## 本地取舍

本次没有独立的本地实现被上游替换。功能代码自动合并，冲突仅涉及版本号和 CHANGELOG。

- 保留 Codex 模型、Resume、Agents、Plan、Review、权限卡片、警告数量及受保护发送，包括 Plan 模式发送修复。
- 保留 Claude Settings／Agents 卡片、Hermes 中文历史和操作提示、Cursor 历史支持。
- 保留紧凑操作带、tab 智能体图标、字体与显示设置、PWA 视口修复；Keys 继续采用上游实现。
- 保留通知已读处理、经济型 harness 验证和关闭的定时监控。本次改动发送校验，不新增卡片识别，也不把上游实测记录标记为本机实测。
- 保留 `+collie.N`、main 与注释标签交付，不创建 GitHub Release、不恢复 Actions，只重启 Collie。

## 验证

- 后端启动、命名、改名失败回退与 Crew 转发：4 个文件，449 项通过。
- Claude 粘贴、附件编号、输入组件及状态图标：5 个文件，499 项通过。
- 受保护发送、图片及离线行为：3 个文件，135 项通过。
- Chromium／WebKit 共 4 项手机检查通过：320px 顶部栏可滚动，警告卡片退出后图片、图文混合、路径和超长文本仍能发送。发送用例原先依赖旧键盘栏，现改用已有卡片的 Esc 二次确认；应用行为未因此变更。
- 前后端类型检查、全仓 lint 通过。发布构建从干净标签生成；部署后的本地／Tailnet 检查结果见最终交付记录。

复用现有模拟 API 与发送样本，不调用模型、不修改真实对话。未实测 Claude 2.1.299、真实 Crew 成员启动、Windows VM 或 AUR／Nix 安装。上一版记录的 150% 字号更新停止页按钮裁切不属于本次上游修复。
