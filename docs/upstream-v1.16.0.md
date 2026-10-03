# 上游 v1.16.0 跟进报告

下游基线：`v1.15.3+collie.7`。目标版本：`v1.16.0+collie.1`。
范围为上游 `v1.15.3` → `v1.16.0`（`320bb18a`），对照了
[Release](https://github.com/AltanS/collie/releases/tag/v1.16.0)、
[CHANGELOG](https://github.com/AltanS/collie/blob/v1.16.0/CHANGELOG.md#1160---2026-10-03)
和 [287 个文件的实际差异](https://github.com/AltanS/collie/compare/v1.15.3...v1.16.0)。

## 新功能和日常使用变化

- **Oh My Pi 恢复会话卡片。** `/resume` 支持带框的 18.4 和之前无框的列表；点击会话后移动指针并确认。其他未识别菜单只在原生 footer 声明退出键时显示退出按钮，`/tree` 没有该声明，因此不猜测按键。[`d83f3281`](https://github.com/AltanS/collie/commit/d83f3281)
- **Oh My Pi 单选问答及自定义回答。** 单个问题、单选选项可以点击；`Other` 或备注输入框支持手机发送。多问题、多选、带说明的选项及过长列表保持原生。回答框遇到换行会立即提交，因此拒绝多行发送；若分段发送过程中界面变化，错误提示明确说明已有部分文字进入终端。[`3c5dbab6`](https://github.com/AltanS/collie/commit/3c5dbab6)、[Issue #336](https://github.com/AltanS/collie/issues/336)
- **Oh My Pi 工具审批卡片。** 支持 `bash` 和 `write`，展示完整命令或路径与文件内容，提供批准、拒绝、取消。其他工具、截断内容、超过 30 行的文件、额外选项或不支持的控制字符等保持原生；拒绝操作增加边界保护，避免指针竞态导致批准。[`0f50426b`](https://github.com/AltanS/collie/commit/0f50426b)
- **Oh My Pi 会话模型选择。** 18.4.10 的 `/switch`、Alt+P 展示当前可见模型窗口；可通过原生输入搜索。当前模型不可重复选择，切换会导致压缩的超上下文模型、截断行、任务模型和快捷角色等保守回退。Escape 有搜索时写明“清除搜索”，否则显示“关闭”；只改变当前会话模型，不改角色模型配置。[`ddcb2759`](https://github.com/AltanS/collie/commit/ddcb2759)
- **Muse 历史和 Chat。** 读取 Muse 的 `session.jsonl`，按工作目录发现最新会话，不依赖 Herdr hook；doctor 同步说明无需 hook。Oh My Pi 的 doctor 则新增 `integration-omp` 检查和缺失 hook 的修复说明。[Issue #333](https://github.com/AltanS/collie/issues/333)、[`13eaf692`](https://github.com/AltanS/collie/commit/13eaf692)
- **语音转写可以调用本机命令。** 可选 `local-cli` provider 通过 `collie stt setup --provider local-cli --command … --args …` 配置，将录音路径作为最后一个参数并读取 stdout。无 shell 展开，检查可执行文件，最多同时执行两次；60 秒超时、256 KiB 输出上限，清理进程树及遗留临时录音目录。Windows 使用独立的进程树终止方式，但已退出中间进程产生的孤儿进程仍是已说明的边界。本次不自动启用或安装转写引擎。[Issue #227](https://github.com/AltanS/collie/issues/227)
- **可选 Cloudflare Access JWT 校验。** 配置 `COLLIE_ACCESS_TEAM` 和 `COLLIE_ACCESS_AUD` 后验证应用对应签名与 audience；配置不完整或密钥不可获取时拒绝外部请求。只有真正的本机进程可免 token，带转发头的请求仍须校验，因此启用后并行的 Tailscale 前门也需要 token。密钥仅从指定 Cloudflare team 获取，限制 5 秒、64 KiB、禁止重定向；PWA manifest 携带登录凭据。本次保留已有访问配置，不自动启用新门禁。[Issue #341](https://github.com/AltanS/collie/issues/341)
- **首页 Spaces 跟随工作区筛选。** 选中工作区后显示该空间及同仓库 worktree，选择 All 恢复全部。[Issue #338](https://github.com/AltanS/collie/issues/338)

## 对话与输入修复

- 指向型 `prompt-select` 列表先发送方向键，再读取屏幕，确认目标行已选中后才发送 Enter；桌面端移走指针或选项内容变化会拒绝确认。真实成对样本验证移动指针后的身份保持，Claude Resume 的相对时间变化和同名会话分别处理。[ADR 0080](../.adr/0080-a-pointed-list-is-walked-verified-then-confirmed.md)
- 对 opencode 仅靠背景色区分选中项的审批，增加样式绑定，避免相同文字掩盖指针变化；拒绝原因写入浏览器控制台。屏幕绑定上限由 8 KiB 扩至 32 KiB，大终端卡片更容易正常操作。新前端配旧 bridge 仍可能保守拒绝，须配套更新。[`cbd355a7`](https://github.com/AltanS/collie/commit/cbd355a7)、[`13a30db8`](https://github.com/AltanS/collie/commit/13a30db8)
- opencode 草稿排除侧栏竖线和与内容同行的面板边框，同时保留用户粘贴的框线、树形文本和普通表格。[Issues #337/#340](https://github.com/AltanS/collie/issues/340)
- 上游未识别对话的 Escape 改为二次点击：首次进入确认态，4 秒后自动取消；原生写明 `esc dismiss` 时提示会关闭问题。已按确认方案合并：保留本地紧凑卡片、小 Esc 和 44px 点击区域，首次点击在左侧显示确认提示；更换界面或禁用卡片时取消确认态。[Issue #339](https://github.com/AltanS/collie/issues/339)
- 更新检查和 PowerShell 安装器读取全部 GitHub 标签分页，避免仓库超过 100 个标签后漏掉新版本。[`3553dbeb`](https://github.com/AltanS/collie/commit/3553dbeb)

## Windows：上游新增的实验性支持

上游首次支持 Windows 11 x64、Herdr ≥ 0.9.3；二进制未签名，手机经 Tailscale 访问 Windows 尚未经上游实测。不支持 Windows ARM、tmux、zellij 或 Windows 机器加入／主持 Crew。相关命令提前拒绝，保留 `crew status` 和 `crew leave` 以查看、清理已有配置。

- `start/stop/restart/status/uninstall` 使用任务计划程序 `herdr.collie`，登录时启动受限权限 launcher；明确任务归属，拒绝操作其他安装，单实例锁防止重复 launcher。启动等待健康响应，停止后复核进程，读取进程表失败或权限不足时不谎报成功，重启等待缩至 30 秒。
- 替代 `contrib/windows/collie-ctl.ps1`，任务名不再可配置；旧任务提示执行 restart 迁移。日志写入配置目录 `collie.log`，不自动轮转。Windows 手机 Update 按钮使用任务计划程序检查，doctor 不再因缺 Python 阻挡；Windows 源码 checkout 的在线更新明确拒绝。
- Windows ACL 将 Collie 自有机密文件限制为当前账户、SYSTEM、Administrators；只修复确认属于 Collie 的目录，拒绝符号链接、junction 和硬链接，避免修改其他文件权限。doctor 新增检查；PowerShell 路径正确处理单引号、美元符号和反引号，任务路径中的 `%` 明确拒绝。
- PowerShell 5.1 安装器无需 Bun、Git、bash 或管理员权限，校验 zip 的 SHA-256，通过 `current` junction 和用户 PATH 切换安装，不自动启动服务。支持固定标签救援，已有安装提示 restart；更新时仍占用的旧目录延后清理，同版本目录只有构建一致时才复用，失败保留回滚路径。
- 上游尝试发布实验性 Windows zip，并增加 Windows CI、实际 VM 安装／更新／回滚演练及缺失制品的发布门槛。本下游延续只推代码和标签、不发布 GitHub Release 的约定，不恢复这些 workflows，不声称发布或实测了 Windows 制品。

详见 [Windows 指南](https://github.com/AltanS/collie/blob/v1.16.0/docs/windows.md)、
[ADR 0075](../.adr/0075-windows-is-a-supported-host.md) 和 [PR #309](https://github.com/AltanS/collie/pull/309)。

## 文档、测试和构建工具

- 路径、可执行文件、权限和服务操作统一读取 host 对象，增加平台使用边界测试；本地下游的 harness watcher 同步使用该对象。
- 新增 Windows 安装、制品及测试脚本、ACL 与任务计划程序测试；更新安装、部署、安全、语音和故障排查文档。ADR 0076–0081 记录 omp 卡片、方向键确认及 Access 校验；旧审批／恢复流程文档注明后续修订。
- 新增 omp 和 opencode 真实 ANSI 样本、成对指针验证、样式绑定测试。现有卡片台账新增 `omp.resume/model/ask/approval`，明确是上游捕获回放，没有新增定时任务或模型调用。
- 无新增运行时依赖，未改变 flake 锁定版本。下游保留禁止恢复自动 GitHub Release 的测试，移除只针对停用 workflows 的新测试；Windows 脚本本身的适用测试仍保留。

## 下游保留与合并边界

保留 Codex／Claude／Hermes 卡片、Cursor 历史、固定状态栏、紧凑操作带、Quick／Agent／Display 底部弹层、Agent 默认五项，以及最近的直接输入草稿保留、组合键页、修饰键标记和基于会话日志的实验性折行合并。

本地未识别界面卡片原先点击一次 Esc 就发送，现采用上游二次确认保护。
首次点击只显示提示，4 秒内再次点击才发送；超时、更换界面或禁用卡片后重新确认。
共用该组件的 Claude Status／Config／Usage／Stats 同样采用此交互，保留固定可滚动正文。
未识别屏幕正文继续放在镜像区，小 Esc 外观与紧凑高度保留。

共享对话动作接入上游的移动后确认及样式绑定，同时保留 Codex 审批载荷身份、完整区域绑定、
装饰粒子归一化和发送取消信号。Codex 粒子输入屏幕仍使用文字绑定；若额外请求不对齐的
样式绑定，会明确拒绝，回归测试保留此边界。

## 验证记录

已完成针对合并范围的测试与浏览器检查，沿用已有样本，不增加模型调用或定时任务。

- Harness 逻辑套件及卡片台账回放通过；Hermes 无指向型列表样本的空测试组明确记为待验证。
- 受影响的 bridge／CLI／脚本测试通过；合并后发现的平台守卫、Cursor 历史占位值、doctor 快照及样式投影断言冲突已修复并定向重跑。
- 对话动作、样式绑定、Spaces、表格区间及 Composer／Picker／PromptSelect 组件相关测试通过。
- Esc 组件 15 项测试通过，覆盖首次不发送、二次发送、超时、禁用、界面／按键变化及发送中状态。
- 浏览器 4 个用例通过：320px 明暗色和 1280px 的 Claude 四页卡片，以及 320px 中文未知插件表单。
  核对确认态前后几何尺寸、44px 点击区域、横竖滚动及页面无水平溢出；截图存于本机
  `/private/tmp/collie-v1160-evidence/`。这是捕获样本的 UI 回放，并非当前 CLI 的现场交互认证。
- 根目录和 web 类型检查、全仓 lint 通过；上游原始 ANSI 捕获保留字节及行尾，不清理其显示空格。

本机交付为 macOS。Windows VM、Windows 手机 Tailscale 路径及新增 omp 卡片的本机现场操作未验证；
本下游不发布 Windows 制品。正式标签构建及本地／Tailnet 部署回读结果在发布交付时报告。
