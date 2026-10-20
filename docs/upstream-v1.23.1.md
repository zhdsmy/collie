# v1.23.1 合并记录

从 `1.23.0+collie.1` 跟进至 `1.23.1+collie.1`。已交叉核对[官方发布说明](https://github.com/AltanS/collie/releases/tag/v1.23.1)、标签内 CHANGELOG 和 [v1.23.0…v1.23.1 完整差异](https://github.com/AltanS/collie/compare/v1.23.0...v1.23.1)：51 个文件、10 个非合并提交。此版本以修复为主，没有新增依赖或工具链升级。

## 全部上游变化

| 范围 | 修复后的行为与保护 |
| --- | --- |
| Muse 空输入提示 | Muse 1.4.10 的 ghost suggestion 不再被误认作用户草稿，避免发送被 `draft present` 拦住。profile 声明提示颜色，只有整个输入都符合提示样式才视为空；真实输入仍受草稿保护。发送前两次读取空框时忽略提示文字自行变化，保留框边界检查。[修复](https://github.com/AltanS/collie/commit/b6f86198)、[真实样本](https://github.com/AltanS/collie/commit/fd2a6e92) |
| Muse slash palette | 识别输入框内部的命令菜单、粗体选中行和底边参数提示，输入的命令与选中项一致时用 Enter 提交。选中项改变或不匹配时仍停止发送；菜单内容不会混入草稿，也不再误判为必须手动处理的对话框。[修复](https://github.com/AltanS/collie/commit/75cec061) |
| Claude 长命令审批 | 后台 agent 的 Bash 审批包含长脚本和危险 rm 警告时，卡片完整找到自己的顶边、命令和警告，点击可以发送选项数字。只将明确虚线围栏内的命令行合并计算扫描范围，最多 120 行；真实横线边界仍阻断扫描，不任意认领上方正文。[修复](https://github.com/AltanS/collie/commit/fbd7cf56) |
| Claude Resume | 原生标题 `Resume session (1 of 50)` 的当前位置会随方向键变化。对话身份现在忽略当前位置、保留总条数，避免走到目标项后误报“界面已变化”而拒绝 Enter；卡片标题也去掉计数。列表内容、长度或非时间元数据改变仍使旧点击失效。[修复](https://github.com/AltanS/collie/commit/9f4d27ef) |
| 多语言问题 | Claude 和 agy 共用问号识别，支持英文 `?`、中文／日文 `？`、阿拉伯文 `؟`，让问题及选项进入卡片和 Chat，不必切终端。希腊语的分号没有当作问号，避免普通文本误识别。[修复](https://github.com/AltanS/collie/commit/9ac77b3e) |

上游同步新增 Muse 提示／菜单、Claude 长命令审批、Resume 两种宽度及全角问号的捕获样本、来源说明、前后端回归和绑定 golden。共享 frame、command-list、profile 及 SendProtocol 的更新一并合入，不仅替换界面解析器。

打包方面，AUR PKGBUILD／.SRCINFO 和 Nix sources 跟进官方 `1.23.0` 的产物地址及校验和；这是上游此标签的元数据，不是本地版本退回。没有更改 flake.lock，也没有发布 Windows 产物或启用 GitHub Actions。[打包提交](https://github.com/AltanS/collie/commit/ad170f2b)

## 下游取舍

删除原来 Claude markers 内的独立 `hasQuestionMark`：它支持 `?`／`？`，现在由上游共享 helper 提供同样识别，并增加阿拉伯文支持。原有中文识别目标保留，减少一份重复实现；其余功能没有被替换。

保留 Codex Resume／Model／Agents 等卡片、Queue／Steer 设置及立即引导、warning 数量、切换保护；保留 Input 内按键区和草稿缓存、Claude Settings／Agents 卡片、Cursor journal、字体／紧凑操作带／tab 图标。Hermes 继续采用上游问答和审批实现，保留上一版真实会话验证后的 150ms 粘贴等待、字面横线边界保护、窄屏中文边框处理及展示／通知定制。本次未更改 Hermes profile 或扩大其已验证版本范围。

适配目录补入新 Claude 样本和 Muse 发送条目，共 69 项。上游采样回放与本机原生 CLI 实测分别记录，没有把本次回放冒称新的真实版本认证。

## 验证与交付

- 共享解析与逻辑集：103 文件，34,539 通过；34 项预期失败、58 todo，未新增失败。包含 Codex、Hermes 既有保护和本次 Muse／Claude 回归。
- SendProtocol、Ask、前后端绑定及目录回放：764 项通过；目录扩充后单独回放通过。卡片 DOM 测试 44 项通过。
- 保存 320px 的全角问号、长命令审批、Resume 卡片截图；仅证明捕获样本的渲染，不声称真实 CLI 操作。证据位于本机 `/private/tmp/collie-v1231-evidence/screenshots/index.md`。
- AUR／刷新脚本检查、lint、根目录和 Web 类型检查、版本一致性检查及正式标签构建按仓库流程执行；提交与标签推送后部署本机，只重启 Collie，回读 build、health、config、snapshot 和当前版本说明，清理旧回滚包与暂存产物。

没有追加模型调用、真实 Muse／Claude 交互、跨机 Crew／Walky、Windows 或真机 iOS 检查。公网域名有 OAuth，按用户要求只验证本机。未修改用户会话，未重启 Herdr 或 Headroom，未开启定时巡检。
