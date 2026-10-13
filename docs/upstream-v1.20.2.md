# 跟进上游 v1.20.2

从 `1.20.1+collie.2` 跟进到 `1.20.2+collie.1`，保留现有 Collie 定制。

已交叉核对 [官方发布说明](https://github.com/AltanS/collie/releases/tag/v1.20.2)、
[CHANGELOG](https://github.com/AltanS/collie/blob/v1.20.2/CHANGELOG.md#1202---2026-10-12)
和 [完整标签差异](https://github.com/AltanS/collie/compare/v1.20.1...v1.20.2)。
上游标签 `1b980800`，范围包含 16 个提交、124 个文件。

## 上游变化

本版修复多种终端界面的发送和弹窗识别，并用不同形状区分状态。

| 范围 | 变化和用户影响 | 依据 |
| --- | --- | --- |
| pi／OmO 默认输入框 | OmO 最后一行没有颜色也能识别；补全列表打开时允许发送斜杠命令，避免默认安装无法发送。 | [6b5e9f80](https://github.com/AltanS/collie/commit/6b5e9f80)、[#416](https://github.com/AltanS/collie/issues/416) |
| pi／OmO 选择器与侧栏 | `/model`、`/tree`、`/resume` 在 Chat 中提供原生内容与 Esc 卡片，阻止把消息输入菜单。OmO 侧栏开启时只读取编辑区；侧栏旁的问答仍保留原生内容和 Esc，避免无法正确绑定选项的点击。 | [6b5e9f80](https://github.com/AltanS/collie/commit/6b5e9f80)、[ADR 0098](../.adr/0098-pi-questions-are-read-by-shape-and-footer.md) |
| TLS crew 更新 | 运行标记新增构建标识；仅开放 TLS 的节点恢复监听后，还要核对运行版本，防止旧程序重启被当成更新成功。旧标记没有该字段时仍兼容上一版检查。 | [b516c112](https://github.com/AltanS/collie/commit/b516c112)、[#415](https://github.com/AltanS/collie/issues/415) |
| 历史读取 | pi 会话名称、Oh My Pi 标题和 Codex 上下文压缩记录成为已知元数据，不显示为正文，也不再被 canary 误报为未知记录。 | [fa25d76e](https://github.com/AltanS/collie/commit/fa25d76e)、[d54fa890](https://github.com/AltanS/collie/commit/d54fa890)、[#418](https://github.com/AltanS/collie/issues/418) |
| Codex 0.159 状态栏 | 兼容线程标题出现后，分隔符前的空格沿用前一字段颜色的绘制方式；避免首轮回复后输入框无法识别、后续发送被拦住。 | [703644a6](https://github.com/AltanS/collie/commit/703644a6)、[#419](https://github.com/AltanS/collie/issues/419) |
| Antigravity 草稿 | 粘贴内容中的横线不再被误当作输入框上边框，含横线的草稿可以发送。 | [ed9b941c](https://github.com/AltanS/collie/commit/ed9b941c) |
| Oh My Pi 18.10 草稿 | 后续文本行、缩进行和空行属于草稿，避免误识别为补全列表或导致输入框消失。补充三个真实终端样本。 | [bd1cc7c5](https://github.com/AltanS/collie/commit/bd1cc7c5)、[8b8a2199](https://github.com/AltanS/collie/commit/8b8a2199) |
| Muse 草稿 | 草稿的缩进行按续行读取，不再当作不完整重绘而拒绝发送。 | [1c0aa1e1](https://github.com/AltanS/collie/commit/1c0aa1e1) |
| Codex／Grok／Muse 弹窗 | 明确检查当前屏幕是否存在弹窗，启动、退出和普通终端提示不再误显示未识别卡片。 | [e29d24d3](https://github.com/AltanS/collie/commit/e29d24d3) |
| Claude Code 2.1.296 | 命名会话在问答、向导、Config、Resume 下方多画的一条边线统一从解析入口移除；保留严格的底部提示和边界条件，恢复卡片识别及点击校验。 | [e0a97ecd](https://github.com/AltanS/collie/commit/e0a97ecd) |
| 状态可访问性 | 待处理为三角形，工作中为半填圆，完成为实心圆，空闲为空心圆，未知为虚线圆，未读为方块。只有正在查看的工作状态旋转，替代旧的透明度呼吸；减少动态效果偏好仍生效。应用到概览、工作区标题、侧栏、tab、操作带和会话标题。 | [37b7198b](https://github.com/AltanS/collie/commit/37b7198b)、[#420](https://github.com/AltanS/collie/issues/420) |
| 文档、样本与维护 | 更新设计规范、未识别卡片和 pi 问答 ADR、Harness 指南、crew 运行标记协议、版本证据及已知缺口；新增命名会话、OmO 编辑区／选择器等真实样本和测试，整理 Muse 注释归属。 | [2873af8f](https://github.com/AltanS/collie/commit/2873af8f)、[52b2c199](https://github.com/AltanS/collie/commit/52b2c199) |
| 打包 | AUR 与 Nix 发布源跟进上一上游稳定版 1.20.1；该元数据同步随本次合并保留，不代表 Collie 本机版本。没有新增依赖或恢复本仓库 Actions。 | [b60f2411](https://github.com/AltanS/collie/commit/b60f2411) |

## 本地实现取舍

本次没有删除或用上游替换独立的下游功能补丁。

| 保留项 | 与上游的关系和原因 |
| --- | --- |
| Codex Plan 模式发送 | 刚修好的 `queue · Plan mode · context` 识别与此次分隔符颜色修复解决不同情况，两者共存；已有忙碌发送回归继续覆盖。 |
| Codex 卡片及状态栏 | 保留 Model、Resume、Agents、审批、Plan／Review、工具权限卡片、警告数量和点击保护。上游新增的弹窗声明与本地已有严格 Esc 识别目标一致，沿用本地实现。 |
| Claude Settings／Agents | Settings 继续使用固定大小、可滚动的正文卡片和小 Esc。上游新 Config 样本的菜单预期改为此既定行为；新边线修复在本地卡片之前运行，命名会话也能显示标题及内容。未完整识别 Settings tab 的窄屏样本保留已有原生菜单回退。 |
| Hermes 与紧凑界面 | 保留中文历史折叠、操作提示、统一卡片、紧凑布局、tab 智能体图标、字体／显示设置和 PWA 视口修复；状态图形采用本次上游更新。Keys 继续使用此前选择的上游实现。 |
| 交付方式 | 使用 `+collie.N` 版本、提交和注释标签；不创建 GitHub Release，不恢复 Actions。只重启 Collie，不重启其他服务或智能体会话。 |

## 验证记录

使用受影响模块的测试和捕获样本，区分回放与本机实时验证。

- Harness 解析检查覆盖 81 个文件；Config 的既定下游预期完成同步，相关五个测试文件共 770 项通过。
- Actions、会话、侧栏、状态图形和未读标记组件测试通过；命名会话的点击校验与绑定测试通过。
- Journal、prompt binding、crew 状态及更新检查通过；TLS 临时监听测试在允许本地端口绑定的环境中通过。
- 根目录和 web 类型检查、全树 lint、版本一致性检查通过。适配目录增加本次真实样本，回放全部通过。
- 以上是上游捕获样本回放；没有为本次合并重新调用模型或操作用户的智能体会话，也不声称验证了每种 CLI 的本机实时行为。
- 最终发布构建、浏览器证据和本地／Tailnet 部署读回在交付时核对；本次不发布 Windows 二进制，未运行 Windows VM 演练。
