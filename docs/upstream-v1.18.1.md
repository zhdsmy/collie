# 跟进上游 v1.18.1

本次从上游 v1.18.0 跟进至 v1.18.1，下游版本为 `1.18.1+collie.1`，接续 `1.18.0+collie.2`。
核对日期：2026-10-09。

来源：[v1.18.1 发布说明](https://github.com/AltanS/collie/releases/tag/v1.18.1)、
[完整标签差异](https://github.com/AltanS/collie/compare/v1.18.0...v1.18.1)及该标签 CHANGELOG。
上游范围共 34 个提交（含 5 个 PR 合并）、66 个文件，+2094／−88；其中约一半是测试和真实终端样本。

## 上游完整变化

这是一次修复版本，没有新增后端接口、配置项或部署协议；唯一的后端改动在 journal 读取。

| 范围 | 变化与用户影响 | 上游提交 |
| --- | --- | --- |
| Chat 显示斜杠命令 | Claude Code 把 `/subtask`、`/rename`、`/model`、`/color`、`/resume`、`/cd`、`/memory`、`/context` 记为 system 行，Chat 以前跳过它们。现在显示命令、参数和命令打印的输出。改动在 `bridge/journal/claude.ts`。 | [6239cc05](https://github.com/AltanS/collie/commit/6239cc05) |
| CJK／emoji 后重复消息 | journal 增量读取按字符串下标而非字节定位行边界，含中文或 emoji 时下一次读取起点偏前，重发手机已有的行。改为按字节计算（`bridge/journal/files.ts`）。Thanks @GGGODLIN (#377)。 | [ccbd4df0](https://github.com/AltanS/collie/commit/ccbd4df0)、合并 [25c9b60c](https://github.com/AltanS/collie/commit/25c9b60c) |
| Grok 长草稿与滚动条 | 长草稿旁 Grok 画的 `█`／`▁` 滚动条在发送核对时被忽略，回复不再停在“已输入未提交”；手机镜像去掉输出右侧的暗色轨道和整行右侧填充。终端镜像经适配器注册表新增的可选 `prepareDisplay` 调用 Grok 的显示整理，共享组件不再直接 import 某个 harness。Thanks @GGGODLIN (#378)。 | [16ce430e](https://github.com/AltanS/collie/commit/16ce430e)、[0625f8cf](https://github.com/AltanS/collie/commit/0625f8cf)、[c01faeba](https://github.com/AltanS/collie/commit/c01faeba)、[218edf63](https://github.com/AltanS/collie/commit/218edf63)、合并 [1a6bf2f2](https://github.com/AltanS/collie/commit/1a6bf2f2) |
| Grok `/model` 选择器 | 模型、上下文窗口、推理强度三个阶段各自变成按钮卡片；每次只确认当前阶段，不跨阶段连按 Enter，不合成数字键。依据 Grok Build 1.0.46 的实测记录 `MODEL_PICKER_NOTES.md`。 | [29c2f718](https://github.com/AltanS/collie/commit/29c2f718) |
| New space 面板高度 | 收藏和最近目录以前在面板滑入后才出现，面板在手指下向上长高。现在首页和 space 打开时预读目录列表（仅内存缓存，按主机区分），面板从缓存开始，打开时仍会重新读取。 | [559dcc81](https://github.com/AltanS/collie/commit/559dcc81) |
| Claude 后台 agent 时发送卡住 | Claude Code 2.1.293 用 `❯` 标出页脚中活动 agent 的行，Collie 把它当成外来内容而丢失输入框，发送只打字不按 Enter。现在接受页脚自己的行（`steppedMarksAreOwned`）。Thanks @thelinuxlich (#382)。 | [0c5a38e0](https://github.com/AltanS/collie/commit/0c5a38e0)、合并 [e5556721](https://github.com/AltanS/collie/commit/e5556721) |
| Full reply 卡片识别范围 | 回复以折行表格、Markdown 链接、带语言标记的代码块、HTML 或 Grok 表格结尾时也能识别。按源顺序读回折行的方框表格行，并尝试 Claude 的绘制形式（只留链接文字、去掉 fence 标记和 HTML 标签、解码实体）。Grok 滚动条格子和高亮消息外框不再挡住表格。Thanks @GGGODLIN (#380)。 | [82c0c292](https://github.com/AltanS/collie/commit/82c0c292)、[ece2bf2a](https://github.com/AltanS/collie/commit/ece2bf2a)、[08c94754](https://github.com/AltanS/collie/commit/08c94754)、[c92f08c3](https://github.com/AltanS/collie/commit/c92f08c3)、[d49cdcb1](https://github.com/AltanS/collie/commit/d49cdcb1)、[09947027](https://github.com/AltanS/collie/commit/09947027)、合并 [c34dc532](https://github.com/AltanS/collie/commit/c34dc532) |
| Full reply 的稳健性 | 超出范围的 HTML 实体不再让 pane 视图崩溃；按绘制形式比较时不会误接受另一条回复；链接匹配正则改为线性时间，长文本不再回溯数分钟卡住页面。 | [2f43eb13](https://github.com/AltanS/collie/commit/2f43eb13)、[6e3b85f1](https://github.com/AltanS/collie/commit/6e3b85f1)、[f0610862](https://github.com/AltanS/collie/commit/f0610862)、[77d61256](https://github.com/AltanS/collie/commit/77d61256) |
| Type 模式自动关闭 | 窗格的 agent 变化（如 agent 退出回到 shell）时关闭并提示，避免聊天文字被当成 shell 命令；开启后 60 秒无按键也关闭，计时从开启时开始。开启时的提示条改用红色调横幅。新增两条文案，12 种语言同步。Thanks @AndiWandHerd (#379)。 | [a93a029c](https://github.com/AltanS/collie/commit/a93a029c)、[1144d824](https://github.com/AltanS/collie/commit/1144d824)、[707c6b2d](https://github.com/AltanS/collie/commit/707c6b2d)、合并 [b444f115](https://github.com/AltanS/collie/commit/b444f115) |
| iPhone 页面滚动（已撤回） | 曾修改已安装 iPhone 应用的页面滚动，发布前被 revert，净变化为零。 | [d435bae4](https://github.com/AltanS/collie/commit/d435bae4)、[09d99653](https://github.com/AltanS/collie/commit/09d99653) |
| 文档 | DESIGN.md 新增“红色只标危害、不作强调”：可造成伤害或“已武装”的控件用 `--destructive` 色调，通知用 `danger`。`docs/security.md` 开头改为“已配对设备就是入口”，1.18.0 起所有 API 请求都需要配对令牌。fixture README 记录新增样本来源。 | [55464dd5](https://github.com/AltanS/collie/commit/55464dd5)、[cfcea17c](https://github.com/AltanS/collie/commit/cfcea17c) |
| 测试与样本 | 新增 Grok 草稿滚动条、输出滚动条、`/model` 三阶段（含移动后）、两种表格回复，以及 Claude 页脚活动 agent 共 12 个真实 capture；walk-pairs 登记 Grok 指针移动样本；conformance 的“无可绑定区域”说明放宽为“动画或在 bridge 尾部窗口外”；测试 setup 每例重置目录缓存。 | [729b7826](https://github.com/AltanS/collie/commit/729b7826)及上述修复提交 |
| 发布元数据 | 版本号与 CHANGELOG；一个从 PR 分支删除本地计划笔记的 chore，净变化为零。无依赖、构建工具或 `flake.lock` 变化。 | [cfaf95a9](https://github.com/AltanS/collie/commit/cfaf95a9)、[a3892a17](https://github.com/AltanS/collie/commit/a3892a17) |

## 替换的下游实现

只有 Type 模式提示条的样式被上游替换，经运营者选择采用。

| 旧行为 | 本次采用的行为 | 可见影响 |
| --- | --- | --- |
| Type 模式开启后，输入框上方显示一条低调的主色文字行。 | 上游红色调整宽横幅（`border-destructive/40 bg-destructive/10 text-destructive`），保留下游有草稿时显示“草稿已保留”的文案。 | 开启状态一眼可见，符合 DESIGN.md 新增的红色规则；输入区上方多一条醒目的红条。 |

没有替换其他下游功能。

## 组合与保留的下游差异

Type 模式是本次唯一的功能冲突，运营者选择两条自动关闭规则都合入，并与下游改造组合。

| 项目 | 处理 |
| --- | --- |
| Type 模式（组合） | 保留下游：开启时不弹键盘、有草稿也能开启并保留草稿、修饰键／组合键辅助行。合入上游：agent 变化关闭、60 秒空闲关闭。组合点：空闲计时放在所有按键都经过的 `enqueueWithModifiers`，并在切换修饰键、切换按键行时重新计时，因为不弹键盘时辅助行可能是唯一的操作。上游开启时的聚焦调用不合入，以保持不弹键盘。新增一条测试覆盖辅助行重新计时，并做了去掉该逻辑即失败的反向核对。 |
| Raw 块的 `sessionInfo` | 上游 Grok 显示整理会把 raw 块重建为只有 `kind`／`lines`，会丢掉下游折叠启动信息用的 `sessionInfo`；合并时显式保留该字段。 |
| 适配清单 | `scripts/harness-canary/adaptations.json` 新增 `grok.model-picker`（上游来源，三阶段 capture 回放），并把 `claude--footer-pointed-agent.txt` 加入 `claude.status-hints` 的回放样本。 |
| 其他已有定制 | Claude 页脚的 vim 提示与通知行识别、段落拼接实验、启动信息折叠、紧凑卡片、Codex 原生／卡片问答等全部保留，与本次修复无冲突。 |
| 发布方式 | 只推 main 和指定版本标签，不创建 GitHub Release，不恢复上游工作流；本机继续由 Herdr 管理 Collie。 |

## 验证与边界

使用测试套件与 capture 回放验证，没有额外触发模型任务。

| 检查 | 结果与范围 |
| --- | --- |
| Web 单元 | Vitest 408 个文件：24990 通过、33 预期失败、73 todo（合并后、新增辅助行测试前的全量）；新增测试与 Type 模式相关的 5 项定向通过。 |
| 后端 | `bun run test` 全部通过（5087 + 1934 + 319 项，以及 CLI／hook／打包脚本测试）。 |
| 适配清单回放 | `catalog.test.ts` 通过，包括新增的 Grok `/model` 三个阶段和 Claude 页脚样本。这是上游 capture 回放，只证明识别。 |
| 类型与 lint | 根目录和 web 类型检查、全仓 oxlint 通过；合并时修正了上游新测试缺少下游 `rejoinWraps` 偏好的 fixture。 |
| 未覆盖 | 未用本机 Grok 或 Claude 2.1.293 做实时按键验证（上游已有 Grok 1.0.46 的实测记录），未进行 iPhone 真机或 Windows 运行验证。 |
