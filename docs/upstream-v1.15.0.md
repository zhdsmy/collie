# 上游 v1.15.0 合并报告

从下游 `v1.14.2+collie.18` 与经济型验证约定提交 `63998eac`，跟进上游 `v1.15.0`，下游版本为 `v1.15.0+collie.1`。

核对来源：[Release](https://github.com/AltanS/collie/releases/tag/v1.15.0)、[CHANGELOG](https://github.com/AltanS/collie/blob/v1.15.0/CHANGELOG.md)、[v1.14.2…v1.15.0 完整差异](https://github.com/AltanS/collie/compare/v1.14.2...v1.15.0)。范围共 81 个提交、257 个文件，增加 23,114 行、删除 1,637 行。标签包含版本提交之后的 `ef01b0ed`，并非止于 `8d8536cd`。

## Chat 与会话记录

- **新增实验性 Chat 阅读模式。** 在 Settings → Experiments 开启后，可在窗格菜单或 Display 中切换 Terminal / Chat。选择按设备保存；Terminal 仍为默认。没有可读会话的窗格继续显示终端并说明原因，旧版 crew 成员会提示升级。[#316](https://github.com/AltanS/collie/commit/2e46ea22)
- **Chat 使用原始会话记录。** 展示用户提问、助手回复、折叠思考和工具步骤；命令带输出，编辑带 diff，连续步骤可折叠。保留现有输入区、操作带和窗格菜单。加载更早记录时保持阅读位置，按 UUID 更新已有回合，避免重复插入。[会话卡片](https://github.com/AltanS/collie/commit/c126f4fa)、[客户端增量读取](https://github.com/AltanS/collie/commit/a2231ee1)、[阅读位置](https://github.com/AltanS/collie/commit/1712ec61)
- **工作中和排队消息可见。** 压缩等暂时没有新记录的阶段继续显示工作标记；忙碌时提交的消息显示在队列中，直到 agent 接手。[工作状态](https://github.com/AltanS/collie/commit/43827305)、[排队消息](https://github.com/AltanS/collie/commit/c906c453)
- **History 与 Chat 默认折叠工具调用。** 每轮保留步骤计数，可临时展开，也可在 Appearance → Tool calls 长期开启。搜索命中工具输出时会显示命中内容；运行中的工具不再强行覆盖用户的折叠选择。[默认行为](https://github.com/AltanS/collie/commit/b36b7c55)、[运行中修复](https://github.com/AltanS/collie/commit/6563ed77)
- **六种上游 reader 提供结构化工具结果。** Claude、Codex、OpenCode、pi、Grok、Hermes 按记录实际内容提供命令退出码、读取范围、搜索结果数、修改路径和 diff；拒绝操作与执行错误分开。缺失字段不猜测。Codex `custom_tool_call`、Claude 粘贴图片、OpenCode patch 和附件不再遗漏。[结构化调用](https://github.com/AltanS/collie/commit/d5faea94)、[所有 reader](https://github.com/AltanS/collie/commit/0a143094)、[工具与图片补全](https://github.com/AltanS/collie/commit/38a93df6)
- **长会话改为有界增量读取。** JSONL 按字节、数据库按记录时钟或行号读取；逐行 reducer 能更新先前工具调用所属回合。首次读取有界尾部，半行留到换行完整后处理，截断或换文件明确重置。bridge 每会话保留约 2 MiB 尾部，沿用既有轮询，未变化不传正文，更早记录按需读取。[逐行归并](https://github.com/AltanS/collie/commit/a417a46d)、[存储游标](https://github.com/AltanS/collie/commit/7953e9c8)、[实时窗口](https://github.com/AltanS/collie/commit/c75ced6e)
- **pi 历史更完整。** 失败和中断回合保留说明；按当前分支读取，避免混入已经放弃的路径；显示压缩、分支摘要、扩展消息和桌面 `!command`。[pi 修复](https://github.com/AltanS/collie/commit/d2a0dec4)

## 手机界面与操作

- **Settings 改为分类入口。** 常规设置分成 Appearance、Device、Alerts、System；当前另有 Experiments。Theme 卡片使用明确名称，配对二维码直接进入 System，返回键回到设置索引。字体、语言、操作带设置仍可使用。[分组](https://github.com/AltanS/collie/commit/7527b53e)、[配对入口](https://github.com/AltanS/collie/commit/c31e155d)
- **Display 改成底部弹层。** 打开设置不再压缩正文。Terminal 显示终端相关控制；Chat 显示独立文字大小和工具调用设置。两个模式的字号分别保存。[对应当前模式](https://github.com/AltanS/collie/commit/299fc465)、[弹层](https://github.com/AltanS/collie/commit/71c096dc)
- **窗格切换器增加 Activity 和 Cache 排序。** 与原来的 Place 排序并存；活动顺序同时考虑 agent 最近活动和用户最近访问，缓存顺序优先临近变冷的窗格。打开列表时固定顺序，避免点击过程中行移动；提示与排序按钮合并为一行。[Activity](https://github.com/AltanS/collie/commit/cf10b860)、[Cache 与紧凑头部](https://github.com/AltanS/collie/commit/f0e5856f)
- **可复制终端内容。** 镜像区恢复长按选取，窗格菜单可一键复制当前所见输出，移除手机布局造成的折行。无输出或无剪贴板写入能力时隐藏菜单项。[#287](https://github.com/AltanS/collie/commit/d5057d23)
- **正文排版改进。** 裸 HTTP/HTTPS/mailto 地址可点击，行内代码使用蓝色标记，用户回合使用橙色背景。列表和引用统一行高；短参数、分支名、链接和代码不从中间断开，超长内容仍允许换行。[链接与配色](https://github.com/AltanS/collie/commit/8ab22bcc)、[行高](https://github.com/AltanS/collie/commit/30f2ac31)、[断行](https://github.com/AltanS/collie/commit/37161551)
- **宽终端内容可横向浏览。** 两栏框不再截掉右半边，包括 Claude workflow、omp 模型选择和欢迎提示。Changes 长文件名保留首尾。[两栏框](https://github.com/AltanS/collie/commit/8c811438)、[文件名](https://github.com/AltanS/collie/commit/fe7015b0)
- **启动标志统一。** 首屏使用 Collie 标志替换旧奔跑精灵；正在观看的 shell 切换为 agent 时显示一次交接动画，可点击结束并遵从减少动态效果设置。打开原本就是 agent 的窗格不播放。[首屏](https://github.com/AltanS/collie/commit/2dd6ca80)、[agent 交接](https://github.com/AltanS/collie/commit/36063545)

## 适配、通知与兼容性

- **Codex `/goal` 状态栏恢复正常输入。** 识别右侧 `Pursuing goal` 前带颜色的空白，避免误判为未知对话框并拒绝发送。[#317](https://github.com/AltanS/collie/commit/ed647185)
- **OpenCode 边框不再被当作输入草稿。** 同时检查连接／转角字符与整行是否纯装饰，保留真实输入中的横线、树形文本；统一边框字符集合。[#319](https://github.com/AltanS/collie/commit/ed705820)、[补充修复](https://github.com/AltanS/collie/commit/46050980)
- **发送等待完整回显尾部。** 单段发送也验证末尾，修复 Muse 文字已输入却一直不提交的问题。本次合并同时保留 Codex 图片占位符、长文本滚动可见尾部的校验。[#312](https://github.com/AltanS/collie/commit/1791674b)
- **通知标题跟随设备语言。** bridge 传递标题代码，页面缓存翻译模板，service worker 在后台选择语言，缺失时回退英语。通知正文仍使用原文。中／繁中／德／日／韩统一“缓存变冷”含义，德／西完成通知与状态标签一致。[#310](https://github.com/AltanS/collie/commit/ffd600cb)、[中文](https://github.com/AltanS/collie/commit/1f46ffcf)、[其他语言](https://github.com/AltanS/collie/commit/89724bc5)
- **非 ASCII 设备名称可访问 crew 成员。** 转发名称经过百分号编码，再在成员端还原，保留访问控制和审计语义。[#324](https://github.com/AltanS/collie/commit/06374508)
- **macOS 服务发现兼容 Home Manager。** 同时检查 launchd 的 GUI 和 user 域，报告实际服务目标；两边都有注册时均可见。[#314](https://github.com/AltanS/collie/commit/623401a6)
- **新增实验性 tuios 后端。** `COLLIE_MUX=tuios` 将 sessions/workspaces/windows 映射为空间/tab/pane，经 daemon socket 工作；要求 tuios ≥ 0.8.3。0.8.2 缺少所需能力。mux 合约统一 agent 名称并要求适配器转换别名，静默变化检查不再只假设 tab 重命名。现有 Herdr 部署无需切换后端。[#321/#322](https://github.com/AltanS/collie/commit/c1928e3d)、[名称合约](https://github.com/AltanS/collie/commit/db0f9954)、[版本要求](https://github.com/AltanS/collie/commit/60df2b20)

## 验证、打包与文档

- **Canary 新增 journal 检查。** 只读取隔离会话自身记录，验证用户提问、实际文件读取和回复，统计未知记录／内容类型；报告保留计数和种类，不复制原始会话文件。屏幕 reader 与 journal reader 的版本证据分别记录，drift 命令分别报告。[journal 检查](https://github.com/AltanS/collie/commit/160d2fab)
- **Canary 触发更可靠。** pi 不再使用 `--no-session`；文件读取场景要求回复文件中的 token；允许每条消息指定预期回复；Codex 启动禁用更新弹窗，避免误操作更新。完整默认流程比以前多一个模型回合；本地经济型卡片探测继续显式限定场景，不随升级扩大日常验证。[pi](https://github.com/AltanS/collie/commit/71cbe684)、[token](https://github.com/AltanS/collie/commit/d0411bef)、[Codex 启动](https://github.com/AltanS/collie/commit/9dd96df0)
- **上游更新验证账本。** 记录 Claude 2.1.285、OpenCode 1.18.33、pi 0.87.1、Codex 0.159.2 的屏幕／journal 证据。这些是上游验证记录，本次合并不将其冒充本机重新调用模型的结果。[前三者](https://github.com/AltanS/collie/commit/926a03e4)、[Codex](https://github.com/AltanS/collie/commit/3bbd7863)
- **测试日常路径提速。** 慢的 crew 双实例 TLS 集成测试移至 `integration/`，用 `bun run test:crew` 按需运行；前端 Vitest 分成纯解析 logic 与 DOM 两组。测试 setup/MSW 拆分，两个发送测试迁移目录，修正测试隔离及 audit 发现的问题；pre-commit 对测试支撑文件免记功能 CHANGELOG。上游新增的 CI 独立 lane 按 fork 既定策略不启用。[测试调整](https://github.com/AltanS/collie/commit/b6babb05)
- **发布说明修复换行贡献者遗漏。** 标签内最后一个提交把多行 CHANGELOG bullet 整体解析，恢复贡献者署名；下游版本号的 `+collie.N` 转义继续保留。[标签尾提交](https://github.com/AltanS/collie/commit/ef01b0ed)
- **打包元数据跟进 1.14.2。** AUR 与 Nix 下载来源按上游标签内实际内容保留为 1.14.2；本机使用下游标签源码构建。[#315](https://github.com/AltanS/collie/commit/7e3d09fd)
- **文档扩充。** 安装页按系统与手机平台重新组织，新增五分钟安装指南和 Changes 独立页面，CLI 内置两篇新文档；更新所有 Settings 路径、配对入口、`collie logs` 含义、mux/tuios 支持矩阵及探测证据、crew protocol 示例。README 明确 ColliePWA 名称与 Changes 功能。[安装指南](https://github.com/AltanS/collie/commit/9243abd2)、[Changes](https://github.com/AltanS/collie/commit/1948ef6b)、[设置路径](https://github.com/AltanS/collie/commit/95bf1b74)
- **品牌与维护规则。** 新增商标使用说明，明确没有官方应用商店版本、兼容工具可按规则使用名称；增加 Activity 排序、两栏横向浏览、实时会话窗口及通知标题翻译 ADR；上游规则明确纯文档／测试／chore 不应单独触发产品发版。[商标](https://github.com/AltanS/collie/commit/53a57f63)、[兼容工具说明](https://github.com/AltanS/collie/commit/8d7497e6)

## 本次下游取舍

用户明确选择采用上游两处布局，并保留现有定制设置：

| 被替代的下游实现 | 采用后的行为 | 用户可见差异 |
| --- | --- | --- |
| Settings 单页平铺设置 | 上游分类索引及分组页面 | 查找设置所需滚动更少；字体、操作带大小等仍在 Appearance |
| Composer 内联 Display dock | AgentChat 管理的底部弹层 | 打开 Display 不挤动正文，并按 Terminal / Chat 显示有效控制 |

保留紧凑同底操作带、合并后的 Type 操作、快捷操作 dock、16px tab agent 图标、Geist Mono 字体与本地 PWA 图标；保留 Codex 模型／Resume／Agents／警告数量与发送保护、Claude Agents／固定 Settings 卡片、Hermes 历史／状态栏／问答及 Cursor 历史适配。上游没有完整替代这些用户目标。

Cursor 继续接入新的增量 journal 合约，并补齐 mux agent 名单；Hermes 保留本地 session model，同时接入上游工具结果与增量读取。Cursor journal 标为未做当前版本 live 验证，不因类型检查通过就更新认证。卡片清单、真实捕获、截图入口和经济型验证规则继续保留；不安装小时任务，不追求待验证计数清零。

fork 保持只推送 main 与 annotated tag，不创建 GitHub Release，不恢复 `.github/workflows/`。部署仅重启 Collie；Headroom 与 Herdr 主服务不参与升级。

## 本机验证

合并冲突、类型检查、lint、bridge/journal/CLI/canary 相关测试，以及前端组件和解析器回归均按实际修改范围检查；失败项修复后定向重跑。手机宽度界面验证覆盖 Settings 分类、Display 弹层与现有操作带，9 项浏览器用例通过；截图保存于本机 `~/.local/state/collie/harness-health/upstream-v1.15.0/`。截图来自合并工作树，页脚仍显示发布前版本，正式版本以部署后的 build-info 为准。

crew 双实例集成测试 63 项通过，CLI 启停脚本的隔离检查通过。只读 journal probe 成功解析本机 Claude、Codex 日志；其余五种来源未找到可供该探针读取的样本，这不等于当前版本已认证。本次不重新运行整套模型驱动 canary，不把样本回放当成新版 CLI 的完整认证；未验证已安装 iOS PWA 的实际行为。
