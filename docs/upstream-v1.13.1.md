# 上游 v1.13.0 至 v1.13.1 合并报告

从下游 `v1.12.1+collie.5` 跟进上游 `v1.13.1`，下游目标为
`v1.13.1+collie.1`。核对了两版 [发布页](https://github.com/AltanS/collie/releases/tag/v1.13.0)、[v1.13.1 发布页](https://github.com/AltanS/collie/releases/tag/v1.13.1)、
上游 `CHANGELOG.md` 和 [v1.12.1...v1.13.1 标签差异](https://github.com/AltanS/collie/compare/v1.12.1...v1.13.1)。
标签间共改动 216 个文件。以下覆盖两版 CHANGELOG 的 Added、Changed、Fixed，
并单列标签差异中的文档与打包改动。

## 上游变化

### Changes 与导航

- [Changes 提交](https://github.com/AltanS/collie/commit/d887f939) 等新增工作区 Git 改动的只读浏览：按仓库和目录查看文件、增删行数、语法高亮 diff、上一/下一文件、筛选，以及干净仓库的最近一次提交。Changes 页面每 5 秒按需刷新；多个标签共享同次读取，滚动或触摸时延后刷新。
- [工作区汇总](https://github.com/AltanS/collie/commit/9212ced7) 将 Changes 归到工作区，窗格和工作区入口看到同一份列表；新增工作区 Changes API 和设置项。仪表盘底部新增 Panes、Focus、Changes 三个标签；Focus 只列需要操作的窗格，Changes 汇总各工作区计数。[#270](https://github.com/AltanS/collie/commit/433db135) 调整 Focus 图标与提醒计数。
- [导航提交](https://github.com/AltanS/collie/commit/a9c2a570) 让返回手势逐级退出视图，应用内通知直接导航而不重载；[转场提交](https://github.com/AltanS/collie/commit/1a8a60a8) 在支持的浏览器中让列表行进入详情标题，降低动态效果或读取较慢时仍用普通切换。

### 更新与操作带

- [更新模式](https://github.com/AltanS/collie/commit/bf0305c4) 用完整进度界面显示预检、构建、重启、验证、其他机器和本手机的步骤。可跳过暂时失联的成员或继续等待，结束后显示结果；成员未完成时不会提前关闭。手机只在最后一步重载一次，未发送的输入会延后重载，完成提示不再重复出现。
- 更新模式保持屏幕唤醒，适配较大的系统字体；重试文案写明机器。v1.13.1 的 [Mac 安装修复](https://github.com/AltanS/collie/commit/3067bd21) 让手机触发的更新在正确安装目录执行新版本，也覆盖没有 systemd 用户管理器的 Linux；失败原因和运行日志保留。升级到此版本时，旧 Mac 更新器仍须先在终端执行一次 `collie update`，随后可从手机更新（[#283](https://github.com/AltanS/collie/issues/283)）。
- [操作带缩放](https://github.com/AltanS/collie/commit/79e40bb5) 将带、按钮、文字和图标联动放大，并新增 Settings 尺寸选项；Changes 和切换窗格按钮加入悬停、按压反馈。尾部按钮现在留出 16px 间距，不会压在切换按钮渐隐区下。

### 兼容与细节修复

- OpenCode 2 的新会话表可恢复 History 与提示缓存显示（[#269](https://github.com/AltanS/collie/commit/f0b9ba24)）；Muse 网络权限提示有可操作按钮，空行草稿、斜杠命令、图片与文件路径可正确验证并发送（[#274](https://github.com/AltanS/collie/commit/6007c05d)、[#276](https://github.com/AltanS/collie/commit/878bae0e)、[#278](https://github.com/AltanS/collie/commit/1af5f920)）。
- 修复拖动打开的窗格切换器在重绘后自行关闭、折叠屏外屏键盘触发错误横屏判断、Changes 筛选覆盖层重复报读，以及文件编辑时 diff 闪烁。Changes 只更新发生变化的行，计数未变时不重绘。
- 六种非英语语言补齐 Changes、尺寸、更新模式以及此前缺少的提示文案；仪表盘计数改为渐入显示。

### 文档与打包

- 标签差异新增 ADR 0064 至 0069，更新设计规范、配置与升级文档；`docs/upgrading.md` 解释 Mac 首次升级与更新日志位置。
- AUR 和 Nix 的来源元数据跟进 1.13.0；Web lockfile 加入语法高亮依赖 `sugar-high`。上游发布工作流也有改动，但此下游仓库依既定策略不恢复 `.github/workflows/`。新增的桥接、CLI、Web 单测与 E2E 覆盖 Changes、更新模式、Muse 等流程。

## 下游合并决定

- **保留紧凑同底的操作带。** 上游默认 1.15 倍、约 45px 高并给滚动区加品牌色底；下游继续以 1 倍、40px、与输入区相同底色为默认。上游 Changes 入口、按钮反馈与尺寸设置保留，用户可选择 1.3 或 1.5 倍。可见差异是默认操作带仍占较少竖向空间。
- **保留下游 Codex 与发送保护。** 数量警告按钮、Plan/状态栏、当前版本的 `resume` 卡片、发送前的窗格与草稿检查，以及 Claude 提示按钮继续有效。上游没有替代这些下游实现，本次没有恢复旧版 Codex 兼容代码。
- **保留禁用发布工作流的仓库策略。** 上游自动发布工作流不合入下游；代码和标签按下游发布流程推送。

## 验证

操作带、Composer、偏好、Changes 等 Web 定向测试 325 项通过；Changes、更新、Codex resume 等另一组 183 项通过。桥接与 CLI 定向测试、根目录与 Web 类型检查、lint、根目录构建通过。手机宽度的操作带、Changes、Codex resume 浏览器检查中，Changes 的长行断言改为测量完整 diff 行；修正后 Changes 8 项通过。
