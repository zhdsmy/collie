# v1.24.2 合并记录

从 `1.24.1+collie.3` 跟进至 `1.24.2+collie.1`。已交叉核对[官方发布说明](https://github.com/AltanS/collie/releases/tag/v1.24.2)、[标签 CHANGELOG](https://github.com/AltanS/collie/blob/v1.24.2/CHANGELOG.md) 和 [v1.24.1…v1.24.2 完整差异](https://github.com/AltanS/collie/compare/v1.24.1...v1.24.2)：31 个提交、183 个文件。

## 发送与输入

- **慢磁盘不再消耗提交按键的有效期。** 先持久化 `submit-sent`、完成同步操作，再生成有效期 150ms 的按键令牌；通用提交和常规提交路径一致。持久化失败仍阻止发送，未放松精确回读或重发保护。[2efc568](https://github.com/AltanS/collie/commit/2efc568)
- **Codex 0.163.0 运行中的斜杠命令不再被警告尾行阻挡。** 识别 `? for shortcuts`／`← for agents · ? for shortcuts` 后用宽空格分隔的警告部分，避免提示变成 `tab to queue message` 后误报探针改动了正文。[92ad108](https://github.com/AltanS/collie/commit/92ad108)
- **pi／OMP 的动态 widget 不再阻挡命令或二次确认发送。** 相应 profile 声明上方内容可原位更新 spinner、时钟和数字；其他字符变化、新增行仍拒绝。新 Codex 会话输入命令时欢迎图隐藏，允许正文只减少。[ea58062](https://github.com/AltanS/collie/commit/ea58062)
- 合并回归发现：上游欢迎图兼容条件允许忽略最上方三条新内容，导致现有 80 列 `/model` 测试中的新增正文也被放行。本次命令路径保留严格的“只减少、不能新增”条件；欢迎图消失正例及正文变化反例同时通过。没有放宽其他发送校验。
- **WSL 下 pi 使用 Ctrl+Q 提交。** 根据 `WSL_DISTRO_NAME`、`WSL_INTEROP` 或 `/proc/version` 判别，其他智能体按键不变。本地 AGY 发送设置覆盖也使用该平台判定。[#594](https://github.com/AltanS/collie/pull/594)
- **有草稿时也能继续语音输入。** Attach 旁增加小麦克风，转写插入光标位置；空输入仍由主按钮录音，回答对话和发送二次确认时隐藏辅助麦克风；录音结束恢复原开启按钮的键盘焦点。[#573](https://github.com/AltanS/collie/pull/573)
- **Claude 问答自定义答案不再被 240 字符截断。** 允许最多 4000 字符，写入前按终端宽度、24 行续行和完整菜单窗口预算判断是否可验证；放不下则不发送任何键并提示改用 Chat about this。Plan 反馈继续保持 240 字符，清理和重读范围同步扩大。[#606](https://github.com/AltanS/collie/pull/606)

## 对话、历史和工作区

- **没有屏幕适配器的智能体提问时自动显示 Terminal。** 例如 OpenClaw 已有可读 Chat 历史，但原生问题无法变成卡片时，临时显示终端，问题结束回到 Chat，避免通知需要回答却找不到问题。[#605](https://github.com/AltanS/collie/issues/605)
- **OpenCode 2.1 问答恢复卡片。** 覆盖 `Questions` 标题、以强调色标记的 pointer、粗体当前 tab、`Submit` tab、无 `Review` 标题的确认页、带 checkbox 的自定义输入入口。单选、多选、多问题向导和 review 有对应上游真实样本；已打开的原生自由输入保留后备卡片和退出入口。[#607](https://github.com/AltanS/collie/pull/607)
- **OpenCode 升级后可读旧会话。** `session_v2` 中有会话记录不再被当成消息已迁移的证据；按实际存在消息的 v1/v2 store 选取，有两份时按较新时间、同时间优先 v2，空会话才按 session 表选取。查询使用索引和 `limit 1`，不逐条统计历史。[#607](https://github.com/AltanS/collie/pull/607)
- **Hermes 交互会话历史恢复。** 接受 `local-` 加 64 位十六进制 session id，不再因为不符合旧日期格式而退回纯终端。[#602](https://github.com/AltanS/collie/pull/602)
- **Dashboard 合并显示关联 git worktree。** 已打开的 root workspace 下折叠 linked worktree；workspace 筛选只列 root，行内标注各 worktree，Files 仍保留独立工作树列表。[#608](https://github.com/AltanS/collie/pull/608)

## 诊断、更新与安装

- **未识别界面卡片可直接报告问题。** 打开既有报告面板，标题指明未识别对话，列出各 detector 的 found／null／异常结果，补充 app/bridge build、浏览器、viewport、安装模式。该入口默认勾选屏幕，提交前展示经模式遮蔽的预览，仍需用户主动复制或打开 GitHub；没有新增上传接口或自动外发。本机 pane 可用，crew member 仍不提供该入口。模式遮蔽不保证识别所有隐私。[#554](https://github.com/AltanS/collie/pull/554)
- 保留本地约 50px 单行后备卡片，把报告入口做成同排 44px 点击区域的图标；固定大小的 Claude Settings 内容区、Chat 原生内容和小 Esc 不改回上游大卡片。Codex／Claude Agents、Model、Resume、Plan、Review、AGY 模型／artifact／modal 等本地 detector 同时纳入报告，避免诊断遗漏定制。
- **命名实例的 Update 不再更新默认实例。** bridge 与 CLI 共用 runner 环境变量白名单，通过 `systemd-run` 保留 `COLLIE_INSTANCE`、`COLLIE_MUX`、配置路径等非凭据字段，凭据仍从配置读取。[411c0a4](https://github.com/AltanS/collie/commit/411c0a4)
- 安装脚本和指南统一顺序：Windows 先安装并登录 Tailscale，再启动 multiplexer/Collie、发布地址、手机添加主屏幕后配对，避免 Safari 与 PWA 存储分离；删除容易覆盖配置的 `.env.example` 复制步骤，PATH 给出准确命令，PowerShell 指向在线 Windows 文档。同步 five-minute-install、Security、Configure、multiplexer 和 Walky Talky 文档。[安装差异](https://github.com/AltanS/collie/commit/1c6988cd3)

## 回归成本、SDK 与工程

- **浏览器 rig 支持真实 pi／OMP 加录制模型响应。** 本机 stand-in 按录制节奏重放流，原生 CLI 仍负责绘制和按键；请求不匹配明确失败，不取近似回答。按 CLI 版本、模型和 Walky Talky skill 文本选录制，没有匹配默认 live+record；`COLLIE_RIG_MODEL=replay` 强制缺录制即停止，`COLLIE_RIG_LIVE=pi,omp`／`all` 强制 live。Claude 仍使用 live。[ADR 0125](../.adr/0125-the-browser-leg-replays-recorded-model-streams.md)
- 保存 pi 1.3.0、OMP 18.6.1 的流和 metadata，记录各 harness tier、live turns 与 OpenRouter 请求数；nightly ledger 可记录 tier，但本次不启用定时任务。新增录制敏感内容检查 `e2e:recordings:check` 和独立 Vitest `rig` 项目；JSONL 标记 generated。未在本机调用真实模型或启动完整三智能体 rig。[558d01d](https://github.com/AltanS/collie/commit/558d01d)
- 浏览器 rig 使用独立 systemd scope 和任务数量上限，限制异常派生进程；补充清理、超时和资源边界测试。[#609](https://github.com/AltanS/collie/pull/609)
- Durable 功能取消原先按日期／外部采用信号撤除的条件，继续保留；wire 仍实验性，SDK 不因此成为稳定版。SDK 元数据升到 `0.2.0`，文档解释 `experimental` 与 npm `latest` 的区别，更新 WIRE、durable agents／SDK 指南，移除示例不再需要的 Bun 冷却排除项。本次没有增加新 SDK 运行逻辑，也不发布 npm 包。
- Cloudflare 示例锁文件更新 `@types/node` 与 `undici-types`；AUR、Nix 发布元数据跟随官方版本。主应用未新增生产依赖。GitHub issue 表单和十二种语言加入报告及长答案提示；依照 fork 规则没有恢复 GitHub workflows，没有创建 GitHub Release。

## 下游取舍

本次**没有整项独立下游实现被上游替代**。继续采用既有上游发送协议和新增修复，保留上述更严格的命令正文校验、共享 Queue／Steer 设置与立即引导、模型切换互斥、输入内合并 Keys 与草稿缓存、紧凑 statusline／字体／tab agent 图标、Codex／Claude／AGY 定制卡片、Hermes 本地历史格式和上一版长活动状态栏修复。新增 Report 与这些定制兼容。

部署继续使用既有 `Collie Local Signing` 证书和 `dev.collie.bridge` 标识，切换前后核对 designated requirement，保持 Documents 授权身份。只重启 Collie；依操作者要求仅从 localhost 验收，公网 OAuth 代理不参与验证。

## 验证

- 受影响后端首轮 1393 通过，发现一项上述命令正文保护回归；收紧后完整发送协议 802 项通过。CLI update／runner 303 项通过。
- 前端 logic 首轮 45241 通过、35 项预期失败、67 TODO；4 项失败均在新 detector 报告套件，补齐本地 detector 并匹配本地卡片结构后，该文件 20 项复测通过。相关 DOM 12 文件 740 项通过。
- 模型回放 Node Vitest 51 项通过；录制检查、adaptation catalog 和 78 项特征回放通过，新增 OpenCode 2.1 样本属于上游真实捕获回放，不标成本机 CLI 认证。
- root／web 类型检查、全树 lint 通过。Chromium／WebKit 手机宽度共 18 项通过，覆盖四语言单行提示与 44px 报告／Esc 点击区域、报告浮层、Hermes 长活动状态栏及回复可见性；截图保存在 `/private/tmp/collie-v1242-unread-e2e/` 和 `/private/tmp/collie-v1242-e2e/`。旧浏览器用例误用已识别的 Status 页，已改用真实未识别的插件源输入表单。正式构建和部署回读结果随最终交付报告。
- 未运行模型付费探测、完整 live browser rig、Windows／WSL 真机或已安装 iPhone PWA；未认证所有智能体版本。Hermes VS16 emoji 原生宽度问题不属于本版修复范围。
