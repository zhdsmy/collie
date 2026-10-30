# v1.25.1 上游跟进

基于 `v1.25.0+collie.2` 合入上游 `v1.25.1`，交付版本为 `v1.25.1+collie.1`。

核对依据：[正式 Release](https://github.com/AltanS/collie/releases/tag/v1.25.1)、[CHANGELOG](https://github.com/AltanS/collie/blob/v1.25.1/CHANGELOG.md)、[实际 v1.25.0…v1.25.1 差异](https://github.com/AltanS/collie/compare/v1.25.0...v1.25.1)。实际范围为 10 个提交、44 个文件，没有新增依赖。

## 用户可见修复

- **同机多实例的 Walky 消息查询继续寻找真正持有消息的 bridge。** `inbox <id>`、`status`、`reply` 不再被先回应、却没有该消息的旧实例截住；兼容旧版的 `no message …` 和新版带 `missing` 原因的 `not here`。回复优先交给持有原消息的实例，发送后的回执仍绑定实际接收发送的 bridge；取消找不到消息时也允许继续查找。全部实例均未找到时保留具体错误，不把无消息当成功。([15fb80a](https://github.com/AltanS/collie/commit/15fb80a))
- **首页页脚与首次欢迎页按机器计数。** 同一主机运行 Herdr TUI 和 herdr-core 两个实例时只算一台机器，同时显示可达实例数；旧实例不报告 host 时仍按各自一台处理。Dashboard pane 行只显示成员名称，避免手机上主机加 mux 的双段标签被裁切；详情页仍保留双段标签。([28a9306](https://github.com/AltanS/collie/commit/28a9306))
- **Claude Code 纯文本空输入框不会被灰色提示误挡。** herdr-core 丢失 ANSI 属性时，`Try "…"` 整体形状识别为占位提示，允许空框投递。带颜色或属性的捕获仍用原生 faint／颜色判断，用户自己输入同形文本继续算草稿，避免覆盖。([4a4aa50](https://github.com/AltanS/collie/commit/4a4aa50)、[54605a4](https://github.com/AltanS/collie/commit/54605a4))

纯文本捕获无法区分原生提示和用户逐字输入的完全相同 `Try "…"`；这是上游明确记录的识别边界，并未扩大到其他草稿形状。本机仍使用 Herdr TUI，没有启动第二个 Collie 或切换 multiplexer。

## 文档、回放与打包

- README、五分钟安装、安装、Sessions 和术语补齐 herdr-core，区分 Herdr TUI、core、hc 与 herdr-app。新增同机两实例的配置、端口、Crew 加入、Claude hook 与诊断步骤；补充实验性 herdr-app 面板的手动安装、最低版本和能力边界。本轮仅合入说明，不安装面板或新服务。
- Commands／Crew 文档补齐 census JSON 的 host、实例、link 和缺失值语义，说明 `serve status` 与 `status --verbose`；Walky 补充空范围、busy／draft 暂存和投递前重新核对 workspace 范围。
- Configure 说明照片预览、Attach 原图和编辑后 PNG；Claude 指南说明启动首屏前禁用 Send、草稿仍可编辑。上游故障页仍写“计划在 1.25.1 修复”，本地顺手改为“已在 1.25.1 修复”。
- 录制流回放匹配忽略 OMP 和 Claude 会话开头的 system reminder，避免单独录制与整套回放的回合错配；补录 Claude 2.1.314 crew agents case 13。主机名与 Walky skill 内固定示例主机名统一脱敏，保留跨机器一致的匹配键。([4ee9f1d](https://github.com/AltanS/collie/commit/4ee9f1d)、[af39f77](https://github.com/AltanS/collie/commit/af39f77))
- Windows hook target 测试统一路径分隔符；skip 预算从 174 调整到 180，包含新增 5 项 Walky socket 测试及已有 POSIX 子进程测试，逐项列出原因。本地采用预算检查，继续不恢复 `.github/workflows/`，不创建 GitHub Release，不发布 Windows 包。([174a15b](https://github.com/AltanS/collie/commit/174a15b)、[14924d5](https://github.com/AltanS/collie/commit/14924d5))
- 上游余下提交为文档整理及版本发布，没有额外功能开关或运行配置迁移。

## 本地实现取舍

本轮没有被上游替换的独立下游实现。冲突均为版本、CHANGELOG、格式及已决定移除的 workflow 检查；Claude 新提示识别与本地 Queue/Steer 配置兼容。

继续保留 Codex／Claude Queue/Steer 与立即引导、发送和切换保护、Input 内联按键与草稿缓存、现有各智能体卡片和紧凑状态栏、AGY 上游历史主体与 `.pb` 后备、AGY 1.4.11 启动保护及已有现场认证、Cursor 历史、紧凑操作带、tab 图标、字体、显示和 PWA 定制。Claude 发送清单补充共享 frame 测试和上游 2.1.314 纯文本捕获，不把该捕获提升为本机完整 CLI 认证；没有启用周期监控。

## 验证与部署

- 受影响 bridge／CLI／适配清单：20 文件、413 项通过；其中清单回放覆盖 79 项适配。
- Surface／Claude 输入框逻辑：4 文件、2611 项通过；机器计数、HostChip／PaneMeta／AgentCard、欢迎页组件：5 文件、133 项通过；录制流 rig：2 文件、69 项通过，没有新增模型调用。
- 根目录与 web 类型检查、全树 lint、版本一致性和干净标签正式构建作为发布检查；部署使用既有固定证书，保留旧 PWA 哈希资源。
- 仅重启 Collie，从 localhost 校验精确构建 ID、匿名拒绝、鉴权 health／config／snapshot、Documents 实际文件读取、更新检查、监听程序及 Herdr／Headroom 进程不变，验证后撤销临时设备并只保留最新完整回滚包。

依用户约定不探测前置 OAuth proxy 的公网域名。未进行 Windows 真机、herdr-core 双实例现场或新增模型调用；本轮的真实 socket 集成与脱敏捕获回放不等同于这些现场认证。
