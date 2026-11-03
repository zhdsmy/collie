# 跟进上游 v1.25.6

采用 [v1.25.6 正式标签](https://github.com/AltanS/collie/releases/tag/v1.25.6)，发布为 `1.25.6+collie.1`。已交叉核对发行说明、CHANGELOG 和 [v1.25.5…v1.25.6 全部差异](https://github.com/AltanS/collie/compare/v1.25.5...v1.25.6)，覆盖正式标签的全部 14 个提交。

## 上游完整变化

- **Android 输入键盘**：所有 pane 的 composer 关闭浏览器拼写检查，避免点击标红词语时 Chrome 建议菜单夺走焦点、收起键盘。Agent 输入继续保留键盘自身的自动纠正；shell／直接按键模式仍关闭自动纠正。[修复](https://github.com/AltanS/collie/commit/a05ea4756)
- **旧 Herdr 适配器的工作目录**：优先使用前台程序的非空 `foreground_cwd`，缺失时回退启动目录，不再拿启动目录覆盖当前工作位置，使目录范围的历史和仓库分组准确。herdr-core 原本已有此行为，本机 core 不受这项改动影响。[#656](https://github.com/AltanS/collie/pull/656)、[与 core 对齐](https://github.com/AltanS/collie/commit/5d0b06ba4)
- **Hermes 0.22.5 带标题输入框**：发送 profile 识别 `── Session Title ─` 顶部边界及繁体中文占位提示，修复会话生成标题后后续发送被 `no-match` 拒绝。新增标题边界样本，0.22.3–0.22.5 仍标为 provisional；样本不是该版本完整原生发送认证。[#658](https://github.com/AltanS/collie/pull/658)、[样本及 profile](https://github.com/AltanS/collie/commit/1941ec4b3)
- **Hermes Chat 与卡片**：同样识别带标题的顶部边界，恢复固定状态栏、未提交草稿预览、clarify／危险命令确认／模型选择卡片；框宽从下边界取得，避免把短标题当成整框宽度。仅顶部允许标题，底部带标题、无内容标题、标题占满横线等不明形态继续拒绝。[#657](https://github.com/AltanS/collie/pull/657)、[Chat 修复](https://github.com/AltanS/collie/commit/1e665ac6e)、[反例](https://github.com/AltanS/collie/commit/735cfeb4a)
- **AGY 1.4.12 子智能体区域**：识别输入框下方两条横线之间的 `● Agent(…)`，避免将区域底部误作输入框底部而弹出未识别提示。空输入框可以继续发送；未知行或覆盖其上的权限对话仍阻止普通发送。子智能体运行且已有草稿的发送仍可能拒绝，未放宽草稿保护。[#655](https://github.com/AltanS/collie/pull/655)、[识别](https://github.com/AltanS/collie/commit/b3d81de7f)、[权限边界](https://github.com/AltanS/collie/commit/014a3e5e0)
- **测试、证据与文档**：加入 Hermes 标题、AGY 子智能体空框与权限反例，并验证两次读取时区域计时变化不使空框失效；AGY 权限反例是衍生场景，原始空框来自 issue 655 的文本，不冒充原生 ANSI capture。新增 Claude Code 2.1.317 的 21 个 rig cassette／元数据文件，覆盖发送、权限、多选、历史和 walky 路径；这次合并没有重新调用模型生成它们。更新 corpus 标签、版本证据和 multiplexer 兼容表；Update 卡测试等待禁用状态以消除异步竞态。[cassettes](https://github.com/AltanS/collie/commit/9d373a36b)、[Update 测试](https://github.com/AltanS/collie/commit/5cff8de54)

除三个版本文件外，没有依赖、构建平台或发布流水线变更；继续不恢复 workflows、不创建 GitHub Release。

## 下游取舍

替换本地 Hermes 顶部边界的宽泛 `isInputRule` 标题匹配，采用上游 `isTopRule` 的标题字符及末尾横线约束；宽框允许标题行短于下边界。保留本地现代活动动画（包括填满一行而没有末尾横线）、状态栏下移、中简繁提示、撕裂帧及输入 prompt 校验。用户可见差别是短标题能发送并恢复卡片，未知标题不会被宽泛认成输入框。

AGY 保留本地下游现有的 named-footer 同宽校验，只增加子智能体行类型；没有叠加上游第二条 frame alternate 路径，避免绕过已有的未知行、区域长度和边框宽度保护。其余独立下游实现均未替换。

保留 Standard/Fast 单控件、Queue/Steer 与排队消息立即引导、输入区 Keys／草稿缓存、默认 1000 行镜像与屏幕优先发送检查、慢历史读取保护、Hermes Python bootstrap 身份识别、各类 journal、AGY `.pb` 后备、卡片／紧凑状态栏／图标／字体／PWA 定制。适配目录登记新增样本和相关测试，不将回放标为当前 CLI 原生认证。

## 验证

- Herdr adapter、发送协议及适配目录：899 项通过。
- Hermes／AGY adapter、卡片回退、输入框边界与全样本 Surface：11 个文件、9676 项通过，22 项既有 todo；另对 Hermes／AGY profile 定向回归通过。
- Composer／Update 组件：364 项通过。两端类型检查、lint、版本一致性及正式构建在交付前检查。
- 扩大的 profile 检查发现 Cursor `cursor--idle-bottom-docked.txt` 的 frame 断言失败，已在升级前 HEAD 的隔离副本复现，相关 profile、frame、样本均未被本次修改；这项既有问题未修复，不宣称全套检查全绿。
- 手机浏览器验证、构建和部署结果在完成后补记。

部署维持固定签名，替换前和重启前检查 designated requirement；只重启 Collie，核验 localhost 构建、鉴权 API、snapshot、Documents 实际读取及其他服务不变。按约定仅从本机验收，公网域名有 OAuth 前置。

未新增模型调用、定时巡检、Windows／跨机 Crew 或真机 iOS／Android 验证；样本回放与浏览器 stub 不等于 Hermes 0.22.5／AGY 1.4.12 的完整原生交互认证。既有 core ANSI 样式和 Hermes 完成状态缺口不在本次升级修改范围。
