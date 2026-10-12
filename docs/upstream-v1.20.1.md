# 跟进上游 v1.20.1

本次从 `1.20.0+collie.1` 跟进至 `1.20.1+collie.1`。已交叉核对
[官方发布说明](https://github.com/AltanS/collie/releases/tag/v1.20.1)、
[CHANGELOG](https://github.com/AltanS/collie/blob/v1.20.1/CHANGELOG.md#1201---2026-10-12) 和
[完整标签差异](https://github.com/AltanS/collie/compare/v1.20.0...v1.20.1)。
上游标签为 `3c08e4f2`，范围包含 9 个提交、118 个文件。

## 上游变化

本版新增 pi 问答卡片和受保护发送，并修复仅开放 TLS 的 crew 节点更新误回滚。

| 范围 | 变化和用户影响 | 依据 |
| --- | --- | --- |
| pi／OmO 问题卡片 | 按屏幕结构、选项和底部按键提示识别，不依赖扩展名称。支持 pi 0.87.1／1.1.0 的 question、questionnaire 和 OmO 5.1.30 单选题。普通单选移动指针并回读后才按 Enter；OmO 发送界面标明的数字，不追加 Enter。 | [#412](https://github.com/AltanS/collie/pull/412)、[95b8e4c2](https://github.com/AltanS/collie/commit/95b8e4c2) |
| 多页问答及保守回退 | 各问题页显示选项，完整 Submit／Review 页显示提交与取消。多选、自由文本编辑器、未答完的确认页和不支持的界面保持终端显示；只在识别到原生退出提示时提供 Esc。 | [#397](https://github.com/AltanS/collie/pull/397)、[ADR 0098](../.adr/0098-pi-questions-are-read-by-shape-and-footer.md) |
| 防止误识别 | 正文或工具输出中引用的对话框保持正文，不能仅因出现选项及按键提示就变成活动卡片。识别还检查终端尾部边界和样式。 | [4f0242b1](https://github.com/AltanS/collie/commit/4f0242b1) |
| pi 发送保护 | 注册正式适配器，覆盖 stock pi 和 OmO 编辑器。输入前检查是否可编辑，输入后回读文本，匹配后才按 Enter。无法识别时第一次不输入并提示，明确重试仍保留回读检查；弹窗中的文本框不作为聊天输入框。 | [e55ed47d](https://github.com/AltanS/collie/commit/e55ed47d)、[431d8fcd](https://github.com/AltanS/collie/commit/431d8fcd) |
| crew 更新校验 | 没有 standby door、只提供双向 TLS 的节点不再因普通 HTTP 健康检查失败而回滚。校验自身证书指纹、最近一次重启后的运行标记和进程存活；`collie status` 将该地址标为 HTTPS crew 链路。此路径不能证明构建版本，返回的版本为空。 | [#410](https://github.com/AltanS/collie/issues/410)、[#411](https://github.com/AltanS/collie/pull/411)、[eae150d5](https://github.com/AltanS/collie/commit/eae150d5) |
| 证据和维护 | 新增 pi／OmO 真实 ANSI 样本、引用对话框反例、解析／发送／生命周期回归，扩展 canary 和 walk-pair 清单；记录上游 pi 1.1.0 验证证据及已知缺口，补充 ADR 和适配说明。 | [ASK_NOTES](../web/src/lib/harness/pi/ASK_NOTES.md)、[47b2a562](https://github.com/AltanS/collie/commit/47b2a562) |

旧版本由旧更新器执行校验，因此已经受 TLS-only 问题影响的远端节点需要一次官方安装器更新并重启，才能进入修复后的流程。本次本机 Herdr 插件部署不涉及 crew 节点迁移。

PR 397 扩展尚未发布，其兼容性来自贡献者样本；OmO 多问题、已回答问题和多选操作仍未覆盖。
本版没有新增依赖、构建流程或发布平台。

## 本地取舍

本次没有用上游替换独有的下游功能；pi 原本走默认镜像和单步发送，现在采用上游正式适配器。

保留紧凑布局、现有 Codex／Claude／Hermes／Cursor 卡片、会话历史及发送保护定制，继续复用公共卡片组件。
保留本地适配清单，并加入 pi 问题、确认、回退和输入区四项；上游捕获证据与本机实时验证分开记录。
版本号、单独发布提交、只推代码和标签、禁用 GitHub Actions、不创建 GitHub Release、只重启 Collie 的约定不变。

## 验证与交付

前端受影响套件共 10 个文件、4,466 项通过，8 项已有待办；CLI 更新／生命周期套件 532 项通过，
1 项仅 Windows 的管道测试在 macOS 跳过。系统边界测试、适配清单回放、全树 lint、双侧类型检查和构建通过。
84 份上游 ANSI 样本与标签逐字节一致。

六张 320×844 浏览器回放截图保存在本机 `/private/tmp/collie-v1201-evidence/screenshots/`，
包含 stock pi／OmO 单选、完整和未完整提交页、输入区及引用对话框反例；无浏览器错误或未模拟网络请求。
这些截图没有模型请求，只证明保存画面的渲染。

发布标签为 `v1.20.1+collie.1`；交付时核对远端 main／标签以及本地、Tailnet 构建和 API。

本机未重新调用 pi／OmO 模型做实时问答，卡片证据来自上游真实捕获及本机回放。
未做真实 TLS-only crew 集群升级、Windows 运行和真机 iPhone 验证。
