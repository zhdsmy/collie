# v1.10.0 上游合并说明

目标下游版本：`v1.10.0+collie.1`。本次核对上游 Release、CHANGELOG、17 个提交及完整文件差异；没有需要重新选择的功能冲突，也没有用上游替换下游专属功能。

## 核对范围

| 项目 | 固定引用 |
| --- | --- |
| 上游起点 | `v1.9.1`，`6fb0f1f511f976a1cef246e945d94b29e2331c2f` |
| 上游终点 | `v1.10.0`，`7652ed5f05a2e9e9e9c3d3734ec48ef6dcd51e99` |
| 上游 annotated tag object | `d56ce8d5550279b01bc46b0d0c4d873435b8aa79` |
| 下游合并前 | `v1.9.1+collie.13`，`c4c6ae4266e231204bf3ca8afa2782ba70d85abe` |
| 发布说明 | [v1.10.0](https://github.com/AltanS/collie/releases/tag/v1.10.0)，2026-09-16 |
| 完整差异 | [v1.9.1...v1.10.0](https://github.com/AltanS/collie/compare/v1.9.1...v1.10.0)：17 commits、79 files、+3167 / -501 |

## 上游完整变更

### Dashboard、工作区与命名

- **窗格保持原位。** 过去按 Needs you／Ready unseen 等状态分组，状态变化会移动卡片；现在按工作区、终端标签页和窗格顺序显示，阻塞状态通过红色背景与标记提示。
- **状态汇总可点击筛选。** 汇总行及工作区标题显示 blocked、unseen、working、done、idle 计数，计数入口筛选相应状态。
- **工作区 chips 支持筛选和隐藏。** 点击只看一个工作区，再点或选 All 恢复全部；长按隐藏／恢复。隐藏项仍以淡色删除线显示状态，偏好按工作区名称保存在当前设备，重启后继续生效。
- **未读完成回复改为方形标记。** 之前是白点与绿色背景，现在在窗格名、汇总、工作区标题及 chip 使用小方块，避免与 Agent 状态混淆。
- **用户命名优先。** 只有一个窗格的标签页，若名称由用户指定，会优先于 Agent 自动标题作为窗格名；显式 `/rename` 窗格名仍优先。影响 Dashboard、标题、标签栏与通知，Agent 自动标题可放到第二行。tmux 自动窗口名、默认位置名不当作用户命名。
- **标签栏更清楚地标识当前窗格。** 单窗格标签使用窗格名，当前标签加下划线，其他标签保持较高文字对比度；去掉标签单元内品牌块及桌面焦点虚线圈。
- **切换窗格图标增加红点。** 只有其他窗格等待用户处理时才标红，当前窗格自己的阻塞不点亮；辅助阅读名称同步提示。

对应提交：[a039e277](https://github.com/AltanS/collie/commit/a039e277)、[8962e695](https://github.com/AltanS/collie/commit/8962e695)、[eb7470d1](https://github.com/AltanS/collie/commit/eb7470d1)。相关界面文案同步至仓库支持的语言。

### 状态目录与升级可靠性

- **Herdr action 与服务读取同一份 Collie 状态。** 不再使用 Herdr 注入的 `HERDR_PLUGIN_STATE_DIR`；显式 `COLLIE_STATE_DIR` 仍优先，否则使用正常用户状态目录。修复 `push-test` 找不到订阅、action 发起的升级进度在手机上不可见等分裂。旧目录中的状态不会自动迁移。[#226](https://github.com/AltanS/collie/pull/226)
- **目标已运行时升级立即成功返回。** 在探测 Bun、创建 staging 记录之前判断，不再留下会被手机误报为中断的记录；不完整的当前目标仍拒绝不安全的重复 staging。[#231](https://github.com/AltanS/collie/pull/231)
- **修改 checkout 前验证 Bun 能运行。** managed／staged 路径先执行有超时的 `bun --version`。只有安装路径但程序无法运行时，升级检查从警告变成阻断，crew 升级也等待修复，避免先切代码后构建失败。[#232](https://github.com/AltanS/collie/pull/232)
- **CLI 编译使用本次调用独占目录。** 新的 `scripts/build-cli.ts` 在真实 `bin/` 目录内创建编译沙箱，验证产物与清理后再发布二进制；拒绝符号链接 `bin/` 和未支持的额外参数，防止 Bun 临时产物逃到仓库根目录。根目录 `build:cli`、上游 Release 工作流及 AUR 验证说明改用同一入口。下游只采用构建入口，继续不保留工作流。

### Muse 镜像

- **去掉 Muse 自带的两列 gutter 和行尾补齐。** 手机段落不再因为这些装饰出现额外缩进或空白短行；检测器继续读取未裁剪原始行。仅应用于 Muse，没有恢复 Codex 的推测式硬换行拼接。[#230](https://github.com/AltanS/collie/pull/230)
- **浅色原生背景使用实测颜色。** 从 `#f5f5f5` 改为 Herdr 0.9 实测的 `#fffbf8`，保持 Muse 输入底色及其他原生颜色的对比；其他宿主主题不保证逐像素一致。[#229](https://github.com/AltanS/collie/pull/229)

### 兼容、文档、打包与测试

- 窗格数据增加可选的 `soleTabName`、`tabPosition`，Herdr／tmux／zellij 适配器和前后端类型同步；旧 peer 缺少字段时保留回退处理，不要求同步升级所有节点。
- 配置优先级 ADR 和 crew 协议文档明确 Collie state 路径规则；Muse ADR 保留原决策历史并限定颜色保真范围；README 的 Dashboard 图片说明更新为窗格原位展示。
- AUR 的 PKGBUILD／`.SRCINFO` 与 Nix source 元数据从官方 1.8.2 跟进到官方 **1.9.1**，这是上游 v1.10.0 tag 实际包含的打包状态，不擅自改成下游版本。
- 新增／扩展 Dashboard 排序、状态计数、工作区持久化、命名、切换器提示、Muse、Bun 构建与更新测试；CLI shell 集成测试隔离调用者 Git 配置、签名、hooks 和 detached runner 环境，防止污染真实 checkout。

## 合并取舍

| 部分 | 本次处理及用户可见差异 |
| --- | --- |
| Dashboard、命名、状态目录、升级、Muse | 接受上述上游实现；这些是现有上游行为的升级，没有替换下游专属功能。 |
| Composer | 保留按键合并入输入、点击输入不自动弹键盘，以及当前尺寸和配色。 |
| 终端显示 | 保留本地输入／diff 矩形底色、等留白与已合并的上游亮度识别；Codex 换行仍跟随上游。 |
| 输入及 Agent 卡片 | 保留输入可靠性保护、Codex QA／Plan／审批／review／resume 等卡片、模型和思考等级切换，以及 Claude／Hermes 适配。保留 Hermes 历史／启动信息提取排版与统一界面字体。 |
| Statusline、字体与手机布局 | 保留紧凑状态项、context 圆环、模型快捷切换、字体选项和底部安全区延伸；本次没有改动这些本地设计。 |
| Workflow | 上游修改了已被下游删除的 Release 工作流，继续保持删除；不创建 GitHub Release。 |
| 版本与历史 | 保留完整下游 CHANGELOG；功能合并提交不提前改版本，随后独立发布提交统一三个版本文件为 `1.10.0+collie.1`。 |

Git 冲突仅涉及已删除 workflow、CHANGELOG、三个版本文件和 CLI shell 测试，均为机械合并。没有需要用户选择的功能取舍。

本地测试适配：构建测试改为断言下游未启用 Release workflow，其余构建安全检查保留；ActionsRow 测试去掉与已有纯底色设计冲突的旧断言；CLI 隔离启动桩在 macOS 使用 setsid 路径，复用 Linux 的 Git 环境注入，生产环境白名单不放宽。

## 17 个上游提交

| 提交 | 内容 |
| --- | --- |
| [11227621](https://github.com/AltanS/collie/commit/11227621) | AUR／Nix 跟进官方 1.9.1 |
| [d07ec4c4](https://github.com/AltanS/collie/commit/d07ec4c4) | Herdr action 状态目录修复 |
| [a039e277](https://github.com/AltanS/collie/commit/a039e277) | Dashboard 原位展示、筛选、计数、命名 |
| [a18827d5](https://github.com/AltanS/collie/commit/a18827d5) | 已 staged 目标的记录收尾 |
| [d67f48b5](https://github.com/AltanS/collie/commit/d67f48b5) | Muse 行装饰裁剪 |
| [8c7236d5](https://github.com/AltanS/collie/commit/8c7236d5) | Muse 注释整理 |
| [cc76e9bf](https://github.com/AltanS/collie/commit/cc76e9bf) | Muse 原生浅色背景 |
| [0233ed4a](https://github.com/AltanS/collie/commit/0233ed4a) | Muse ADR 历史和保真范围 |
| [53e2f462](https://github.com/AltanS/collie/commit/53e2f462) | Bun 探测及编译隔离 |
| [df37dbca](https://github.com/AltanS/collie/commit/df37dbca) | 编译测试保护、heredoc 注释整理 |
| [32a43508](https://github.com/AltanS/collie/commit/32a43508) | 汇总四项修复至 CHANGELOG |
| [461f5a1d](https://github.com/AltanS/collie/commit/461f5a1d) | 更新测试补齐 Bun 探测 |
| [f993596e](https://github.com/AltanS/collie/commit/f993596e) | already-live 判断前移 |
| [8962e695](https://github.com/AltanS/collie/commit/8962e695) | 用户命名识别、排序及偏好持久化 |
| [eb7470d1](https://github.com/AltanS/collie/commit/eb7470d1) | 其他阻塞窗格红点 |
| [c1aa8a13](https://github.com/AltanS/collie/commit/c1aa8a13) | README Dashboard 图片说明 |
| [7652ed5f](https://github.com/AltanS/collie/commit/7652ed5f) | 发布 1.10.0 |

## 验证范围

按影响范围运行 bridge／CLI／构建和 web 定向测试、lint、根目录与 web 类型检查。手机 Chromium 与 WebKit 运行 smoke、belt、Hermes history 三个 spec，共 14 项通过，并检查 Hermes 卡片截图。它们使用模拟 API，不向用户真实会话发送消息，也不等同于本轮完成 USB 真机 PWA 验证。

编译测试、ActionsRow 测试和 macOS CLI 环境探针遇到的差异按上述原因定向修复、复跑通过；CLI shell 集成在主机环境通过，沙箱内无法建立测试用回环监听器。没有因上游合并重写产品逻辑或放宽安全边界。发布使用根目录 `bun run build` 生成 CLI 和前端；只推送 main 与对应 annotated tag，本机安装保留旧二进制、前端及旧静态资源，重启仅限 Collie。实际部署结果以本轮本地／访问地址的 build ID、SHA、HTTP 状态与监听进程回读为准。
