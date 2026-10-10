# 跟进上游 v1.19.2

本次从 `1.19.0+collie.1` 跟进至 `1.19.2+collie.1`，包含上游 v1.19.1 和 v1.19.2。

已交叉核对 [v1.19.1 发布说明](https://github.com/AltanS/collie/releases/tag/v1.19.1)、
[v1.19.2 发布说明](https://github.com/AltanS/collie/releases/tag/v1.19.2)、两版 CHANGELOG 与
[完整标签差异](https://github.com/AltanS/collie/compare/v1.19.0...v1.19.2)。
v1.19.2 标签解引用为 `aacece40`，上游共修改 82 个文件。

## 上游变化

新增块级复制，修复帮助命令副作用、内存统计、发送保护及手机布局。

| 版本／范围 | 变化和用户影响 | 依据 |
| --- | --- | --- |
| 1.19.1 配对提示 | 无外部认证代理时，`/auth/` 告知未配对设备运行 `collie pair`，并链接 Settings；支持配置了路径前缀的部署。 | [#393](https://github.com/AltanS/collie/issues/393)、[d21438e8](https://github.com/AltanS/collie/commit/d21438e8) |
| 1.19.1 CLI 帮助 | 所有命令及子命令先识别 `-h`／`--help` 并输出用法；`update --help`、`restart --help`、`uninstall --help`、`build --help` 不再执行实际动作。字面 `--` 后仍是参数。 | [#392](https://github.com/AltanS/collie/issues/392)、[eb4b2429](https://github.com/AltanS/collie/commit/eb4b2429) |
| 1.19.1 opencode 发送 | 输入框仍露在弹窗下方时，也检查弹窗是否持有键盘，阻止文本误入 `/models` 等筛选框；发送中途出现菜单或弹窗时给出具体提示。强制发送仍保留“快捷键可能已经生效”的提醒。 | [#391](https://github.com/AltanS/collie/issues/391)、[526d7a92](https://github.com/AltanS/collie/commit/526d7a92) |
| 1.19.1 macOS 内存 | 用 `vm_stat` 计算应用、wired 和压缩器实际占用，扣除可清理页，不再把文件缓存全部算作已用。异步读取、单任务并发、1 秒超时；结果失败、未就绪或过期时回退原算法。 | [#383](https://github.com/AltanS/collie/issues/383)、[38cf987f](https://github.com/AltanS/collie/commit/38cf987f)、[e338dd37](https://github.com/AltanS/collie/commit/e338dd37) |
| 1.19.2 块级复制 | 代码块、Markdown 表格、命令、命令输出和 diff 增加角落复制按钮。复制原始内容，表格保留 Markdown，diff 保留未展开的完整内容；已遮蔽信息保持遮蔽。按钮自身显示成功或失败，History／Files 等没有全局状态栏的页面也有反馈。 | [#396](https://github.com/AltanS/collie/issues/396)、[edac919d](https://github.com/AltanS/collie/commit/edac919d)、[f14ea4bb](https://github.com/AltanS/collie/commit/f14ea4bb) |
| 1.19.2 复制细节 | 窄表格的按钮贴近表格边角；命令输出明确标为“复制命令输出”；命令与输出复制按钮的点击区域避免重叠。 | [d6e0f249](https://github.com/AltanS/collie/commit/d6e0f249)、[268b1dde](https://github.com/AltanS/collie/commit/268b1dde) |
| 1.19.2 HTTP 复制 | 没有 Clipboard API 的普通 HTTP 页面可通过浏览器旧复制命令完成复制；失败如实反馈，临时文本框移除并恢复原焦点。 | [292dd2bd](https://github.com/AltanS/collie/commit/292dd2bd) |
| 1.19.2 omp 问题卡片 | 识别带描述的 Ask 单选项，把描述显示在对应选项下；保守限定有样本支持的行结构，描述为纯文本并在按钮内折行。 | [#399](https://github.com/AltanS/collie/pull/399)、[d80253ce](https://github.com/AltanS/collie/commit/d80253ce) |
| 1.19.2 未识别界面卡片 | 内嵌终端正文遵循设备的 Wrap lines 设置；开时折行，关时横向浏览。 | [#372](https://github.com/AltanS/collie/issues/372)、[d80253ce](https://github.com/AltanS/collie/commit/d80253ce) |
| 1.19.2 Muse 提交 | Muse 在文字写入后等待至少 350ms 再发受保护的 Enter；验证已耗时足够则不再等待，其他智能体没有新增固定延迟。 | [#395](https://github.com/AltanS/collie/issues/395)、[2089b132](https://github.com/AltanS/collie/commit/2089b132) |
| 1.19.2 iPhone 高度 | 独立 PWA 的 CSS 高度改为 `min(100lvh, 100dvh + 顶部安全区)`，兼顾不同 WebKit 的高度偏大／偏小问题；上游明确尚未用真机验证该修复。 | [#394](https://github.com/AltanS/collie/issues/394)、[7a994d31](https://github.com/AltanS/collie/commit/7a994d31) |
| 1.19.2 Canary | 上游 transport 在读取成功后更新存活标记，避免离线保护拒绝全部测试发送；本 fork 已通过真正的客户端读取路径解决同一问题，见下节。 | [#397](https://github.com/AltanS/collie/issues/397)、[fee6f273](https://github.com/AltanS/collie/commit/fee6f273) |

## 文档、测试与打包

同步接收对应文档和回归样本，没有升级依赖或恢复本 fork 的发布工作流。

- 更新 ADR 0010 的按适配器延迟提交约定、omp 描述解析边界、macOS 统计说明，以及配对／升级／部署文档。
- 增加 opencode 两题向导和叠层的浏览器用例、隔离实测脚本与触发文本；脚本不自动执行。
- 增加 omp 18.8.0／18.8.7 的描述样本，更新十二种语言的复制反馈与弹窗发送提示，并修正土耳其语用词。
- 增加剪贴板回退、复制内容、描述折行、高度 token、帮助命令和内存统计测试；CLI bundle 测试固定 Git 的 C locale。
- 接收上游 AUR／Nix 包装源记录对 1.19.1 的更新；下游仍只发布代码与注解标签，不发布二进制或 GitHub Release。

## 下游处理

本次没有整块替换下游功能，采用兼容的上游修复并保留已确认的交互。

- Keys 仍完全使用上一轮选择的上游面板和编辑器，Type 为独立开关。
- 保留紧凑操作带、Quick／Agent／Display 弹层、字体、图标，以及 Codex／Claude／Hermes 定制卡片。
- 未识别界面仍是紧凑提示加 Esc；明确识别的原生页面仍在固定高度卡片中浏览。新增 Wrap lines 透传到卡片正文，不恢复上游的大提示卡。
- 保留发送操作租约、AbortSignal 和旧草稿身份校验；Muse 新增等待前后均检查取消，防止用户取消后继续发送 Enter。
- 保留本地通用失败提示措辞，新增上游针对弹窗／菜单占用键盘的具体提示。
- 采用上游 CSS 高度 token；保留已通过 iPhone 实测的根滚动锁和 `visualViewport` 高度／偏移同步。实际 app 高度仍由视口同步控制，不用未经本机真机复测的 CSS 替换这层处理。
- Canary 保留发送前调用真实 `api.fetchPane` 的实现，不叠加上游手动 `markLive` 回调。真实读取仍建立客户端存活状态，离线保护不被旁路。
- 适配目录补入 omp 描述样本并标明样本回放；不把这些证据写成当前 CLI 实测。

## 验证

按受影响范围验证，并执行仓库要求的发布检查。

- Bridge：5,405 项通过；CLI 与 scripts：2,237 项通过，47 项按平台跳过。
- 全前端：427 文件、25,573 项通过；另有 33 项预期失败、73 项 todo。
- 适配目录样本回放通过；新增取消发生在 Muse 延迟期间时不发送 Enter 的用例。
- 本机实际 `vm_stat` 读取及解析成功，Apple Silicon 页大小为 16,384 字节；一次采样约 4ms。64GiB 主机新算法为 37.24GiB，原算法为 62.06GiB；这是瞬时采样，未与 Activity Monitor 同时截图对照。
- 根目录／Web 类型检查、全仓 lint、正式构建、编译后二进制与宿主机发布脚本检查通过。
- Chromium／WebKit 共 16 项浏览器检查通过，覆盖高度 token、操作带边界、opencode 两题向导，以及 320／1280px 的 Claude 卡片。Wrap 开关分别验证折行和双向滚动，卡片高度及 Esc 位置保持稳定；保存截图。未重跑整套历史 E2E，也未重跑未变更的 Crew 双桥集成。
- 未新增模型调用，未执行 iPhone 真机或 Windows 运行验证；浏览器仿真不能证明独立 PWA 的真机安全区表现。
