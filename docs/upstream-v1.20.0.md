# 跟进上游 v1.20.0

本次从 `1.19.2+collie.5` 跟进至 `1.20.0+collie.1`。已交叉核对
[官方发布说明](https://github.com/AltanS/collie/releases/tag/v1.20.0)、
[CHANGELOG](https://github.com/AltanS/collie/blob/v1.20.0/CHANGELOG.md#1200---2026-10-11) 和
[完整标签差异](https://github.com/AltanS/collie/compare/v1.19.2...v1.20.0)。
上游标签指向 `6c0c856b`，共改动 231 个文件；包含版本提交之后的测试修正。

## 上游变化

本版重点是本地语音识别、Voice 设置和听写界面，另有发送、历史、更新和安装修复。

| 范围 | 变化和用户影响 | 依据 |
| --- | --- | --- |
| 主机 Whistle | Settings → Voice 可下载 Cactus Compute 的 16.9 MB 模型，再选择主机 Whistle。模型来自固定地址并校验哈希；识别使用短时本地子进程，无需密钥，音频不离开主机。支持最长四分钟的 16 kHz WAV。跨进程避免重复下载，同时最多向两台手机传输模型。 | [d852cd63](https://github.com/AltanS/collie/commit/d852cd63) |
| 手机 Whistle | 每台设备可选手机或主机识别。模型从自己的 Collie 主机复制到浏览器，校验后可离线运行；手机识别不上传音频。失败时说明原因，只有手动选择才转交主机；连续两次引擎崩溃后暂停手机识别，重载可恢复。解除配对会清理模型。 | [246b425b](https://github.com/AltanS/collie/commit/246b425b)、[a2c1502b](https://github.com/AltanS/collie/commit/a2c1502b)、[2fe488fa](https://github.com/AltanS/collie/commit/2fe488fa) |
| 主机语音切换 | Voice 展示 Whistle、Codex、兼容 OpenAI 的服务、本地命令或关闭状态。可写设备可切换 Whistle／Codex／关闭；Codex 需主机已登录 ChatGPT，并在用户接受告知后探测。通过密钥、命令或环境变量配置的服务只展示，不由网页覆盖。 | [4cfa3952](https://github.com/AltanS/collie/commit/4cfa3952)、[ADR 0097](../.adr/0097-codex-speech-can-be-chosen-from-settings.md) |
| 语音配置说明 | 记录最近修改主机语音的设备和时间。设置卡显示具体模型、命令文件名或服务主机名，不返回密钥、完整路径、命令参数或 URL 路径。 | [e461eccd](https://github.com/AltanS/collie/commit/e461eccd)、[b690b3aa](https://github.com/AltanS/collie/commit/b690b3aa) |
| 独立 Voice 页面 | Voice 从 Device 移至独立分组，包含当前方案、音频去向、可用性和配置人。手机设置按钮串联主机下载、手机复制和启用；另有 Host speech 与 Whistle model 子页、可复制的操作步骤。旧 Whistle 命令包装器可手动切换内置引擎。只读设备保留自己的手机选项。 | [335d6019](https://github.com/AltanS/collie/commit/335d6019)、[6559261d](https://github.com/AltanS/collie/commit/6559261d) |
| 语音 CLI | 新增 `collie stt whistle`、`--host`、`--from`、`--remove`；现有模型文件也须校验。`stt status` 展示模型，关闭语音保留模型，doctor 检查模型是否受当前版本支持。 | [1c9f4953](https://github.com/AltanS/collie/commit/1c9f4953) |
| 听写界面 | 录音覆盖现有输入区域，保持区域高度；提供音量、计时、确认及丢弃，转写中仍可取消。开始说话后静音两秒自动结束，重新说话会重置倒计时；修复转写时正文滚动条闪动。 | [20924e5f](https://github.com/AltanS/collie/commit/20924e5f)、[e33b7f25](https://github.com/AltanS/collie/commit/e33b7f25)、[6a242195](https://github.com/AltanS/collie/commit/6a242195) |
| Chat 分页 | 首次仍加载 40 轮；“加载更早消息”每次从 40 轮增至 100 轮。 | [#364](https://github.com/AltanS/collie/issues/364)、[29d6ae35](https://github.com/AltanS/collie/commit/29d6ae35) |
| opencode 长消息 | 长回复改成一次括号粘贴；识别超过 150 字符或达到三行时出现的原生粘贴占位符，并核对发送前草稿，避免把旧占位符当成本次输入。 | [#408](https://github.com/AltanS/collie/pull/408)、[bb5f5503](https://github.com/AltanS/collie/commit/bb5f5503) |
| Grok 恢复历史 | `/resume` 后依据 Grok 的活动会话纠正 Herdr 遗留的旧 session ID；同进程有多个会话时选最新打开的会话。同目录存在其他 Grok 进程或列表不可信时保留原判断，列表超过 1 MiB 不读取。 | [#405](https://github.com/AltanS/collie/pull/405)、[#407](https://github.com/AltanS/collie/pull/407)、[7b2a50de](https://github.com/AltanS/collie/commit/7b2a50de) |
| 更新恢复 | 首次更新读取失败或缺少预检时，重新打开卡片会重试；网络失败明确显示无法联系 bridge，并提供重试。单次等待 45 秒，卡片打开时按 5、15、30 秒及之后每 60 秒重试，成功后停止。 | [#404](https://github.com/AltanS/collie/issues/404)、[#400](https://github.com/AltanS/collie/issues/400)、[fac2bc6d](https://github.com/AltanS/collie/commit/fac2bc6d) |
| 更新后缺少资源 | 旧页面请求不到新版语言、差异高亮或语音模块时，自动重载一次；一分钟内不重复，草稿或上传阻止重载时继续等待。 | [af8f4f8b](https://github.com/AltanS/collie/commit/af8f4f8b) |
| 配对名称 | 拒绝控制字符、零宽字符、双向覆盖符和行分隔符；CLI 展示历史异常名称时将这些字符显式转义。 | [67d96691](https://github.com/AltanS/collie/commit/67d96691) |
| 弹层高度 | 修复进入 pane 的过渡动画影响底部弹层高度，打开时显示完整面板。 | [#403](https://github.com/AltanS/collie/issues/403)、[a177c0f7](https://github.com/AltanS/collie/commit/a177c0f7) |
| Windows 运行优先级 | 计划任务改为正常优先级，start 写入、restart 更新任务定义。已运行的旧启动器需 stop/start 或下次登录才使用新优先级，减轻内存紧张时被过早换出的情况。 | [#386](https://github.com/AltanS/collie/issues/386)、[70571fa3](https://github.com/AltanS/collie/commit/70571fa3) |
| Intel Mac 安装 | 上游发布 macOS x64 预编译包，支持 macOS 13 及以后；Apple Silicon 上的 Rosetta shell 仍选原生 arm64。Nix／AUR 不新增 Intel Mac 目标。 | [#385](https://github.com/AltanS/collie/issues/385)、[edfd86be](https://github.com/AltanS/collie/commit/edfd86be) |
| 清理和开发诊断 | 删除三个无调用方的旧工作区 worktree 路由，统一使用现有 `/api/worktree`；删除未使用的前端组件、hooks 和奔跑动画资源。dev 构建显示窗口、可视视口和屏幕高度，release 不显示。 | [a592d7ea](https://github.com/AltanS/collie/commit/a592d7ea)、[cf8a35e4](https://github.com/AltanS/collie/commit/cf8a35e4) |
| 安全、文档和工具 | 新增 ADR 0096／0097，更新语音、安全、安装和架构文档。语音 worker 使用独立 CSP，页面不放宽 WASM 权限；校验引擎资源哈希、下载重定向、取消和并发。补全 12 种界面语言、跨平台路径和慢速测试等待修复，更新打包元数据与 Windows 测试跳过预算。 | [ADR 0096](../.adr/0096-speech-can-stay-on-the-phone.md)、[115127c2](https://github.com/AltanS/collie/commit/115127c2)、[6c0c856b](https://github.com/AltanS/collie/commit/6c0c856b) |

## 本地定制的处理

没有用上游替换任何本地独有功能；本次替换的是原有上游录音条，改用新版上游听写覆盖界面。

- 保留紧凑操作带、已采用的上游 Keys 面板，以及统一的快捷／智能体底部面板；没有恢复重复的命令面板。
- 保留字体、折行拼接、显示设置和已实测的 iPhone 安全区。新的录音覆盖层沿用相同输入区底部间距，避免重复预留安全区。
- 保留 Codex、Claude、Hermes 等卡片、历史和 statusline 适配，包括刚修复的 Hermes 简中／繁中操作提示。
- 保留发送租约、取消信号、图片和草稿保护。将上游“最后一段发送前的草稿”更新接入现有基线变量，复用原有流程。
- Grok 采用上游恢复逻辑，继续复用本地与 Cursor 共用的消息提取函数；Codex 会话定位补丁保留。
- 保留停用 GitHub Actions、仅推送代码和注释标签的发布策略。本机只部署 macOS arm64，不创建 GitHub Release，不发布 Intel Mac／Windows 二进制。
- 升级不替换主机现有语音配置，不自动启用 Whistle，也不改变 Hermes、Herdr 或 Headroom 进程。

## 验证和交付

- 前端全套：444 个文件，26,201 项通过，33 项预期失败、73 项待实现。
- 后端：5,581 项通过；CLI：2,024 项通过；脚本：273 项通过。CLI／安装／打包 shell 检查通过。
- 两侧类型检查、lint、正式构建和版本一致性检查通过。
- Chromium／WebKit 语音、设置及 worker CSP 回归：43 项通过，3 项按条件跳过。
- 额外将两处代表界面改为 320px 验证，四个浏览器用例通过，并保存录音和 Voice 设置截图。
  窄屏下长转写文本自然换行会增高输入框，布局测试使用单行文本来单独验证录音界面本身不挤动正文。
- 保留上游 ANSI 样本原始尾部空格；其余合并改动通过 whitespace 检查。

浏览器语音测试使用隔离 API 和模拟音频。未下载真实 Whistle 模型、未验证识别准确率；
两个真实模型浏览器用例未启用，另一个跳过项是 Playwright WebKit 的 Cache Storage 导航限制。
未验证真机 iPhone 麦克风、Windows 运行或 Intel Mac 二进制。本机发布不改变现有语音设置。

发布标签为 `v1.20.0+collie.1`；交付时核对远端 main／标签以及本地和 Tailnet 的实际构建。
截图保存在本机 `/private/tmp/collie-v1200-evidence/`，未将测试图片混入应用资源。
