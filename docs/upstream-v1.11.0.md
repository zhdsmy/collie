# 上游 v1.11.0 合并报告

本次从 `v1.10.2+collie.2` 跟进到 `v1.11.0+collie.1`，保留已确认的下游交互，并组合 Codex 动画输入区实现。

## 基线与范围

已对照上游 Release、CHANGELOG、提交历史和最终 tag-to-tag diff。

- 下游起点：`04827d13`；刷新 origin/main 后两者一致，工作区干净。
- 上游起点：`upstream/v1.10.2`；目标：`upstream/v1.11.0`（`e4846880`），祖先关系已确认。
- 上游净变化：141 个文件，新增 8,463 行、删除 349 行。新增 Muse 适配、样本和测试占较大部分。
- [正式 Release](https://github.com/AltanS/collie/releases/tag/v1.11.0) · [完整比较](https://github.com/AltanS/collie/compare/v1.10.2...v1.11.0) · [上游 CHANGELOG](https://github.com/AltanS/collie/blob/v1.11.0/CHANGELOG.md#1110---2026-09-20)

## 上游完整变化

以下包含发布说明列出的全部功能和修复，以及实际 diff 中的协议、文档、测试和打包变化。

### Agent 与终端显示

| 项目 | 变化与实际效果 |
| --- | --- |
| 窗格切换器缓存时间 | 每个窗格行展示缓存温度与剩余时间，不离开切换面板就能区分 warm、expiring、cold。与仪表盘复用同一缓存读数。 |
| Muse 支持 | 新增专用适配器：输入区和 statusline 提取、草稿识别与发送验证，以及命令审批、单选、多选、答案复核和目录信任界面。命令、问题或目录等核心对象保留在选项上方。 |
| Muse 交互边界 | 只提升当前可操作对话；历史引用、存在未发送草稿或备注输入获得键盘焦点时保留原生终端。用 18 份脱敏原始样本记录空闲、工作、草稿、粘贴及各类对话。 |
| 多选公共层 | 显式区分 Claude 的数字直接切换与 Muse 的数字移动焦点、Enter 确认；复核、提交与取消通过重新读取焦点和对话身份校验后操作。共享模型和组件不决定哪些 Agent 启用卡片。 |
| Claude 后台 Agent | 原来随输入区剥离、却没有展示位置的 `● main` 和后台任务列表，恢复到固定 statusline 下方。默认一行显示首个任务及其余数量，点击展开；没有列表时隐藏。 |
| Codex Astra 星点 | 上游改为按状态行与提示符定位输入区，越过星点和空白行；清理动画造成的假草稿，同时把提示符上方的星点行一起移出正文。下游对此采用下节说明的组合方案。 |
| 原始终端开关 | `grammars: false` 禁用适配器解析，但仍按真实 Agent 选择原生 mirror 的展示处理，避免把“停用卡片”与“丢失 Agent 展示身份”混为一件事。 |

关联提交：[20d2bada](https://github.com/AltanS/collie/commit/20d2bada)；
Muse [#244](https://github.com/AltanS/collie/pull/244)、[d634d025](https://github.com/AltanS/collie/commit/d634d025)、
[c99a863d](https://github.com/AltanS/collie/commit/c99a863d)、[c7e5c8e8](https://github.com/AltanS/collie/commit/c7e5c8e8)；
Claude [#242](https://github.com/AltanS/collie/issues/242)、[588f4694](https://github.com/AltanS/collie/commit/588f4694)；
Codex [#245](https://github.com/AltanS/collie/issues/245)、[12e168cd](https://github.com/AltanS/collie/commit/12e168cd)。

### 缓存与历史会话

| 项目 | 变化与实际效果 |
| --- | --- |
| 动作导致缓存变冷 | Claude 切换模型、调整 effort、压缩或执行 `/reload-plugins --force` 后，缓存标记立即变 cold，原 TTL 时钟继续运行。普通 `/reload-plugins` 明确不重置缓存。 |
| OpenCode 缓存重置 | 通过结构化日志/数据库字段识别模型切换与压缩，避免根据正文猜测。Codex 尚无同等动作检测，规则明确标记缺口，不能理解为新增了 Codex 重置探测。 |
| 缓存解释与通知 | Cache sheet 显示导致重置、或可能造成上一轮未命中的动作；规则带来源和置信说明，doctor 的 cache claim 检查一并扩展。已经变冷的窗格不再触发缓存到期提醒。 |
| Claude 会话交接 | 读取日志尾部的 `continued-in`，即使 Herdr 仍上报旧 session ID，History 与缓存也跟到活动日志。最多追踪 8 跳、检查循环，并限制在原 projects root 内。旧日志重新写入 assistant turn 后，不再沿旧交接跳转。 |

缓存重置复用有界日志尾读与文件时间戳缓存；不增加新的远端请求。
pane cache wire 添加可选 `coldReason`、`reset` 字段，旧 peer 缺失这些字段仍兼容。

关联 [#236](https://github.com/AltanS/collie/issues/236)、
[da555bc8](https://github.com/AltanS/collie/commit/da555bc8)、
[1e9d1a36](https://github.com/AltanS/collie/commit/1e9d1a36)。

### 多主机更新与 CLI

| 项目 | 变化与实际效果 |
| --- | --- |
| 仅更新成员的进度屏 | 发起更新的手机展示完整进度屏，背景操作暂时阻止；lead 显示已经是最新版本且不重启，结束时说明成员更新结果。失败保留具体原因；三分钟无进展提供离开等待界面的入口。其他设备只显示状态标记。 |
| 已完成更新的按钮消失 | 成员版本等于或高于 lead 时不再被算作落后；失败成员自行升级后，旧失败记录也不再使“更新/重试 crew”常驻。未知版本保留未解决失败，但不会被当成已知落后。 |
| 包管理器成员边界 | packaged 成员无论在线还是休眠都不应触发手机更新。若旧页面请求更新这类落后成员，返回专门拒绝并点名成员，而非误报“没有新版本”。 |
| 失败更新可关闭 | 更新失败后，进度屏关闭按钮真正关闭本设备的浮层；以后新的失败仍可显示。 |
| 无 Git commit 的 lead | install.sh 二进制 lead 或 packaged lead 执行不支持的 crew 操作时，提前解释限制与人工安装/更新路径。`crew add` 在第一次 SSH 连接前拒绝，不再完成远端探测后才报“不是 checkout”；保留 fork 的更新仓库配置。 |
| doctor 自查身份 | 本机诊断请求带上已配置的 `COLLIE_TRUSTED_USER` 身份。区分成功、HTTP 拒绝与无响应：403 会说明服务在运行但拒绝身份，不再误报停机。bridge 的身份检查仍 fail-closed，没有新增 loopback 放行。 |

前后端统一成员是否需要更新的规则，以契约测试防止两端漂移。
更新状态新增可选 `peersTo` 目标版本；协议按 additive-optional 记录，不提升 crew 协议版本。

关联 [5f5c44c9](https://github.com/AltanS/collie/commit/5f5c44c9)、
[4f4f3be5](https://github.com/AltanS/collie/commit/4f4f3be5)、
[24f3d37c](https://github.com/AltanS/collie/commit/24f3d37c)、
[78d581bb](https://github.com/AltanS/collie/commit/78d581bb)；
[#248](https://github.com/AltanS/collie/issues/248)、[ad3171bf](https://github.com/AltanS/collie/commit/ad3171bf)；
[#238](https://github.com/AltanS/collie/issues/238)、[a94d41a0](https://github.com/AltanS/collie/commit/a94d41a0)、
[1ae0dde2](https://github.com/AltanS/collie/commit/1ae0dde2)。

### 文档、测试与发布工具

- 适配规范明确：手机解析自己显示的 pane，bridge 仅解析其独立工作必需的信息；新增屏幕提取优先走 `HarnessAdapter`，不为减少客户端扫描随意扩充 snapshot。
- ADR 写作要求先写出真实争议来源；更新现有更新界面决策记录，新增 Muse 原生展示记录与详细按键验证说明。
- 配置、语音/通知文档补充缓存重置语义；crew 和升级文档补充无 Git lead 的限制、仅成员更新的屏幕行为。
- 所有 UI 字典同步新增更新屏幕等文案；增加 cache、journal、crew、doctor、Muse、共享多选和更新屏幕的单元/契约/浏览器测试。
- Mac 安装文档明确：发布二进制仅支持 Apple Silicon，最低 macOS 13。Intel Mac 继续从源码构建。
- PR #239 的 Intel Mac 二进制支持曾进入 RC，但在正式版前已回退；最终版没有该能力，也没有因此留下新的发布目标。不能把中间提交当作正式变化。
- AUR 和 Nix 的发布产物清单在此 tag 内更新到 **1.10.2**，尚未列出 1.11.0 的归档校验和；原样保留上游，不凭空重写。依赖锁文件和本地构建工具没有变化。
- 上游经过 `1.11.0-rc.1` 后发布 `1.11.0`；下游沿用自己的版本后缀，不发布 RC 或 GitHub Release。

关联 [b626fa9c](https://github.com/AltanS/collie/commit/b626fa9c)、
[2d759d38](https://github.com/AltanS/collie/commit/2d759d38)、
[#239](https://github.com/AltanS/collie/pull/239)、
[c7fc5e79](https://github.com/AltanS/collie/commit/c7fc5e79)、
[e637620f](https://github.com/AltanS/collie/commit/e637620f)、
[e4846880](https://github.com/AltanS/collie/commit/e4846880)。

## 下游取舍

本次没有整项本地功能被上游替换；Codex 输入区清理吸收上游实现，其余新增能力直接跟进。

| 功能 | 合并结果及用户可见差异 |
| --- | --- |
| Codex 动画输入区 | 用户明确选择组合。保留完整背景/提示符证明、前后端统一星点归一化与逐字绑定；吸收上游 `bandTop` 裁剪，并允许在有界输入区内跨越多行已归一化的星点空白。减少上方残留，不采用“发现动画即取消绑定”的行为。 |
| Codex 发送能力 | 保留工作中 queue/context footer、自定义或禁用 statusline、空段落、图片及混排证据、精确斜杠命令补全后 Enter。纯粹未着色或结构不完整的星点外观不作为发送许可。 |
| Claude chrome | 采用上游后台 Agent 提取与展示；保留已确认 statusline 内精确 `esc to interrupt` 例外、右侧原生提示兼容及覆盖完整尾部的输入绑定。未知尾部和同一行其他菜单提示仍阻止发送。 |
| Codex 卡片范围 | QA、Plan、review、目录信任保持原生。模型/思考等级、statusline 配置、resume 和命令审批卡片保留；Muse 新卡片不会改变 Codex 注册范围。 |
| 既有下游展示 | 保留 Composer 按键合并输入、不自动弹键盘、底部安全区；矩形输入/diff 背景；紧凑 statusline、context 圆环、模型切换与近期列表；Claude/Cursor/Hermes 专用展示及状态条防闪断。 |
| 交付方式 | 主干和精确注释版本标签推送；不恢复 GitHub Actions，不创建 GitHub Release。仅部署并重启 Collie，不操作 Herdr 或 Headroom 服务。 |

机械冲突为版本/CHANGELOG 合并、Agent 注册和 import、Claude 新提取函数与本地函数并列，以及样本说明追加。
Codex 上游合成测试补齐真实输入区背景和加粗提示符；绑定预期按用户选择保持启用，原始 ANSI 样本未改写。

## 验证记录

验证集中在本次变更与发送契约，没有运行全仓库测试或操纵现有会话。

- 后端：17 个受影响测试文件通过，覆盖 cache、journal、crew 契约/跟随/更新、server 与相关 CLI；另跑 `bridge/prompt-binding.test.ts`，67 项通过。
- 前端：受影响模块及 Codex/Claude/Muse 兼容、发送、图片与模型切换路径；50 个文件最终全部通过，共 3,854 项通过、12 项既有 todo。最后仅重跑修正了新增 `top` 字段预期的 statusline 文件，20 项通过。
- 根目录和 web TypeScript 检查、全树 lint 均通过。
- 根目录正式 `bun run build` 通过，覆盖 bridge/CLI 和前端；发布标签确定后再重建版本戳用于部署。
- 浏览器定向验证更新进度屏、Claude 模式切换、Codex 动画与分段输入：Chromium/WebKit 合计 23 项通过，3 项按上游的项目范围规则跳过。
- WebKit 首轮有 6 个模拟 API 用例失败：激活的 service worker 绕过 `page.route`，重载后读到旧 pane 或发生请求失败。仅在 `codex-particles.spec.ts` 使用与现有 Claude 模式测试相同的 `serviceWorkers: "block"` 后，这 6 项全部通过。专门验证 service worker 的更新屏幕测试继续使用真实 worker，不改变生产代码。
- 本机安装起点 `9ba1d342` / `1.10.2+collie.2` 已回读为运行中且 tracked 文件干净。部署使用备份、原子替换产物及失败回滚，保留旧 hash 资源；交付时核对进程、监听端口、本地和 Tailnet 的构建 ID 与 API。
