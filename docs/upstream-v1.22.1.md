# v1.22.1 合并记录

本次跟进 [上游 v1.22.1](https://github.com/AltanS/collie/releases/tag/v1.22.1)，交付版本为 `1.22.1+collie.1`。已核对发布说明、CHANGELOG 和 [v1.22.0 到 v1.22.1 的完整差异](https://github.com/AltanS/collie/compare/v1.22.0...v1.22.1)：10 个提交、21 个文件。这是修复版本，没有新增产品功能、依赖或构建工具变更。

## 上游全部变化

| 范围 | 行为变化与边界 |
| --- | --- |
| OMP 扩展组件 | 输入框下方由 `belowEditor` 绘制的最多 3 行扩展内容不再被误判为截断，恢复普通发送。上方组件和已有草稿同样覆盖；超过范围或确实读到半个输入框仍拒绝发送。[#468 修复](https://github.com/AltanS/collie/commit/58eb0fa0) |
| Android Shell 输入 | Shell 输入框额外关闭自动纠错和拼写检查，配合已有的禁止自动大写属性，避免键盘改写命令首字母。普通 Agent 输入保留键盘默认纠错；直接键入模式继续关闭纠错。[#465 修复](https://github.com/AltanS/collie/commit/75e2e20c) |
| Antigravity 状态栏 | 输入框下方最多 8 行自定义 statusLine 仍可识别，恢复 1.21.3 的范围，避免 4–8 行时每次都要求 Type here。第 9 行仍超出范围。[修复](https://github.com/AltanS/collie/commit/90ac1a38) |
| Windows pi 目录 | 识别输入框下以盘符开头的目录，例如 `C:\work`，不再因为工作目录位于用户目录外而要求 Type here。[修复](https://github.com/AltanS/collie/commit/306a6aa4) |
| OMP 确认提示 | 完整输入框上方出现 `(y/n)` 或按键提示时，仍按可能的对话阻止普通发送，但不再误报“读取时屏幕改变”。用户可检查画面并通过 Type here 二次确认；真正截断的输入框继续拒绝。[修复](https://github.com/AltanS/collie/commit/df0b687f) |

测试和文档同步增加 OMP 扩展组件的两份捕获、三份边界样本、样本来源说明及对应发送识别／输入框／表格回归断言。除版本文件和 CHANGELOG 外，没有打包或平台支持策略变更。Windows 安装包仍沿用上游实验性、未签名的说明；本 fork 不发布 Windows 产物。

## 本地实现取舍

本次没有用上游替换独立的本地实现。五项修复直接合入已有共用输入框和 Surface 识别；冲突仅为版本、CHANGELOG 和新增样本清单，保留原有样本标签。

保留上一版已确认的上游 Send Protocol 和通用 Codex Resume 菜单，以及模型／模式切换互斥保护、Codex 图片发送校验。继续保留 Codex Model／Agents／Plan／Review／问题／审批卡片及 Warning 数量、Claude Settings／Agents、Hermes 历史和操作提示、Cursor 历史、紧凑操作带与面板、16px Agent tab 图标、设备字体和 PWA viewport 修复。它们仍服务既有定制需求，本次上游未提供对应替代。

## 验证与交付

- 受影响的 Surface 全套、OMP、表格和 Composer 测试：13 个文件，6,247 项通过，7 项沿用上游 todo。包含全部已有 Surface 样本，覆盖本地 Codex／Claude 等识别与新边界。
- 后端 Surface／发送协议相关测试：12 个文件，535 项通过、0 失败。
- 根目录和 Web 类型检查、lint、版本一致性检查及正式标签的生产构建通过。
- 本次采用保存的屏幕样本与组件／协议回归，不额外调用模型，不开启定时 canary；没有重新认证已安装 CLI 的完整交互。
- 未在 Android 实机键盘或 Windows 运行环境重测；对应修复由属性断言和输入样本覆盖。
- 按用户 2026-10-17 的明确要求，部署验收仅访问 `http://127.0.0.1:8788`。公网域名前置 oauth-proxy，公网登录链路不属于本次验收范围。只重启 Collie。

2026-10-17 已推送 `main` 和 annotated tag `v1.22.1+collie.1`，部署提交 `9fe4f384f1a317c857b8d18b1cd2b8a3634fa969`，运行构建 `1.22.1+collie.1+9fe4f384.1792226819`。

- Collie 的新监听进程为 43307，监听 `127.0.0.1:8788`，可执行文件来自现有安装目录。本机构建 JSON、构建响应头、配置中的构建标识一致；健康正常，12 个会话均启用发送协议，Files 和本版发布说明可读取。
- 匿名会话读取返回 403；临时配对设备完成验证后已撤销，撤销后读取返回 403，既有设备和有效待配对信息保留。本机密钥的 loopback 访问和伪造转发头拒绝检查通过。
- Herdr、Headroom 及 guard 保持原进程，只重启 Collie。保留完整 `v1.22.0+collie.1` 回滚包；移除旧 `v1.21.3+collie.1` 回滚包和本轮暂存，安装目录恢复干净。
- 当前 Codex 为 0.163.0、Claude 为 2.1.302；标签明确记为未重做完整认证，不提高旧验证台账版本。公网 OAuth 链路按用户要求未测试。
