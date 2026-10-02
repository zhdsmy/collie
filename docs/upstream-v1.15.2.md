# 上游 v1.15.2 跟进报告

当前下游基线：`v1.15.0+collie.2`。目标版本：`v1.15.2+collie.1`。

上游发布：[v1.15.1](https://github.com/AltanS/collie/releases/tag/v1.15.1) · [v1.15.2](https://github.com/AltanS/collie/releases/tag/v1.15.2)。本报告对照两版发布说明、上游 [`CHANGELOG.md`](https://github.com/AltanS/collie/blob/v1.15.2/CHANGELOG.md)、`upstream/v1.15.0..upstream/v1.15.2` 的提交与文件差异。

## 上游变化

### Chat 与会话卡片

- **压缩记录默认收成一行。** Chat 和历史记录显示“Context compacted”及时间，不再把整段 recap 构造成大块内容；可在 Appearance 或单个 pane 的 Display 中启用，展开时才加载正文。历史搜索仍能找到 recap；较长的机器备注也折叠在 System 项下。[`ec93cae6`](https://github.com/AltanS/collie/commit/ec93cae6)
- **Chat 显示问题工具的内容。** 会话卡片展示 OpenCode `question` 和 Claude `AskUserQuestion` 的题目、选项及已选答案，等待回答时提示对应的终端对话框。[`10a383c9`](https://github.com/AltanS/collie/commit/10a383c9) · [PR #329](https://github.com/AltanS/collie/pull/329)
- **手机可操作 OpenCode 问答框。** 会话解析器读取 OpenCode `question` 调用及 Claude 问答结果。单选点选即提交；多选使用勾选与确认页；多题使用分步页。共享卡片模型携带各终端自己的提交、取消和返回按键计划，并校验回显答案。自由文本输入时锁住卡片，不代替用户输入；超过九个选项时保留原始终端界面。上游记录了 OpenCode 1.18.33/1.18.34 的 25 份终端样本，细节见 [`QUESTION_NOTES.md`](https://github.com/AltanS/collie/blob/v1.15.2/web/src/lib/harness/opencode/QUESTION_NOTES.md)。[PR #329](https://github.com/AltanS/collie/pull/329)
- **切到 Chat 时避免先闪空白。** pane 菜单或 Display 打开期间预读会话，等首个结果后再切换，最长等待 1.5 秒；直接进入 Chat 不等待。[`6ca7b5a4`](https://github.com/AltanS/collie/commit/6ca7b5a4)

### 终端识别与兼容

- **修正 Claude 默认页脚误判。** `esc to interrupt`、`↓ to manage` 及窄屏省略号截断形式识别为输入区状态，不再误判成 modal 按键；识别逻辑同时用于输入框和未识别对话提示。真正的 `Esc to cancel`／`Esc to close`、编号选项及混有真实 modal 按键的行仍会阻止发送。此前下游只在已确认的 statusline 中豁免精确的 `esc to interrupt`；现在采用上游共享的 `namesAModalKey` 规则，覆盖背景任务提示及截断文本。[`63bf5b61`](https://github.com/AltanS/collie/commit/63bf5b61) · [PR #330](https://github.com/AltanS/collie/pull/330)
- **清理 tuios 空标题。** tuios 尚未收到应用标题时会提供 `Terminal` 加窗口 ID 前缀；Collie 不再把占位值当作程序标题，手机上显示为 shell。[`20df9596`](https://github.com/AltanS/collie/commit/20df9596) · [PR #328](https://github.com/AltanS/collie/pull/328)

### Windows 更新与生命周期

- **支持社区 Task Scheduler 管理的 Windows 更新。** 重启只停止记录的 Collie bridge，由 supervisor 再拉起；构建正确定位 `collie.exe`，先编译到暂存文件再替换运行中的可执行文件。暂存文件缺失时不挪走现有程序；替换失败会恢复旧文件。[PR #309](https://github.com/AltanS/collie/pull/309)：[`c942047b`](https://github.com/AltanS/collie/commit/c942047b)、[`2c96e76b`](https://github.com/AltanS/collie/commit/2c96e76b)、[`039a4b11`](https://github.com/AltanS/collie/commit/039a4b11)、[`eb1fd1ca`](https://github.com/AltanS/collie/commit/eb1fd1ca)、[`a0017871`](https://github.com/AltanS/collie/commit/a0017871)。
- **重启失败时返回失败状态。** Windows supervisor 等待 bridge 健康响应，默认 30 秒并遵守 `COLLIE_UPDATE_HEALTH_TIMEOUT_MS`；超时会提示查看 `collie status` 和 `collie-ctl.ps1 logs`，不再报告更新成功。手机更新仍执行自己的健康检查与一次回滚。[`29760622`](https://github.com/AltanS/collie/commit/29760622)
- **统一可执行文件路径并缩短 Windows 进程查询默认等待。** `collieBinary` 成为 CLI 与 bridge 共用的路径解析；Windows 进程查询设定较短默认上限，避免生命周期操作无谓等待。[`6ff6e645`](https://github.com/AltanS/collie/commit/6ff6e645) · [`a0017871`](https://github.com/AltanS/collie/commit/a0017871)
- **补齐版本及发行包元数据。** AUR 与 Nix 来源信息更新至 1.15.0（[PR #325](https://github.com/AltanS/collie/pull/325)），在 v1.15.2 标签中仍指向 1.15.0；Herdr 插件、根和 Web 包版本则同步至 1.15.2。上游仍将 Windows 标注为社区支持、尽力维护。[`3e4f36cd`](https://github.com/AltanS/collie/commit/3e4f36cd) · [`v1.15.2`](https://github.com/AltanS/collie/releases/tag/v1.15.2)

### 文档与验证材料

- `MUX_CONTRACT.md` 补充 tuios 标题行为和实测说明；OpenCode 问答适配新增样本说明及多种终端状态 fixture。
- Claude 页脚修复新增运行中与后台任务状态的采样，并更新输入框及未识别对话测试；OpenCode 卡片新增选择、确认、取消、自由文本和窄屏等状态样本。以上是上游提交中的覆盖记录，不代表本仓库已通过这些检查。
- 上游发行说明：[1.15.1 CHANGELOG](https://github.com/AltanS/collie/blob/v1.15.1/CHANGELOG.md) · [1.15.2 CHANGELOG](https://github.com/AltanS/collie/blob/v1.15.2/CHANGELOG.md)。

## 与下游定制的关系

- **被上游替换：Claude 工作状态提示的窄规则。** 旧实现只在已经确认的 statusline 中放行精确字符串 `esc to interrupt`。新实现通过共享识别器同时处理 `esc to interrupt`、`↓ to manage` 和窄屏截断形式，供输入框识别与 modal／未识别对话判断共同使用。用户可在 Claude 正在工作或有后台任务时正常使用输入区，也不会再看到误报的“Collie 未识别此界面”。真实 modal footer 和选项仍受保护。
- **保留的 Claude 定制：** 右对齐 aside 行例外（`isClaudeAsideRow`）、Claude 提示按钮及其状态行文案继续保留；这与新增的默认 footer 状态提示识别并行。
- **不被替换的面板定制：** 紧凑操作带，以及 Quick／Agent／Display 统一的 `BottomSheet` 外观和弹出位置继续保留；Agent 列表默认显示五项并在列表内滚动。上游新增的 Compaction summaries 控件属于 Chat／Display 内容设置，不改变这些面板布局。
- **其他下游适配继续保留：** Codex、Claude、Hermes、Cursor 的适配及 Stats／Settings／Agents 卡片均不由本次上游功能取代。除上述 Claude 精确状态提示规则外，本次没有其他下游实现被上游替换。

## 本地验证

- 后端定向检查：8 个文件、562 项通过，覆盖会话解析、tuios 和构建／生命周期／更新逻辑。
- 前端定向检查：35 个文件通过，4917 项通过、1 项预期失败、7 项 todo。覆盖 Claude／OpenCode 识别、共享卡片和动作、Chat／历史／显示设置；预期失败和 todo 不算通过。
- 根与 Web 类型检查、全仓 lint、前端构建通过。CHANGELOG 格式检查 40 项通过；适配目录回放及路径校验通过。新增 `claude.status-hints`、`opencode.question` 记录，没有新增定时任务或 live 验证声明。
- Chromium 浏览器 3 项通过：320px Settings／Display，以及 320px、390px Quick／Agent／Display 标题样式和弹出位置一致，Agent 列表完整显示五行并可滚动。
- 保存 5 张 320×844 样本回放截图：Claude 工作中、后台任务，以及 OpenCode 单选、多选、多题。文件位于本机 `~/.local/state/collie/harness-health/upstream-v1.15.2/screenshots/index.md`，无页面错误；它们证明保存画面的呈现，不证明当前 CLI 的原生按键行为。
- 只读真实日志探针：Claude、Codex 解析成功，0 失败；其他 5 个适配器未找到日志，未验证其本机历史读取。未运行额外模型请求，未操作用户真实会话，未实测 Windows 或 iPhone 安装版 PWA。
