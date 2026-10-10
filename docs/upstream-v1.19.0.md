# 跟进上游 v1.19.0

本次接续 `1.18.1+collie.1`，发布 `1.19.0+collie.1`。核对日期：2026-10-10。

来源：[发布说明](https://github.com/AltanS/collie/releases/tag/v1.19.0)、
[完整标签差异](https://github.com/AltanS/collie/compare/v1.18.1...v1.19.0)及标签 CHANGELOG。
标签实际指向 `632a2bf7`，包含版本提交 `06d08838` 后的 Windows worktree 修复；共 189 个文件变化。

## 上游完整变化

主要新增统一新建页、自定义 Keys 面板和模型标签，同时修复聊天记录与服务响应问题。

| 范围 | 行为与用户影响 | 上游依据 |
| --- | --- | --- |
| 统一 New 页面 | Dashboard 的浮动“+ New”滚动时缩为圆形；打开 `/new` 选择机器、智能体或 Shell、目录和 worktree。Start 固定在键盘上方，URL 保留机器和面板，刷新可恢复上下文。空 Dashboard、工作区目录入口和面板 worktree 菜单均进入此页。 | [241a73f6](https://github.com/AltanS/collie/commit/241a73f6) |
| 按机器发现智能体 | bridge 检查 Claude、Codex、opencode、pi、omp、Grok、Hermes、Muse、Antigravity 的程序是否存在，包含 login shell PATH；未安装和不支持的选项保留并显示原因。 | [c7a64af0](https://github.com/AltanS/collie/commit/c7a64af0) |
| 幂等启动 | 每次 Start 带 requestId；重复点击、响应丢失后的重试返回第一次创建的面板，避免重复启动。 | [c7a64af0](https://github.com/AltanS/collie/commit/c7a64af0) |
| Worktree 起点和目录 | 可从默认分支或面板当前分支创建，不自动 fetch，不搬走未提交修改。可选择 home 内的父目录，由 bridge 按分支命名子目录；拒绝隐藏目录、仓库内路径、链接、home 外路径和已存在目标；计划及创建时均重新检查。每个仓库记住选择。 | [5fe776f6](https://github.com/AltanS/collie/commit/5fe776f6)、ADR 0093 |
| 手机添加启动器 | 可选智能体配方和参数，预览实际命令；手写持久启动器需 `[phone] free_text = true`。最多 20 条，存在各机器 `launchers-added.json`，不修改 `launchers.toml`；配置文件同命令优先，`[phone] adds = false` 可禁用。读取和写入均拒绝控制/分隔/bidi 字符。支持改名、删除、查看配置说明与复制示例。 | [a7feb24d](https://github.com/AltanS/collie/commit/a7feb24d)、ADR 0094 |
| 跳过权限提示的确认 | 启动器可声明 `harness`、`no_prompts`；识别会跳过权限提示的命令，显示标记并首次确认，按手机、机器和命令记住答案。解绑清除本机确认和 Again 记录。撤销设备移除它添加的启动器，并尽力传播到 Crew 成员；离线成员可能仍保留记录。 | [d2d1ec28](https://github.com/AltanS/collie/commit/d2d1ec28) |
| 一次性命令与历史 | Shell 下可直接输入命令，在新 shell 指定目录运行，不支持新 worktree；默认允许，`[phone] run = false` 可关闭。每机器保存最近 12 条至 `commands-recent.json`，支持单条/全部删除和 Again。疑似含密钥的命令不进历史；审计仅记录程序词和长度。 | [c5a9127a](https://github.com/AltanS/collie/commit/c5a9127a)、[efc4b8c3](https://github.com/AltanS/collie/commit/efc4b8c3)、ADR 0095 |
| 可编辑 Keys | 七列网格，可拖动或箭头调整，键宽 1–3 格、高 1–2 格；添加、改名、删除、扩行，支持三个修饰键加一个按键、最多四步序列和粘滞修饰键。默认、Claude、Prefix (Ctrl+B)、Vim、Navigation 五种预设；布局码导入导出，替换整板前确认，布局保存在浏览器。发送继续使用原按键通道、离线/权限锁及危险键二次确认。 | [7b61ea1c](https://github.com/AltanS/collie/commit/7b61ea1c)、[e9965ca8](https://github.com/AltanS/collie/commit/e9965ca8)、ADR 0092 |
| 默认键盘布局 | Space 横跨三格，Enter 放第二行左端，普通 Ctrl+C 保持单次点击。移除设备边框装饰，编辑入口放 Keys 标题旁，底部避开 home indicator；Ctrl+B 预设名称改为 Prefix。 | [886b09bf](https://github.com/AltanS/collie/commit/886b09bf)、[4c120a51](https://github.com/AltanS/collie/commit/4c120a51) |
| 模型标签 | Claude、Codex、opencode、pi 可在面板右下角显示会话模型，Claude `/model` 后无需再发一轮消息即可更新；原生页脚已显示模型时隐藏，避免重复，连续帧确认避免闪烁。 | [f35aa96a](https://github.com/AltanS/collie/commit/f35aa96a)、[3856fc11](https://github.com/AltanS/collie/commit/3856fc11) |
| 新建交互修复 | 不支持 worktree 的多路复用器不再显示错误入口；拒绝 Start 时显示具体原因。裸目录名按 home 下路径解释，显示绝对路径，目录不存在时提前拒绝。点击最近目录后焦点移到 Start。 | [6bfa0885](https://github.com/AltanS/collie/commit/6bfa0885)、[0e6ff23d](https://github.com/AltanS/collie/commit/0e6ff23d)、[25f60f5f](https://github.com/AltanS/collie/commit/25f60f5f) |
| 移除旧新建 sheet | 原来的 New space sheet 并入 New 页，不再提供自定义 space 标签和已有 worktree 列表；打开已有 worktree 使用主机 `herdr worktree open`。 | [a5a3cbdf](https://github.com/AltanS/collie/commit/a5a3cbdf) |
| Sheet 背景滚动 | 手机 WebKit 打开/关闭 sheet 时保持原页面位置，关闭整个 sheet 堆叠后恢复，避免背景跳到顶部或底部。 | [c969c1d5](https://github.com/AltanS/collie/commit/c969c1d5) |
| Claude 运行中消息 | Claude 2.1.293 可能直接吸收消息而不写 user turn；Chat 现在按发送时刻补出自己的消息，Send now 和同一轮后续消息不再消失。新增 Codex、pi、opencode 对照测试。 | [b6dc5d1c](https://github.com/AltanS/collie/commit/b6dc5d1c) |
| Windows 自恢复 | launcher 启动宽限两分钟后每 30 秒检查健康，连续三次无响应才结束 bridge 并重新启动；任何 HTTP 响应都算活着，不误杀冷备用或已退位节点，无备用门的 peer 不探测。探测绕过 HTTP_PROXY。针对 #386 的恢复措施，未声称已找到所有冻结根因。 | [#387](https://github.com/AltanS/collie/pull/387)、[1459ca2f](https://github.com/AltanS/collie/commit/1459ca2f) |
| Crew 退位超时 | 撤掉本机 tailscale serve 映射时，每次命令最长 30 秒，超时报告失败，避免无限阻塞 bridge 主线程。 | [6193ac41](https://github.com/AltanS/collie/commit/6193ac41) |
| Windows 路径修复 | worktree 计划正确寻找主 checkout，测试断言使用本机路径格式；该修复在 v1.19.0 标签中。 | [632a2bf7](https://github.com/AltanS/collie/commit/632a2bf7) |

## 文档、协议与工程变化

上游同步更新十二种语言和新接口契约，没有升级依赖或恢复本 fork 的 CI。

- 新增 ADR 0091–0095，更新分支创建 ADR 0089；README、配置、Claude 手机使用、安全、升级、故障排查、Crew、Windows 文档覆盖新流程，并明确应用不发送遥测。
- `CREW_PROTOCOL.md` 记录启动器、运行和撤销传播；lead 转发仍使用既有鉴权边界，各机器保存自己的启动器和命令历史。
- 增加启动去重、目录边界、控制字符、密钥不留历史、设备撤销、键盘布局/拖放/序列、模型去重、Chat 和 Windows 探测的测试；调整 New 和键盘浏览器用例。
- Playground 与 DESIGN 更新新建页、可编辑键盘和交互布局；类型镜像、错误码、缓存、存储清理和 lint 边界同步更新。
- 保留本 fork 的发布策略：只推 main 与注解版本标签，不创建 GitHub Release，不启用 `.github/workflows/`。

## 下游合并与保留

采用上游新建页和对应 API，保留此前已选定的紧凑界面和智能体适配。

按用户选择，Keys 面板完整采用上游实现供体验：操作带独立 Keys 入口、原版网格、标题/编辑按钮、按键队列和布局编辑器。原来 Type 下的单行辅助键栏不再显示，Type 保留独立开关；其他 Quick/Agent/Display 弹层保持原定制。

已排队按键会同时锁住本地模型/模式操作，防止这些入口关闭 Keys 时丢失队列。

- New space sheet 是此前沿用的上游实现，本次按上游迁移到 New 页；旧标签和已有 worktree 选择的移除影响见上表。
- 保留 Codex 最近模型、Resume、Agents、问答/Plan/review，Claude Settings/Agents，Hermes 历史等定制卡片及离线保护。
- 保留 Type 直输安全锁、紧凑操作带、统一 Quick/Agent/Display 弹层、自定义字体、16px 智能体图标、PWA 高度、折行重组和通知约定。
- 模型标签与现有 statusline 配合隐藏；保留本地会话模型/effort、TTFT 和 Codex 会话身份接口。
- 统一 wipe 同时清理本地最近模型、上游 Again 和 no-prompts 确认记录；保存显示与 Keys 布局偏好。
- Cursor 的历史读取能力保持；新内置启动列表不猜测 Cursor 的命令，继续使用已配置启动器，目录校验明确列出此边界。

## 验证

分阶段复用已通过的检查，接入后只补必要回归和发布检查。

- bridge：5,388 项先通过；新启动器清单漏列本地 Cursor 历史能力的一项失败已修复，对应文件 10 项回归通过。
- CLI：1,957 通过，1 项 Windows 平台检查跳过；scripts：273 通过，46 项 Windows 平台检查跳过。
- Crew 双 bridge 集成：66 项通过。
- 全前端：423 文件通过，25,441 项通过；另有 33 项预期失败、73 项 todo。包括新建页、Keys 编辑/发送/关闭确认、Type、离线锁、模型去重、wipe 和 Composer/AgentChat 的 409 项。
- 浏览器：Chromium 手机视口的 4 项通过，覆盖 320/390px Keys 网格与编辑器、New 页目录/收藏/启动；确认编辑器展开后网格完整可见，保存截图。未重复整个历史 E2E 套件。
- 根目录和 Web 类型检查、全仓 lint、正式 CLI/前端构建及编译后二进制命令检查通过。
- 未新增模型调用，未做 iPhone 真机或 Windows 运行验证；浏览器使用隔离 API 样本，不能替代真实终端端到端发送证明。
