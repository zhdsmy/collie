# v1.23.3 合并记录

从 `1.23.2+collie.10` 跟进至 `1.23.3+collie.1`。已交叉核对[官方发布说明](https://github.com/AltanS/collie/releases/tag/v1.23.3)、[标签内 CHANGELOG](https://github.com/AltanS/collie/blob/v1.23.3/CHANGELOG.md#1233---2026-10-22) 和 [v1.23.2…v1.23.3 完整差异](https://github.com/AltanS/collie/compare/v1.23.2...v1.23.3)：共 4 个提交、12 个文件，包含发布提交。没有产品界面、发送协议、新依赖或 lockfile 变化。

## 全部上游变化

| 范围 | 变化与实际影响 |
| --- | --- |
| Bun 安全构建 | 上游下载二进制、Nix 包及 Windows zip 的构建运行时统一到 Bun 1.4.4。该版本拒绝受影响的 eMudhra 中间证书；上游指出旧运行时可能在不可信网络接受伪造的更新下载。[#568](https://github.com/AltanS/collie/issues/568)、[实现](https://github.com/AltanS/collie/commit/7049ab87) |
| 源码更新预检 | 最低建议 Bun 从 1.4.0 提升到 1.4.4。1.3.14、1.4.1 等旧版本显示 amber 警告，1.4.4 显示 green；仍然是警告，不新增强制拒绝。更新流程及探测备用 Bun 路径的测试同步使用新版本。[实现](https://github.com/AltanS/collie/commit/7049ab87) |
| Nix 构建 | `flake.nix` 将 Bun 固定为 1.4.4，并更新 macOS ARM、Linux ARM、Linux x64 baseline 三份归档的哈希。nixpkgs revision 和 `flake.lock` 保持不变。[实现](https://github.com/AltanS/collie/commit/7049ab87) |
| Node 下的前端测试 | Vitest 共用 worker 配置加入 `--no-experimental-webstorage`，避免 Node 25+ 自带的存储对象遮蔽 jsdom 的 `localStorage`；配置同时覆盖 logic 和 DOM 项目，不依赖启动器环境变量。[实现](https://github.com/AltanS/collie/commit/cb96a1fe) |
| 上游 CI | CI 和 Windows workflow 的 Bun 固定到 1.4.4；WebKit runner 从 `ubuntu-latest` 固定为 `ubuntu-24.04`，浏览器缓存键加入该系统版本，避免跨系统复用。按本仓库既有决定，继续不恢复 `.github/workflows/`。[Bun 提交](https://github.com/AltanS/collie/commit/7049ab87)、[WebKit 提交](https://github.com/AltanS/collie/commit/5a4ad357) |
| 发布元数据 | 上游同步三个版本文件及 CHANGELOG 到 1.23.3；本分支使用 `1.23.3+collie.1`，只推送代码和 annotated 标签，不创建 GitHub Release。[发布提交](https://github.com/AltanS/collie/commit/5bb4233b) |

本机在升级前已经使用 Bun 1.4.4，本次继续用它从源码构建。因此不能把上游旧下载产物的风险直接当成本机上一版仍存在的漏洞，也没有通过不可信证书场景重新演练该修复。

## 下游取舍

没有产品功能的下游实现被替换。仅删除 Vitest DOM 项目里重复的 `execArgv` 设置，改用上游共用 worker 配置：DOM 保持原有存储保护，logic 同时获得保护，不改变浏览器中的用户行为。

保留 Codex Model／Resume／Agents 等卡片、Queue／Steer 设置及立即引导、warning 数量和模型切换保护；保留 Claude Settings／Agents、Hermes 上游 composer 与本地历史／提示、AGY Model／Resume／权限卡片、后台任务识别、专用状态栏及 Chat／History。继续保留上一版的状态图标排序、剩余上下文圆环、额度分组和 5h／7d 表示、Input 内按键区与草稿缓存、字体／紧凑操作带／tab 图标、Cursor journal 和适配目录。这些功能未与本次上游变更重叠。

## 验证与交付

- 更新预检、更新流程和 Bun／Nix 版本约束共 347 项测试通过。
- 清除外部 `NODE_OPTIONS` 后，字体设置的 7 项 DOM 存储测试通过，确认 worker 共用配置生效。
- 两侧类型检查、lint 和差异空白检查通过；正式发布按版本一致性、标签构建和本机部署流程验收。
- 本机部署只重启 Collie，验收 build、health、config、snapshot 和发布说明，保留最近一个完整回滚包。公网有 OAuth，按用户约定仅从本机验收。

这次没有改动界面和 harness，因此不重跑整套卡片／浏览器回归或调用模型。没有进行 Nix 实机构建、Windows 运行验证、实际恶意证书连接或真机 iOS 测试；不发布 Windows 产物，不重启 Herdr、Headroom 或用户 Agent 会话，不启用定时巡检。
