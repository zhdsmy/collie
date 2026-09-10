# v1.8.0 上游合并记录

本次从 `v1.7.0+collie.1` 合入上游 `v1.8.0`，下游交付版本为 `v1.8.0+collie.1`。

## 核对范围

本报告交叉核对官方 Release、CHANGELOG 和实际标签差异，包含发布摘要之外的兼容性、工具及文档变化。

- [上游 Release](https://github.com/AltanS/collie/releases/tag/v1.8.0)，发布于 2026-09-09 16:32 UTC。
- [上游 CHANGELOG](https://github.com/AltanS/collie/blob/v1.8.0/CHANGELOG.md)。
- [完整标签差异](https://github.com/AltanS/collie/compare/v1.7.0...v1.8.0)：48 个提交（包含合并提交），343 个文件，新增 13410 行、删除 6740 行。
- 上游标签落在 [360f98e7](https://github.com/AltanS/collie/commit/360f98e7)。下文按最终行为归类；CHANGELOG 中“仅重命名代码、尚未改协议”的描述属于中间提交，不能当作整个 1.8.0 的状态。

## Crew 协议、状态和兼容性

1.7.0 改了用户看到的名称，1.8.0 进一步统一机器协议、环境变量和持久化状态；多主机应先升级 lead。

| 范围 | 完整变化与使用影响 | 来源 |
| --- | --- | --- |
| 协议版本 | `CREW_PROTOCOL_VERSION=2`；请求路径改为 `/crew/v1/*`，请求头改为 `X-Crew-*`。路径中的 `v1` 不等于协议协商版本。签名上下文改为 `collie-crew-warrant-v2`、`collie-crew-dial-v2`。 | [305c3291](https://github.com/AltanS/collie/commit/305c3291) |
| 滚动升级窗口 | 1.8 lead 在一个版本内仍响应 `/pack/v1/*` 和 v1 数据形状；1.8 peer 遇到旧 lead 会退回旧前缀。兼容代码标注 `REMOVE_IN_1_9_0` 并有移除约束测试。1.9 将移除旧协议兼容，不能长期混用 1.7 和新版本。 | [305c3291](https://github.com/AltanS/collie/commit/305c3291) |
| 真实旧版响应 | 回退不仅识别 404、带 v1 协议头的 403，也识别 1.7 对未知路径实际返回的 200 HTML 应用外壳；每个 lead 只记录一次回退日志。 | [c0fc789a](https://github.com/AltanS/collie/commit/c0fc789a)、[114be1ef](https://github.com/AltanS/collie/commit/114be1ef) |
| 协议字段 | warrant、备用设备同步和 enrollment 响应改用 `crewId`；兼容读取旧 `packId`，不改变原有授权含义。其余类型、响应及错误字段也同步改名。 | [46c89f56](https://github.com/AltanS/collie/commit/46c89f56)、[ffd4ddec](https://github.com/AltanS/collie/commit/ffd4ddec) |
| 环境变量 | `COLLIE_CREW_TIMEOUT_MS`、`COLLIE_CREW_HELLO_TIMEOUT_MS` 替代对应 `COLLIE_PACK_*`。新键缺省才读取旧键，并输出弃用提示；旧键兼容计划在 1.9 移除。 | [c529e3fd](https://github.com/AltanS/collie/commit/c529e3fd) |
| 磁盘文件迁移 | 首次实际打开存储时，将 `pack-trust.json`、`pack-ops.json`、`pack-runtime.json` 改为对应 `crew-*.json`；如果新文件已存在，新文件优先。存储内容兼容旧字段，后续写入新字段。 | [c529e3fd](https://github.com/AltanS/collie/commit/c529e3fd) |
| 日志和 API | 日志前缀变为 `[crew]`，转发操作审计为 `via: "crew"`，新 API 为 `/api/crew`；旧 `/api/pack` 暂时 308 重定向。已有历史日志不会重写。 | [c529e3fd](https://github.com/AltanS/collie/commit/c529e3fd) |
| 更新 JSON 与收起状态 | `/api/update/check` 以及 `collie update --check --json` 改用 `crew`；更新收起范围和持久化键改用 `crew`、`dismissedCrewVersion`，兼容读取旧 `dismissedPackVersion`。读取 JSON 的自有脚本应更新字段。 | [e07846e4](https://github.com/AltanS/collie/commit/e07846e4) |
| 操作别名 | `collie pack`、旧 `/pack` 页面及 `collie docs pack` 仍作为兼容入口保留到 2.0；它们的保留期限与 1.9 移除的机器协议兼容不同。 | [73205813](https://github.com/AltanS/collie/commit/73205813)、[12c746f7](https://github.com/AltanS/collie/commit/12c746f7) |
| 内部命名 | `bridge/pack` → `bridge/crew`，CLI、路由、provider、组件、测试、类型、函数、常量和七种语言翻译键统一为 crew。旧逻辑的调用方一起迁移。 | [12c746f7](https://github.com/AltanS/collie/commit/12c746f7) |

本机检查未发现上述三类旧／新 crew 状态文件，也没有配置这组旧环境变量，因此本次单机部署没有成员名册需要迁移。`update-state.json` 继续由上游兼容逻辑读取。

> **Note.** 已建立 crew 的其他安装若回退到 1.7，需恢复旧状态文件名，并在 trust 文件中恢复 `pack`／`packId` 字段；只切回旧二进制不足以回退状态迁移。具体步骤见上游 [升级说明](https://github.com/AltanS/collie/blob/v1.8.0/docs/upgrading.md)。

## 更新流程与 PWA 恢复

上游修复了成员更新路线覆盖无效，以及 PWA 反复刷新仍加载旧外壳的问题。

| 范围 | 完整变化与使用影响 | 来源 |
| --- | --- | --- |
| 协议变更提示 | 官方 Release 新增 `collie-release.json`，包含 `version`、`crewProtocol`。crew 安装最多等待 3 秒读取它；失败不会阻止更新，单机不增加这项请求。不同协议版本会在更新横幅、Updates 确认区和每日通知中提示先升级 lead。 | [f39cbddc](https://github.com/AltanS/collie/commit/f39cbddc) |
| 修复成员预检查 | `collie crew update <member>` 的 `--host`、`--path`、`--port` 现在进入预检查阶段；此前预检查仍使用旧记录，导致按提示输入新路径也无法修复检查失败。 | [03eb7a87](https://github.com/AltanS/collie/commit/03eb7a87) |
| PWA 旧外壳逃生 | 八秒卡住保护触发刷新时，在 sessionStorage 留下记录；若刷新后仍旧，下一次点击清除缓存、开始注销 worker 并重新联网加载，不等待可能卡死的 worker 队列。只有普通 bridge 轮询在近 20 秒内证明在线才执行，离线时保留可用缓存。 | [bb095e3a](https://github.com/AltanS/collie/commit/bb095e3a) |

`web/src/lib/pwa.ts` 完整采用上游实现。本仓库仍只推提交和 tag，不创建 GitHub Release，因此没有为下游额外发布 `collie-release.json` 资产；缺失资产不会成为更新门禁。

## Hermes 历史与 OMP 输入

Hermes 成为第六个历史适配器；OMP 多行输入采用逐段回读确认，其他 harness 保持各自的发送路径。

| 范围 | 完整变化与使用影响 | 来源 |
| --- | --- | --- |
| Hermes 数据源 | 只读 `~/.hermes/state.db`，支持 `COLLIE_HERMES_ROOT`；使用 Herdr 给出的精确时间戳格式 session ID，不猜测“最新会话”。固定数据库名受根目录检查保护。 | [85e0da5e](https://github.com/AltanS/collie/commit/85e0da5e) |
| Hermes 内容 | 最多追溯 32 层父会话，包含压缩前后历史、用户／助手正文、推理和工具部分；过滤隐藏及未压缩的非活动消息，限制文本和总字节数。适配器注册、前端支持列表、根目录计数及 lint 边界同步更新。 | [85e0da5e](https://github.com/AltanS/collie/commit/85e0da5e)、[33f54224](https://github.com/AltanS/collie/commit/33f54224)、[801f879a](https://github.com/AltanS/collie/commit/801f879a) |
| Pi composer 识别 | 为 OMP 18.1.13 声明 `composer.shape=pi`；识别样式边框和 footer，排除弹窗、菜单和普通分隔线，避免把错误区域当作草稿。 | [47369fb4](https://github.com/AltanS/collie/commit/47369fb4)、[#192](https://github.com/AltanS/collie/pull/192) |
| 未接受的补全 | 韩文及其他行内 ghost completion 不再被算作已输入内容；不透明粘贴 chip 不能证明草稿内容，也不能用于接管输入。 | [47369fb4](https://github.com/AltanS/collie/commit/47369fb4) |
| 多行分段发送 | 按字素分段，目标上限为 512 个 UTF-16 单位、每段最多五行；规避新段以 `/`、`~`、`.` 开始触发路径补全空格。分段拼接必须精确还原原文。每段都验证草稿变化、累计内容和结尾，最后完整确认后才按一次 Enter。 | [47369fb4](https://github.com/AltanS/collie/commit/47369fb4) |
| 重试与回归 | 回读可以重试，不重复发送已确认传输的粘贴内容；未声明分段策略的 harness 仍为单次粘贴。新增韩文、多行、emoji、CRLF、丢失末段及传输失败测试，感谢 SeongQ kim，关闭 [#34](https://github.com/AltanS/collie/issues/34)。 | [47369fb4](https://github.com/AltanS/collie/commit/47369fb4)、[42e5b4a0](https://github.com/AltanS/collie/commit/42e5b4a0) |

本机已用新 Hermes 适配器只读定位一个真实会话并成功解析 6 条历史记录；数据库没有被修改。这个检查验证数据源兼容性，不代替所有 Hermes 会话的手机端验证。

## 浏览器测试、工具、文档和打包

上游新增真实浏览器测试层并完善 crew 迁移文档；下游保留测试能力，但不恢复 GitHub Actions。

| 范围 | 完整变化与使用影响 | 来源 |
| --- | --- | --- |
| Tier 1 浏览器测试 | 引入 `@playwright/test ^1.62.1`，四个项目分别覆盖 app／playground、390×844 手机／820×1180 平板。API 使用既有测试 fixture，真实构建后打开 Chromium；新增配置、脚本、TS 检查范围和产物忽略规则。 | [051b30e2](https://github.com/AltanS/collie/commit/051b30e2)、[4e7b380e](https://github.com/AltanS/collie/commit/4e7b380e) |
| Playground 定位 | 每张状态卡新增仅开发环境的稳定 `data-state`，测试验证唯一性、完整性和可访问操作入口；这些卡不会进入正式 app bundle。 | [48286a70](https://github.com/AltanS/collie/commit/48286a70)、[9eeb934b](https://github.com/AltanS/collie/commit/9eeb934b) |
| 十三项场景 | 七项终端图片测试覆盖占位图、缺失／404、不支持 URL、图文混排和搜索定位；六项 crew 场景覆盖页面、旧别名跳转、Settings／footer 和日语。 | [1448b1a7](https://github.com/AltanS/collie/commit/1448b1a7) |
| 七项 worker 场景 | 用两个不同真实 bundle 验证手动／自动更新、安装未完、代理登录路径绕过缓存、worker 获取失败、连续点击和卡住保护后的恢复。worker 场景只跑手机项目，平板重复项明确跳过。 | [bb095e3a](https://github.com/AltanS/collie/commit/bb095e3a) |
| 测试边界 | Tier 2 为 `make e2e` 只读开发实例检查，禁止 CI，也不能指向生产；Tier 3 多机 VM 实验室仍是规划。失败保存截图、重试保存 trace，没有引入像素基线测试。 | [47afc2d6](https://github.com/AltanS/collie/commit/47afc2d6)、[2221ae8c](https://github.com/AltanS/collie/commit/2221ae8c) |
| 上游 CI／发布 | 官方 CI 增加浏览器 job 和失败产物上传；发布流程生成协议元数据。本次不恢复下游已删除的 CI、release、triage workflows，所有验证在本机运行。 | [051b30e2](https://github.com/AltanS/collie/commit/051b30e2)、[f39cbddc](https://github.com/AltanS/collie/commit/f39cbddc) |
| 脚本和守卫 | `check-pack-wire.sh` → `check-crew-wire.sh`，`pack-mux-probe.ts` → `crew-mux-probe.ts`，根测试命令改为 `test:crew`，提交守卫开关改为 `SKIP_CREW_WIRE_CHECK`；对应测试和引用一起迁移。 | [12c746f7](https://github.com/AltanS/collie/commit/12c746f7)、[ba442aee](https://github.com/AltanS/collie/commit/ba442aee) |
| 操作与贡献文档 | README、CLAUDE、CONTRIBUTING 补充测试层次、命令、加测试和失败排查；crew、deployment、upgrading 说明升级顺序、兼容窗口、回退、变量及状态迁移；ARCHITECTURE、MUX 文档和 ADR 引用同步。修复并行合并导致的三个文档标题问题。 | [2221ae8c](https://github.com/AltanS/collie/commit/2221ae8c)、[17f181d7](https://github.com/AltanS/collie/commit/17f181d7)、[114be1ef](https://github.com/AltanS/collie/commit/114be1ef) |
| 协议决策文档 | `PACK_PROTOCOL.md` 改名 `CREW_PROTOCOL.md`，新增 ADR 0039，明确取代 ADR 0038 的机器名称保持策略；协议链接、守卫链接及 ADR 索引修正。 | [73205813](https://github.com/AltanS/collie/commit/73205813)、[6b756d31](https://github.com/AltanS/collie/commit/6b756d31)、[ba442aee](https://github.com/AltanS/collie/commit/ba442aee) |
| 标签和字体样本 | GitHub 路径匹配改为 crew，但历史 `area: pack` 标签保留到 2.0；字体子集的示例字符串由 Pack 改为 Crew，没有重做字体设计。 | [12c746f7](https://github.com/AltanS/collie/commit/12c746f7) |
| 打包和锁文件 | AUR／Nix 包装文件按上游标签实际状态追踪官方 1.7.0 资产及校验值，不伪造本仓库的二进制资产。`flake.nix`、`flake.lock`、根 `bun.lock` 没有变化，`web/bun.lock` 只增加 Playwright 依赖项。 | [4794fd4c](https://github.com/AltanS/collie/commit/4794fd4c) |

## 上游取舍与保留项

本次没有独立的下游功能被上游等价实现替换；以下既有上游模块的升级全部采用上游，交叉位置保留下游仍有价值的行为。

| 位置 | 升级前 → 升级后 | 取舍与可见影响 |
| --- | --- | --- |
| Crew | v1 协议及 Pack 内部名称 → v2 协议、Crew 命名和迁移 | 整体采用上游；下游 HostChip、默认主机和通知已读清理一起迁移到新 provider／目录，保留其原有用途。 |
| OMP 输入 | 单块粘贴 → 上游逐段确认 | 直接采用上游策略；保留下游 Codex `beforeDraft` 证据、草稿匹配、图文混排、粘贴占位及 Enter 防护，不把 OMP 方案强套到 Codex。 |
| PWA 更新 | 刷新后仍旧可能重复等待 → 有在线证据时再次点击可脱离旧缓存 | `pwa.ts` 与上游一致；下游通知清理、状态去重和资源路径处理继续保留。 |
| Composer 与状态栏 | 保持紧凑四按钮、icon＋文字、输入不自动弹键盘、按键托盘 | 上游没有等价替代；保留横向滚动 statusline、同排多主机目标、context 圆环颜色／比例、fast 闪电及状态动画，不恢复多余状态条。 |
| iOS 与标题栏 | 保持 composer 向下覆盖整个底部安全区及 viewport 修复 | 新 root 的 CrewProvider 与原有高度／安全区处理合并；保留重命名防缩放、专注入口及窗格切换，避免再次引入底部空白。 |
| 显示与字体 | 保持输入／diff 连续矩形底色、对称留白、输入辨识度和已有图标 | 保留 Geist／Geist Mono web font、Cursor 图标、中文“输入”及既有间距调整；不新增推测硬换行的拼接规则。 |
| 版本与交付 | 继续 `上游版本+collie.N` | 保留人类可见版本去掉 dev／dirty、发布说明正确匹配 `+collie`；仅推 main 和准确 tag，不发布 Release、不恢复 Actions。 |
| 本机测试兼容 | 保持 macOS realpath 与安装路径测试适配 | 这些补丁仍解决本机平台差异；中文审计报告继续排除在 CLI 内嵌操作手册清单之外。 |

## 验证与交付边界

本次完成构建、单元测试和新增浏览器测试；没有把桌面 Chromium 测试声称为真实 iPhone PWA 验证。

- 根 `bun run build` 成功：包括两侧类型检查、CLI 编译、前端构建和安全替换产物；全树 lint 通过。
- 前端：202 个文件、5753 项通过、30 项 todo。
- 后端：3075 项通过；CLI：1406 项通过；scripts 的 Bun 测试：82 项通过。collie-ctl shim 测试通过。
- 根聚合测试在既有 macOS 平台断言处停止：`collie-cli.test.sh` 期待 Linux 的 `systemd-run --user --collect` 文案，本机正确走 detached-child 交接。没有为此修改生产行为；不能将根聚合命令称为全绿。
- 聚合命令后续的 payload-links、upstream-bun、tag、flake-lock、pre-commit、AUR 及 packaging refresh shell 测试已分别运行，全部通过。
- Playwright Tier 1：43 项通过、7 项按项目配置跳过；手机和平板 app、playground 及手机 worker 恢复流程均覆盖。测试使用隔离 API，没有向真实会话发送消息。
- 历史只读检查：常规 probe 成功解析 Claude 384 条、Codex 287 条；Hermes 另用实际适配器定位并解析本机一个会话的 6 条记录。常规 probe 的 JSONL 搜索不能作为 Hermes SQLite 验证。
- Playwright 安装曾自动清理旧引擎缓存；已恢复 Python 调试所需 Chromium／headless-shell 1217 和 WebKit 2272，同时保留新增 headless-shell 1234。
- 部署目标为本机 Herdr 管理的 `herdr.collie`，按准确版本 tag 构建，只重启该插件；不重启 Herdr 或其他服务。安装目录中的既有 dist 备份继续保留。
