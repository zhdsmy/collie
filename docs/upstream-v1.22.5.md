# v1.22.5 合并记录

从 `1.22.4+collie.1` 升级至 `1.22.5+collie.1`。已交叉核对[官方发布说明](https://github.com/AltanS/collie/releases/tag/v1.22.5)、标签内 CHANGELOG 和 [v1.22.4…v1.22.5 完整差异](https://github.com/AltanS/collie/compare/v1.22.4...v1.22.5)：237 个文件、48 个非合并提交，包含上游版本提交之后继续纳入正式标签的修复；没有新增依赖或锁文件变动。上游将此版本标记为紧急修复，主要因为 pi 扩展 footer 自 1.22.0 起会阻止发送，以及 Claude 选择器／提示可能阻止点击。

## 上游全部变化

| 范围 | 行为变化与边界 |
| --- | --- |
| pi 自定义 footer | 输入框紧邻下方、延伸至画面末尾的着色扩展 footer 也能作为输入框边界，不再拒绝所有发送。同样着色的选择器、提问界面仍不能当作输入框。[PR #485](https://github.com/AltanS/collie/pull/485) |
| 命令列表与滚动 | Claude 的自身命令列表允许正文按列表行数向上滚动；全屏末尾的空白填充也计入，但要求列表下方没有其他内容，且至少保留两行非空正文锚点。pi 0.87.1／1.3.0、OMP 18.6.1 也登记自身命令列表。只有选中项与输入命令完全相同才放行，其他选中项、真正模型选择器和 Settings 仍拦截。[短窗口](https://github.com/AltanS/collie/commit/37d80b1e)、[空白区域](https://github.com/AltanS/collie/commit/75353d3a)、[pi／OMP](https://github.com/AltanS/collie/commit/7f10761d) |
| Claude 模型／Effort 点击 | 周配额等顶部临时提示出现或消失时，不再改变选择器身份。方向键移动后，手机确认卡片高亮与待回答快照一致；不一致先回读，不能确认卡片之外的选项，减少多次点击。[临时提示](https://github.com/AltanS/collie/commit/0456e207)、[高亮同步](https://github.com/AltanS/collie/commit/d68e3b65) |
| Claude 提问卡片 | 支持长达九行的问题、主题侧边条导致的折行横线，以及不同小宽度的 gutter。多选指针停在 Type something 时保留卡片，点选答案先离开文本字段、回读确认，再发数字。向导 review 也能穿过 `│` 装饰读出每个答案。[PR #480](https://github.com/AltanS/collie/pull/480)、[#484](https://github.com/AltanS/collie/pull/484)、[#488](https://github.com/AltanS/collie/pull/488) |
| pi 权限卡片 | permission-gate 示例的缩进命令不再被误当成首个答案；卡片显示问题、Yes／No／Cancel，移动指针并确认后再提交。[修复](https://github.com/AltanS/collie/commit/03da3b2d) |
| Claude Heads up／You should know | 输入框上方的提示作为带操作的卡片，不作为阻塞弹窗；普通消息可发送，提示列出的数字由原生提示接收，不额外 Enter。卡片绑定当前空输入框／上下文，非空草稿、Replace、运行中提交及重叠弹窗保留保护；只显示实际可用按钮。右对齐 usage 不再遮蔽提示。[PR #486](https://github.com/AltanS/collie/pull/486)、[数字保护](https://github.com/AltanS/collie/commit/33091505)、[usage](https://github.com/AltanS/collie/commit/01e35819) |
| Claude 运行状态 | spinner 省略号与计时之间出现 `· tool use` 等词时仍识别为运行中。[PR #489](https://github.com/AltanS/collie/pull/489) |
| Shell／无配置 agent 发送 | 恢复一次点击写入文本并 Enter，回执说明 `no-profile`；不走探针和输入框确认，也不排队。仍先只读检查密码提示，命中则不写入任何内容；多行输入仍拒绝。已有 profile 的 agent 继续使用受保护协议。[恢复发送](https://github.com/AltanS/collie/commit/a70c319b)、[密码保护](https://github.com/AltanS/collie/commit/03185fd5) |
| 输入框提示 | 恢复 Type a reply／Type a shell command 等普通占位文字；窗口消失、设备只读、终端不可输入、直接输入模式仍显示相应说明。通知、Screen 和实际状态判断继续保留。[修复](https://github.com/AltanS/collie/commit/d3c647fb) |
| Chat 历史 | 顶部固定问题为 Load older 留出空间，新设备空缓存也可点击加载更早历史。[修复](https://github.com/AltanS/collie/commit/fe60adeb) |
| macOS／Windows 版本读取 | macOS 从登录 shell PATH 查找 agent，再回退 bridge PATH，并缓存 PATH 读取；避免 launchd 环境找不到版本、误判 provisional 并延迟发送。Windows 优先 PATHEXT 的 `.cmd` shim。[PR #483](https://github.com/AltanS/collie/pull/483)、[后续兼容](https://github.com/AltanS/collie/commit/73ae313d) |
| 生产构建 | Web 构建显式设置生产 NODE_ENV，避免继承开发环境导致 chunk 超过 PWA precache 限制、更新构建失败。[PR #482](https://github.com/AltanS/collie/pull/482) |
| HTTP phone lab | scratch bridge 使用设备 token 经 HTTP 发请求，结合回执与 Surface 判定空闲、流式中、结束时发送，以及命令、权限、agents 界面。支持 `--leg phone` 和指定 bridge／token 文件；首个 Shell 点击必须有效，移除的命令不发送；没有独立 agents 界面的版本报告未到达。补充 Windows 主机边界测试。[实现](https://github.com/AltanS/collie/commit/029d3ce2)、[首击与移除命令](https://github.com/AltanS/collie/commit/dc4e9abd) |
| 真实浏览器 lab | 新增独立 Herdr／bridge／Claude／pi／OMP 的十五场景，覆盖模型、授权、问题、运行中发送与空缓存历史，每次操作记录回执和截图。准备失败不耗模型调用；模型凭据从独立 key 文件读取。nightly runner 按提交与 CLI 版本组合去重，检查登录剩余时间、可用内存和工具，不能启动时只写提示。[浏览器 rig](https://github.com/AltanS/collie/commit/798c19f0)、[nightly](https://github.com/AltanS/collie/commit/b228efb1) |
| 测试与维护 | 上游将能由逻辑／组件覆盖的重复浏览器测试迁出 Tier 1，新增各路由、向导、菜单和 Surface 回归；补充真实 ANSI、区域标注及变异测试；测试不再假定固定操作系统。lint hook 使用被编辑文件所在 checkout。[测试整理](https://github.com/AltanS/collie/commit/d41faec9)、[PR #487](https://github.com/AltanS/collie/pull/487) |
| 文档与打包 | 新增 ADR 0109：上方提示不是 modal；更新 pi／OMP 提问边界、multiplexer 和 lab 文档、发布验证要求。AUR／Nix 包源实际跟进 1.22.4，保留正式标签所带值；同步版本与 CHANGELOG。[打包](https://github.com/AltanS/collie/commit/caabf82c) |

## 本次 Codex `/model` 补充修复

截图对应 Codex 0.163.0。原请求在 S1 返回 `typed_not_submitted / changed`，没有按过 Enter；上次 1.22.4 只登记了 Claude 的自身命令列表，Codex 的补全列表仍缺少配置。

在 Codex profile 增加输入框上方列表的指针、条目和折行规则，直接复用上游通用 exact-selection／scroll 校验，没有增加发送重试或独立协议分支。覆盖 `/model` 及同形态、完全选中的其他命令；选中其他命令、正文受检查区域变化仍留下草稿。已有排队／引导语义不变。

真实 Codex 隔离会话返回 `sent`、`keys: ["Enter"]`，并打开原生模型菜单。此前版本在普通隔离场景也能成功，因此**没有声称精确复现原会话那次失败**；新增四行折行／滚动合成回归证明：缺少配置时失败，补齐后通过。真实样本保留原生 ANSI，正文只有测试模型生成的整数，不包含私人对话。完整边界见 [SEND_NOTES](../web/src/lib/harness/codex/SEND_NOTES.md#own-command-list--2026-10-18)。测试窗格均已关闭。

## 下游取舍

本次没有以新上游功能替换独立的下游实现。发送协议、占位文字采用上游本次修复，兼容直接输入模式优先级；其余既有定制继续保留：

- 输入按钮展开一排按键、缓存并恢复原草稿与附件；不恢复独立 Keys 操作带按钮。
- Codex 排队／立即引导偏好、单次引导、队尾消息受保护引导，模型／模式切换互斥；本地 Resume、Model、Agents、Plan、Review、权限卡片、警告数量、`/resume` 滚动和图片占位符校验。
- Claude 固定高度可滚动 Settings、Agents 卡片与中文问号识别；Hermes 中文／忙碌输入、历史、操作提示，Cursor 历史；紧凑字体与布局、PWA 视口和 tab 图标。
- 按样本键合并区域标注，保留 Claude Config 的 bounded Settings 语义及下游 ANSI 行连接。目录中旧 OMP E2E 引用改为上游的新 rig 对应文件；Codex 模型 E2E 改用现有 `/api/send`。
- GitHub Actions 保持禁用，不创建 GitHub Release。新增 lab 工具可以手动使用，未启用定时任务；本分支明确保留经济型验证约定，十五场景模型测试不成为每次小改动的强制门槛。

## 验证与交付

- 后端发送协议、版本查找、路由、绑定与构建工具通过；新增 Codex 滚动正反例通过。相关 lab、目录引用与样本回放通过。
- Claude／pi／OMP 解析及共享 conformance、Surface、菜单／多选、输入区、ANSI／Chat 的定向逻辑与组件测试通过。历史样本回放不表示所有 CLI 已重新实测。
- Chromium／WebKit 手机尺寸检查输入按键区、草稿恢复、Codex 模型入口与切换保护；截图保存在本轮 Playwright 输出目录。根目录／Web 类型检查、lint、正式构建与版本一致性检查通过。
- 交付代码与 annotated tag，部署本机 Herdr 管理的运行 checkout，只重启 Collie。按当前约定从 localhost 核对构建、配置、快照、Files、更新说明和健康；撤销临时验证设备，保留一个完整回滚包。
- 未运行十五场景的完整模型 browser rig、Windows VM 或多机 Crew；未验证 iPhone 真机键盘。公网域名有 OAuth proxy，按用户要求仅验本机。
