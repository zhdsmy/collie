# 上游 v1.15.3 跟进报告

下游基线：`v1.15.2+collie.1`。目标版本：`v1.15.3+collie.1`。

核对范围为上游 `v1.15.2..v1.15.3`：13 个提交、95 个文件，新增 2000 行、删除 582 行；多数文件变化用于跨平台测试。已交叉核对 [Release](https://github.com/AltanS/collie/releases/tag/v1.15.3)、[CHANGELOG](https://github.com/AltanS/collie/blob/v1.15.3/CHANGELOG.md) 与 [完整差异](https://github.com/AltanS/collie/compare/v1.15.2...v1.15.3)。

## 上游变化

- **Changes 正确处理主机平台路径。** Windows 盘符、UNC 路径、扩展路径前缀和大小写纳入工作目录与仓库归属判断；继续禁止扫描磁盘根目录、用户主目录及其上级。macOS 通过 `/tmp`、`/var` 符号链接到达的目录，也能正确映射到仓库。[`f70595f8`](https://github.com/AltanS/collie/commit/f70595f8)
- **Windows 安装、启动与更新识别 `.exe`。** 工具的绝对路径查找支持可执行文件后缀；链接、安装目录、启动配置、停止进程检查、更新后的 hooks 提示及候选版本冒烟测试，共用平台对应的 `collie`／`collie.exe` 路径。版本目录符号链接的目标按 Windows 自身路径规则解析与比较。[`f70595f8`](https://github.com/AltanS/collie/commit/f70595f8)、[`20d1e6d5`](https://github.com/AltanS/collie/commit/20d1e6d5)
- **Crew 邀请使用真正可达的 HTTPS 地址。** 默认经 `tailscale serve` 发布的 lead，`crew add` 和 `crew invite` 提供 `https://完整域名`，让成员连接 443，避免把裸主机名解释为内部 8787 端口。自定义前门端口继续明确列出端口；HTTP 模式仍使用短主机名和相应监听端口。显式 `COLLIE_PUBLIC_URL` 仍优先。[PR #334](https://github.com/AltanS/collie/pull/334)、[`228f65ee`](https://github.com/AltanS/collie/commit/228f65ee)
- **Crew 成员地址必须带端口。** `crew join --address` 在读取 token、创建信任记录前拒绝缺少端口的地址；仍兼容 `https://host:8787`，保存为 `host:8787`。无端口的 HTTPS 地址和 `http://` 地址被拒绝。`crew status` 与 `doctor` 对存量错误地址提供具体的 `crew set-address` 修复命令，不自动改写存量配置。[`228f65ee`](https://github.com/AltanS/collie/commit/228f65ee)、[`58cd66af`](https://github.com/AltanS/collie/commit/58cd66af)
- **TLS 连接失败更容易定位。** 分别说明对端证书不属于已固定的成员、证书名称不匹配、证书过期或尚未生效；仍保持原来的证书固定与认证检查。[`228f65ee`](https://github.com/AltanS/collie/commit/228f65ee)
- **omp 空编辑器提示不再冒充草稿。** omp 18.4 的思考强度提示和后台智能体提示，按右对齐、前导留白及斜体标签等样式识别，覆盖 boxed、rule、pi 三种输入框，避免错误显示“Draft in terminal”和 Take over。真实草稿与补全建议继续走原有解析。新增四份真实 ANSI 样本：思考强度提示来自 18.4.4，后台智能体提示来自 18.4.10；这不是整个新版本 CLI 的完整认证。[Issue #320](https://github.com/AltanS/collie/issues/320)、[`e3887c1d`](https://github.com/AltanS/collie/commit/e3887c1d)、[`73f417cd`](https://github.com/AltanS/collie/commit/73f417cd)

## 文档、测试和构建工具

- Crew 文档与协议说明同步前门地址、成员地址和加入命令；没有改变 Crew 协议版本或放宽认证。[`228f65ee`](https://github.com/AltanS/collie/commit/228f65ee)
- omp 样本说明、适配器头注释和验证台账记录上述有限覆盖；journal 的验证版本独立保留。[`487f70b0`](https://github.com/AltanS/collie/commit/487f70b0)
- CLI 假文件系统的 Map／Set 统一 Windows 与 POSIX 路径表示；测试明确平台、目录分隔符、权限位与换行符，不再依赖开发机的隐含行为。新增 Windows 路径正反例，并保留 POSIX 规则回归。[`2f01175a`](https://github.com/AltanS/collie/commit/2f01175a)、[`83557f24`](https://github.com/AltanS/collie/commit/83557f24)、[`5a527965`](https://github.com/AltanS/collie/commit/5a527965)、[`5fc8fc20`](https://github.com/AltanS/collie/commit/5fc8fc20)
- `.gitattributes` 要求 shell 脚本使用 LF，防止 Windows checkout 的 CRLF 损坏安装器及远程 POSIX 安装；canary 的文件 URL 改用 `fileURLToPath`。更新冒烟实验先启动新编译的可执行文件一次，避免 Windows 首次安全扫描影响用例计时。[`5a527965`](https://github.com/AltanS/collie/commit/5a527965)、[`e8e6688c`](https://github.com/AltanS/collie/commit/e8e6688c)
- 上游同步三个版本文件与 CHANGELOG 至 1.15.3；未引入依赖、打包渠道或 UI 布局变更。[`033bf1f5`](https://github.com/AltanS/collie/commit/033bf1f5)

## 下游取舍

本次没有下游功能被上游替换。冲突仅涉及版本／CHANGELOG 和测试导入、换行处理，已机械合并。

保留 Codex、Claude、Hermes、Cursor 适配、状态栏按钮、Settings／Agents 卡片、紧凑操作带，以及 Quick／Agent／Display 统一底部面板和 Agent 默认五项布局；这些区域没有上游改动。保留现有 canary 卡片与截图功能、会话模型字段协议说明，以及禁止自动 GitHub Release 的测试。新增 `omp.composer-hints` 适配记录，复用上游样本和既有测试，没有新增监测任务。

## 本地验证与边界

- 变更涉及的后端、CLI、脚本及适配目录检查：64 个文件、2735 项通过，0 失败，包括本机真实编译候选版本的更新冒烟测试。
- omp 解析、三种输入框与发送路径、验证台账等前端检查：7 个文件，1673 项通过、11 项 todo；todo 是原有能力／覆盖边界，不算通过。
- 根与 Web 类型检查、全仓 lint 通过。正式构建在干净的版本标签提交执行。
- Windows 分支由平台参数与路径用例验证，未在 Windows 系统实测；Crew 使用隔离测试验证，未创建或改动真实成员；omp 使用上游捕获样本回放，未进行本机模型请求或全版本 live 认证。
- 本次没有界面布局改动，未重复运行无关的手机面板和全量卡片浏览器回归，也未新增截图工具或依赖。
