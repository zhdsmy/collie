# v1.5.5 上游合并记录

本次从 `v1.5.4+collie.2` 合入上游 `v1.5.5`，下游交付版本为 `v1.5.5+collie.1`。

## 核对范围

Release 说明、上游 CHANGELOG 和实际标签差异已交叉核对，而非仅摘录发布摘要。

- [上游 Release](https://github.com/AltanS/collie/releases/tag/v1.5.5)，发布于 2026-09-07。
- [完整标签差异](https://github.com/AltanS/collie/compare/v1.5.4...v1.5.5)：20 个提交、54 个文件，新增 1642 行、删除 131 行。
- [上游 CHANGELOG](https://github.com/AltanS/collie/blob/v1.5.5/CHANGELOG.md)。目标提交为 `35379904cc80aa8f175ad341be2b5fab061c24de`。

## 完整上游变更

以下覆盖本版所有功能、修复、兼容性、文档及测试变化。

| 范围 | 完整变化 | 来源 |
| --- | --- | --- |
| 多主机更新 | 成员通过自身预检报告声明安装类型；包管理器拥有的成员进入终态 `package-managed`，不再一直等待更新轮次，也不会阻塞整个 pack 完成。已更新、正在更新、已回滚和连续失联等实际观测优先于安装类型，避免把失联误报为正常等待包管理器。 | [142fa26](https://github.com/AltanS/collie/commit/142fa26)、[902718b](https://github.com/AltanS/collie/commit/902718b) |
| CLI 预检 | 每个成员的预检行增加安装类型；旧成员未提供该字段时保持原样，不猜测安装类型。 | [43c3216](https://github.com/AltanS/collie/commit/43c3216) |
| 手机上的包管理成员 | Updates 页面和更新横条以中性色显示该主机等待包管理器；这类成员不计入可由手机解决的落后数量，也不出现在催促更新的成员行里。 | [e3e09f2](https://github.com/AltanS/collie/commit/e3e09f2) |
| 包管理器命令 | 主机在启动时解析自己适用的包管理器更新命令，经 `UpdateStatus.packageCommand` 传给前端。更新卡优先使用该字段，旧 bridge 则回退到预检的补救命令；前端不自行推导，也不重复读取同一事实。 | [05062a2](https://github.com/AltanS/collie/commit/05062a2)、[4a5694c](https://github.com/AltanS/collie/commit/4a5694c) |
| 文件替换后的重启提示 | 保存进程启动时的版本，与节流读取的磁盘版本比较；软件包替换了文件但进程尚未重启时，快照显示 `restartNeeded` 和适用的 `restartCommand`。磁盘回滚后提示可以消失；pack 对外仍报告进程实际启动版本，不谎报已经运行新版本。Herdr 管理的安装使用插件重启动作，其他安装使用 `collie restart`，不使用不存在的系统级 sudo 服务命令。 | [1b9e05d](https://github.com/AltanS/collie/commit/1b9e05d)、[4a5694c](https://github.com/AltanS/collie/commit/4a5694c) |
| 附件来源选择 | 一个混合 `image/*` 与文本扩展名的文件输入会使 iOS/Android 不再提供图库。现在分为 Photos 和 Files 两个原生输入：照片仅声明 `image/*`，文件保留主机公布的完整类型列表，两者共用上传流程。只支持图片的旧主机直接打开图库，不显示只有一个选项的菜单。 | [9fa55a7](https://github.com/AltanS/collie/commit/9fa55a7) |
| 附件按钮反馈 | 点击立即高亮，并在平台支持时触发触觉反馈；高亮使用清楚的主色，进入立即生效、退出保留过渡，菜单打开期间持续显示。来源菜单改为在按钮上方展开，不再被从底部滑出的面板遮住点击反馈。 | [9fa55a7](https://github.com/AltanS/collie/commit/9fa55a7)、[495b9c7](https://github.com/AltanS/collie/commit/495b9c7) |
| 更新卡布局和重复操作 | 异步出现的成员、预检和运行记录通过 `Collapse` 展开。操作行在整个更新期间保持挂载，从请求开始、等待首条记录到运行中统一禁用，关闭首条记录出现前的重复点击窗口。等待超过 60 秒只更换说明，不按超时解锁按钮；重启间隙不再显示误导性的预检失败原因。 | [689dcb2](https://github.com/AltanS/collie/commit/689dcb2) |
| Codex 工作状态识别 | 识别排队快捷键提示与 `N% context left/used` 同处一行的 footer，避免工作中引导对话误报文字未进入输入区。快捷键可配置，不再仅依据固定按键名判断该同一行形态。 | [#176](https://github.com/AltanS/collie/pull/176)、[0ad4f2f](https://github.com/AltanS/collie/commit/0ad4f2f) |
| 提交前保护 | 校验文字已经进入输入区的同一次读取，同时提取准确 prompt；只发送 Enter 的请求附带 `expected_prompt`。若其后弹出对话框或焦点区域改变，bridge 拒绝操作并返回 `prompt_changed`，不会误确认对话框；界面明确文字已送达但未提交，避免再发一份。普通文字和 harness 粘贴占位符验证分支均受保护。 | [#177](https://github.com/AltanS/collie/pull/177)、[e7c1c78](https://github.com/AltanS/collie/commit/e7c1c78) |
| 通用折叠动画 | `Collapse` 从 `setTimeout(0)` 改为双 `requestAnimationFrame`，让关闭状态先真正绘制，再开始展开；解决异步内容直接跳到最终高度。减少动态效果模式下立即展开，并清理待执行帧回调。 | [bffe062](https://github.com/AltanS/collie/commit/bffe062) |
| 通用浮动菜单 | 新增 `AnchoredMenu`，绝对定位在触发区域上方，复用 ActionRow 和导出的 `useDialogFocus`。透明外部点击层、Escape 关闭与焦点恢复均由上游实现；不使用会重新布局周边内容的展开动画。 | [ffd89b0](https://github.com/AltanS/collie/commit/ffd89b0) |
| 协议和兼容 | PACK_PROTOCOL.md 的 §7.1、§19、§20 记录新增可选安装类型及 `package-managed` 状态。协议版本仍为 1，没有新路由、命令或请求头；字段缺失或未知时按未知处理，而非误判为包管理安装。 | [协议差异](https://github.com/AltanS/collie/blob/v1.5.5/PACK_PROTOCOL.md)、[142fa26](https://github.com/AltanS/collie/commit/142fa26) |
| 文案、文档和测试 | 更新七种语言的附件、包管理成员、重启与启动等待文案；更新横条的 40 字预算测试也覆盖繁体中文。新增/扩展包管理成员、启动版本、更新卡、折叠、浮动菜单、附件与提交保护测试，加入 Codex 同一行 footer 捕获及说明，更新 solo baseline。CHANGELOG 简化开头说明并记录本版全部变更。 | [28b9414](https://github.com/AltanS/collie/commit/28b9414)、[13291da](https://github.com/AltanS/collie/commit/13291da)、[4722f4e](https://github.com/AltanS/collie/commit/4722f4e) |
| 构建和版本 | 三处版本号及 CHANGELOG 发布为 1.5.5。本版没有依赖升级、锁文件变动、构建脚本变更或工作流变更。 | [3537990](https://github.com/AltanS/collie/commit/3537990) |

## 改用上游的实现

交叉路径优先使用上游，本次没有一个完整的下游独有模块已经被上游等价覆盖而可以整块删除。

| 原有方式 | 本次采用的上游实现 | 用户可见差异 |
| --- | --- | --- |
| Composer 附件按钮直接打开混合类型的单一输入 | Photos/Files 分离、`AnchoredMenu` 和按钮反馈直接采用上游 | 手机可选图库或文件；菜单在按钮上方，点击反馈不再被遮住 |
| 下游图片/文字验证通过后，仅发无 prompt 绑定的 Enter | 采用上游 `verifiedPrompt`、`expected_prompt` 和 `prompt_changed` 处理；下游图片验证同样传入该绑定 | 验证后焦点变化会安全拒绝提交，并明确已输入但未提交，不自动重发 |
| 下游显式识别排队提示与上下文分成两行的工作状态 | 同一行形态由上游 `INLINE_QUEUE_CONTEXT_ROW` 识别，不另写同类本地规则 | 新版 Codex 的同一行 footer 可正常引导对话；旧的两行形态也仍然可用 |

更新卡、多主机包管理行为、`Collapse`、`AnchoredMenu` 和焦点辅助函数均直接采用上游实现，没有额外维护另一套。

## 保留的下游差异

这些差异尚未被本版上游覆盖，或属于已明确保留的产品选择。

| 保留内容 | 原因 |
| --- | --- |
| Composer 四个横向 icon+文字按钮、直接输入合并按键、开启时不聚焦 | 上游仍使用独立按键入口和另一套控制栏布局，不能等价替换当前交互 |
| iOS 文档根 `100lvh`、实时 visualViewport 与 Composer 底部延伸 | 上游本版未处理安装态 PWA 的历史底部空白问题；没有重新加入底部安全区补偿 |
| Codex 两行工作 footer、长草稿与空段落识别 | 上游 #176 只新增同一行 footer，不能替代已经验证过的其他输入形态 |
| 图片 token、绝对图片路径、图文混排、空行、发送前后草稿基线 | 上游提交绑定解决的是焦点竞争，不解决图片内容匹配；保留防误认旧图片和缺图的验证，并让所有成功分支使用上游 prompt 绑定 |
| 紧凑可横滑 statusline、多主机目标同一行最前面 | 上游本版没有覆盖这套展示与布局 |
| context 圆环、剩余容量绿黄红、Fast 空心/实心闪电、状态动画 | 已确认的下游显示偏好，未被本次上游功能替代 |
| 输入/差异背景与输入强调、Geist/Geist Mono web font、版本显示去除 dev/dirty | 本版没有相同替代；显示层处理仍保留，终端正文换行继续跟随上游，不恢复旧的行拼接启发式 |
| Tab/窗格重命名输入框 16px | 上游未修复 iOS 小字号聚焦缩放问题 |
| 无 GitHub Actions、只提交和打标签、不发布 Release | 用户明确的下游发布策略，不恢复工作流 |

上游 CHANGELOG 开头误把 `Unreleased` 标题截在行内，本次仅恢复有效 Markdown 标题和下游合并条目，不删除任何上游版本记录。

## 验证结果

验证重点覆盖合并冲突和上游提交保护与下游图片匹配的交叉路径。

- 前端全量：189 个文件，5341 项通过，30 项 todo。
- 发送专项：72 项通过；包括单图、多图、图文混排、空行、图片标记、绝对路径及焦点变化后的拒绝提交。
- 后端单元：bridge 2744、CLI 1285、scripts 52 项通过，共 4081 项。
- `bun run lint`、包含前后端类型检查的根目录 `bun run build` 通过。
- 标签、flake 锁文件和 pre-commit 保护测试通过。
- Chromium/WebKit：320、390、1280px，亮暗主题共 12 组，验证附件菜单位置、两种原生选择器调用、模拟上传、外部点击关闭、四按钮布局及长路径不溢出；全部 API 写入被拦截，不操作真实终端。
- 完整 `bun run test` 仍在既有 macOS CLI shell 集成用例失败：预期使用 `systemd-run --user --collect`，实际为 detached child。相关脚本和更新实现与上游 v1.5.5 一致，未为此改动产品代码。
- 浏览器验证不等同于连接 iPhone 的安装态 PWA 真机验证；本次没有声称重新完成真机安全区测试。

## 上游提交清单

以下列出此次标签范围中的全部 20 个提交，便于逐项追溯。

| 提交 | 内容 |
| --- | --- |
| [142fa26](https://github.com/AltanS/collie/commit/142fa26) | 包管理成员终态与协议扩展 |
| [43c3216](https://github.com/AltanS/collie/commit/43c3216) | CLI 成员预检显示安装类型 |
| [e3e09f2](https://github.com/AltanS/collie/commit/e3e09f2) | 手机显示等待包管理器的主机 |
| [05062a2](https://github.com/AltanS/collie/commit/05062a2) | 快照携带包管理器命令 |
| [1b9e05d](https://github.com/AltanS/collie/commit/1b9e05d) | 检测磁盘版本替换并提示重启 |
| [2e50a3f](https://github.com/AltanS/collie/commit/2e50a3f) | 记录包管理成员变更 |
| [13291da](https://github.com/AltanS/collie/commit/13291da) | 对齐包管理成员测试名称 |
| [28b9414](https://github.com/AltanS/collie/commit/28b9414) | 更新相关翻译文案 |
| [902718b](https://github.com/AltanS/collie/commit/902718b) | 实际状态优先于包管理安装类型 |
| [4a5694c](https://github.com/AltanS/collie/commit/4a5694c) | 修正包管理安装的重启命令与命令回退链 |
| [1df2451](https://github.com/AltanS/collie/commit/1df2451) | 合并包管理成员更新支持 |
| [9fa55a7](https://github.com/AltanS/collie/commit/9fa55a7) | 恢复图库选择与附件点击反馈 |
| [689dcb2](https://github.com/AltanS/collie/commit/689dcb2) | 更新卡稳定布局与防重复点击 |
| [0ad4f2f](https://github.com/AltanS/collie/commit/0ad4f2f) | Codex 同一行排队状态识别，#176 |
| [e7c1c78](https://github.com/AltanS/collie/commit/e7c1c78) | Enter 提交绑定已验证 prompt，#177 |
| [4722f4e](https://github.com/AltanS/collie/commit/4722f4e) | CHANGELOG 和交叉提交测试对齐 |
| [bffe062](https://github.com/AltanS/collie/commit/bffe062) | Collapse 等待实际绘制后展开 |
| [ffd89b0](https://github.com/AltanS/collie/commit/ffd89b0) | 新增 AnchoredMenu 组件 |
| [495b9c7](https://github.com/AltanS/collie/commit/495b9c7) | 附件菜单改为上方展开及清晰高亮 |
| [3537990](https://github.com/AltanS/collie/commit/3537990) | 发布上游 1.5.5 |
