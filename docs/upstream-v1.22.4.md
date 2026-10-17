# v1.22.4 合并记录

本次从 `1.22.3+collie.3` 升级到 `1.22.4+collie.1`。已核对[上游发布说明](https://github.com/AltanS/collie/releases/tag/v1.22.4)、CHANGELOG 和 [v1.22.3…v1.22.4 完整差异](https://github.com/AltanS/collie/compare/v1.22.3...v1.22.4)：6 个提交、23 个文件，没有新增依赖。

## 上游全部变化

| 范围 | 行为变化与边界 |
| --- | --- |
| Claude 命令菜单位于输入框下方 | 从操作带或 Agent 面板发送 `/model` 等命令时，Claude 弹出的自身补全列表不再被当作阻塞弹窗，选中项与输入命令一致时可直接提交。宽屏单行说明与折行说明均能识别。[修复](https://github.com/AltanS/collie/commit/89506ecd) |
| Claude 命令菜单位于输入框上方 | 较高窗口把补全列表画到输入框上方时，同样识别；只从正文比较中排除该命令自身的列表，避免将其当作正文变化而留下未提交草稿。[修复](https://github.com/AltanS/collie/commit/0f7c55c1) |
| 防止提交其他命令 | 如果菜单选中项与输入命令不同，等待画面稳定后仍不一致，就保留输入、不按 Enter，并给出明确原因。其他弹窗和未知菜单继续受原有保护。 |
| 输入配置与回归 | Claude 输入配置新增可选的 `volatile.below.commandList` 定义及校验。新增两个 Claude Code 2.1.302、119 列的真实样本，更新输入框区域、Surface 标签、样本说明，以及 autocomplete、chrome、输入框、Surface、共享 conformance 和发送协议测试。 |
| 打包与发布记录 | AUR 的 PKGBUILD／.SRCINFO 和 Nix sources 跟进上游 1.22.3 的包源及校验值；这是本标签实际携带的打包更新，没有擅自改成 1.22.4。同步上游版本与 CHANGELOG。[打包 PR #477](https://github.com/AltanS/collie/pull/477) |

## 下游取舍

本次没有用上游替换任何独立的下游实现。发送协议沿用已批准的上游方案，合入本次命令列表修复。

- 保留刚恢复的输入区单排按键设计：点击 Type 进入直接输入，退出恢复原来的草稿和附件。
- 保留 Codex 的排队／引导偏好、单次立即引导和已有排队消息的受保护引导；它们不改变 Claude、Hermes 的原生提交语义。
- 保留本地 Codex Resume、Model、Agents、Plan、Review、权限卡片、警告数量，以及模型／模式切换保护；保留 `/resume` 滚动和图片占位符校验。
- 保留 Hermes 0.22.1 中文输入及忙碌输入配置、历史和操作提示，Claude Settings／Agents 卡片，Cursor 历史，紧凑布局、字体、PWA 视口和 tab 图标。
- Surface 标签按键合并，两边新增样本均保留。GitHub Actions 保持禁用，不创建 GitHub Release。

## Hermes 完成状态、黑点和通知

问题位于本机 Herdr 的检测规则，不在 Collie 的黑点组件。当前远端 Hermes manifest `2026.07.24.1` 依靠 OSC 标题、`msg=interrupt`、`ctrl+c to interrupt` 等英文提示；本机 Hermes 0.22.1 的忙碌输入框显示 `☤ ❯` 和中文提示，标题没有工作状态。`herdr agent explain` 因此没有命中规则，一直回退为空闲。

Collie 已有 `working → idle/done` 的完成事件、未读时间戳和通知逻辑。没有工作状态，就不会产生这一完成边沿；`hooks: none` 本身不是本次故障的根因，Herdr 的 Hermes 集成仍正常报告会话身份。

本机采用 Herdr 已有的[本地覆盖与热加载机制](https://github.com/herdrdev/herdr/blob/master/docs/next/website/src/content/docs/cli-reference.mdx)，在 `~/.config/herdr/agent-detection/hermes.toml` 保留原规则并增加两条，版本为 `2026.10.18.1`：

```toml
[[rules]]
id = "tui_prompt_working"
state = "working"
priority = 500
region = "bottom_non_empty_lines(5)"
visible_working = true
line_regex = ['^[ \t]*[☤⚕][ \t]+❯(?:[ \t]|$)']

[[rules]]
id = "tui_prompt_blocked"
state = "blocked"
priority = 1000
region = "bottom_non_empty_lines(5)"
visible_blocker = true
line_regex = ['^[ \t]*(?:⚠[\u{fe0e}\u{fe0f}]?|[?✎🔐🔑])[ \t]+❯(?:[ \t]|$)']
```

识别原生状态图标和提示符，不依赖中文或英文的忙碌提示。等待授权／回答的图标优先于忙碌规则，避免把等待输入当作完成；模型状态栏的 `☤ model` 不匹配。执行 `herdr server reload-agent-manifests` 即时生效，未重启 Hermes 或 Herdr，也没有修改 Herdr 管理的身份插件。

这是**本机配置修复**，不是 Collie 安装包新增的全局规则。它覆盖当前标准 `❯` 提示符；自定义皮肤、极简无箭头提示符尚未验证。本地覆盖会遮蔽未来远端 Hermes manifest：上游覆盖这些状态后，应先回放当前忙碌／空闲样本，再删除本地覆盖并热加载，避免长期冻结旧规则。

验证结果：

- 真实忙碌样本修复前为 `idle`，修复后命中 `tui_prompt_working`；当前空闲会话仍为空闲。另用合成的语言、等待图标、旧屏内容和模型状态栏反例检查，共 7 项通过。合成等待图标检查不等于原生授权界面的完整认证。
- 在实际 General Hermes 会话发送一次不调用工具、不修改文件的简短验证消息，发送回执为 `sent`。23 次采样记录了 `idle → working → done`，完成后的 `lastActiveAt > lastSeenAt`，未读黑点所需的数据恢复。
- 完成通知开关开启，Web Push 开启且有两条现存订阅；本轮服务日志没有推送失败。现有完成事件及通知测试通过，但没有把手机实际弹出通知作为已验证结果。临时验证配对已撤销。

## Hermes 缓存冷热状态

本次不新增推测性的冷热标记。当前 Hermes SQLite 的 `sessions`／`session_model_usage` 保存累计 cache-read／cache-write tokens，`messages` 没有逐请求缓存统计或 TTL。它能说明历史上命中过缓存，不能证明现在仍有效。

Collie 的 Hermes journal 没有 `cacheProbe`，缓存规则也明确将 Hermes 留为未知。本会话的 DeepSeek 模型还存在供应商层面的限制：[官方缓存说明](https://api-docs.deepseek.com/guides/kv_cache/)将命中信息放在单次响应 usage 中，缓存清理由服务端决定，没有可供准确倒计时的固定有效期。以后若原生持久化逐请求 usage，可以显示最近请求的命中情况；这仍与当前缓存是否存活不同。

## 验证与交付

- 后端发送协议、状态引擎、活动时间戳和通知：527 项通过。
- 前端命令列表、Claude 输入框及共享 conformance：6 个文件、2,707 项通过，2 项已有 TODO。
- root／web 类型检查、全库 lint、差异格式检查通过；没有新增卡片，不重复扩充卡片目录或全量 CLI 认证。
- 从干净标签正式构建，推送 main 与 annotated tag，部署后只重启 Collie。按用户要求只用 localhost 回读构建标识、配置、快照、Files、更新信息和健康状态；保留一个完整回滚包，清理本轮暂存和上一个回滚包。
- 未重复浏览器布局、iPhone 真机通知、Windows 或多机 Crew 验证；没有启动定时监测。
