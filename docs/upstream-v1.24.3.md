# v1.24.3 合并记录

从 `1.24.2+collie.1` 跟进至 `1.24.3+collie.1`。已交叉核对[官方发布说明](https://github.com/AltanS/collie/releases/tag/v1.24.3)、[标签 CHANGELOG](https://github.com/AltanS/collie/blob/v1.24.3/CHANGELOG.md) 和 [v1.24.2…v1.24.3 完整差异](https://github.com/AltanS/collie/compare/v1.24.2...v1.24.3)：5 个提交、18 个文件。上游将本版定位为非紧急补丁，主要影响 Codex Ultra 用户和慢速更新链路。

## 上游完整变化

- **Codex Ultra 可以识别输入框。** Codex 0.164／0.165 在 Ultra effort 下用 `»`，其他 effort 仍用 `›`。此前终端适配器与发送 Surface profile 只认识后者，可能误判输入框不可用、要求手动确认发送。两套读取现在接受同一对字符，profile 与读取器之间有一致性测试；普通输出、引号和编号选项仍不能充当输入框。[#615](https://github.com/AltanS/collie/issues/615)、[68d57ea](https://github.com/AltanS/collie/commit/68d57ea51)、[2a0158d](https://github.com/AltanS/collie/commit/2a0158def)
- **慢速下载不再被 20 秒总期限截断。** 更新资产下载改为等待响应头最多 20 秒，收到响应后仅在连续 60 秒没有非空数据时判定停滞；每次收到非空数据重新计时，空块不算进展。小型 release JSON 查询仍用原有 20 秒总超时。原先约 57MB 的资产在低于约 23Mbit/s 的链路上容易超时，并被误报为无法连接 GitHub。[fadcc42](https://github.com/AltanS/collie/commit/fadcc4284)、[#613](https://github.com/AltanS/collie/issues/613)
- **持续滴流也有上限。** 下载体总耗时最多 30 分钟，防止对端在每个 60 秒窗口内仅发送少量数据而永久占用更新。停滞与过慢分别显示已收字节数、可用时显示总大小，清理 reader、文件句柄、计时器及半成品；更新失败仍保留当前安装。已收到响应后超时不再说成“无法连接 github.com”。[1d812ef](https://github.com/AltanS/collie/commit/1d812ef97)
- **测试和样本。** 新增本机 HTTP 服务测试，使用缩短的可注入计时验证持续进展、收到头后无数据、滴流总超时、响应头超时及半文件清理；更新调用端验证错误措辞。Codex 增加空输入／草稿样本、来源说明、标签和正文／编号选项反例。
- **样本证据边界。** 上游明确标注两个 Ultra 样本为 derived：在已有捕获中仅替换输入行开头的 glyph，原报告者尚未提供原生捕获。文件名中的版本标签不代表本机已认证该 CLI。
- **发布与文档。** 三个版本字段和 CHANGELOG 更新到官方 `1.24.3`。发布说明建议受旧下载超时困扰的官方安装先手动升级一次，之后手机内更新才会使用新协议；本机通过已构建、固定签名的部署完成此步。不复制该安装命令覆盖本机定制。除 fixture README／标签及 CHANGELOG，本次没有指南、依赖、SDK、工作流或新产品功能变化。

## 下游取舍

本次**没有整项独立下游实现被上游替代**。上游修复与既有发送协议兼容，继续保留 Queue／Steer 和立即引导、模型切换互斥、命令正文严格校验、输入内 Keys 和草稿缓存、Codex／Claude／AGY 卡片、Hermes 状态栏与历史格式、紧凑布局和字体设置。

本地的命令完成列表、多段输入与动画清理还有四处单独检查 `›`。新增回归先复现了六个 Ultra 失败，再让这些判断共用上游 `PROMPT_GLYPHS`，覆盖自定义 footer 的 live marker、跨空段扫描、斜杠命令与粒子归一化。保留原有专用粗体 marker、背景／padding、dim、位置、选择和正文保护条件；没有增加识别框架、放宽未知界面或改发送按键策略。动画归一化同时供前端与 bridge 绑定读取复用。

`codex.send` 适配目录补充相关源文件、测试和两个 derived 样本；保留原有真实验证版本，不把回放当成新的 CLI 认证。fork 不恢复 GitHub workflows、不创建 GitHub Release。

## 验证与交付边界

- 受影响 CLI 下载／更新与完整发送协议 1106 项通过；共享 prompt binding 366 项通过。
- 首轮相关前端 logic 18 文件、4556 项通过，6 TODO；补齐本地 Ultra 路径后，修改的两个文件 3305 项通过、6 TODO，其余已通过文件未重复运行。
- Chromium／WebKit 的 320px Ultra 输入发送、Queue 设置与立即引导共 4 项通过，并保存截图至 `/private/tmp/collie-v1243-e2e/`。发送接口使用 stub，原生协议由上述测试单独验证。
- adaptation catalog、78 项适配回放、root／web 类型检查、全树 lint 通过。正式标签构建、推送和本机部署回读结果随最终交付报告。
- 部署使用既有 `Collie Local Signing`／`dev.collie.bridge`，替换前后核对指定要求，只重启 Collie。按既有约定仅验证 localhost、Documents 实际文件读取与其他服务连续性，不探测带 OAuth 的公网入口。
- 未调用付费模型、未操作用户智能体会话、未做完整 live rig、Windows／WSL 或 iPhone PWA 真机回归；Ultra 样本仍为派生证据。
