# v1.23.4 合并记录

从 `1.23.3+collie.1` 跟进至 `1.23.4+collie.1`。已交叉核对[官方发布说明](https://github.com/AltanS/collie/releases/tag/v1.23.4)、[标签内 CHANGELOG](https://github.com/AltanS/collie/blob/v1.23.4/CHANGELOG.md#1234---2026-10-23) 和 [v1.23.3…v1.23.4 完整差异](https://github.com/AltanS/collie/compare/v1.23.3...v1.23.4)：11 个提交、33 个文件，包含发布提交。没有新增依赖、运行时升级、lockfile 或生产环境 CI 配置变化。

## 全部上游变化

| 范围 | 变化与用户影响 |
| --- | --- |
| 草稿上的命令替换 | 终端输入框已有草稿时，操作带的 Model 或输入的 `/model` 会要求确认。此前点 Replace 仍被“斜杠命令应走命令路径”拒绝；现在确认后先清空旧草稿，再按命令路径发送。审批弹窗等不允许输入的界面继续拒绝，普通文本的替换保护保留。[实现](https://github.com/AltanS/collie/commit/ab3adc25) |
| 命令的草稿操作 | 命令遇到草稿只提供 Replace／Cancel，不再提供 Add，避免把“旧草稿 /model”当成普通消息发出。相同请求的回执重放也遵守该规则；普通消息仍提供 Add／Replace／Cancel，无可证明的输入框仍只提供按键区。[首次拒绝](https://github.com/AltanS/collie/commit/861bfcde)、[重放](https://github.com/AltanS/collie/commit/85924fe5) |
| 提示与翻译 | 前端根据服务端实际提供的操作区分普通草稿和命令草稿，后者只提示“替换或取消”；补齐 12 种语言的对应文案，不再额外重复输入框状态。[提示](https://github.com/AltanS/collie/commit/90b5e6f8)、[翻译](https://github.com/AltanS/collie/commit/866f2eb2) |
| 浏览器回归场景 | 新增 Claude 草稿上的 Model → Replace → 模型卡片场景，检查两次点击、没有 Add、草稿已清空，最后从终端 Esc 关闭。solo 场景数从 27 增至 28，crew 仍为 7，README 和场景计数测试同步调整。该用例本身不请求模型。[实现](https://github.com/AltanS/collie/commit/ea279447) |
| pi 测试环境发现 | 回归工具优先读取显式 `COLLIE_RIG_PI_BIN`，否则从 PATH 找 pi，并排除项目或 bunx 注入的 `node_modules/.bin`，最后保留原固定位置作为回退。沿真实可执行路径寻找 pi 包的示例扩展；缺失二进制会立即说明路径，缺失扩展会进入场景备注，避免等到超时才发现。新增路径、软链接及扩展发现测试。[PATH 与诊断](https://github.com/AltanS/collie/commit/fa21527e)、[包定位与测试](https://github.com/AltanS/collie/commit/9f74805b) |
| Walky 测试地址 | 从终端显示的命令中提取接收地址时，遇到括号停止，避免把外层括号算进地址令牌。这只影响测试读取。[实现](https://github.com/AltanS/collie/commit/e4542500) |
| 发布记录 | CHANGELOG 说明完整的 Replace／Cancel 行为，三个上游版本文件更新到 1.23.4。本分支发布 `1.23.4+collie.1`，只推送 main 和 annotated 标签。[说明补充](https://github.com/AltanS/collie/commit/588d965c)、[发布提交](https://github.com/AltanS/collie/commit/40092745) |

## 下游取舍

本次没有独立的下游实现被上游替换。发送协议修复直接扩展已有上游路径，与本地 Queue／Steer 和命令发送校验兼容；代码冲突仅在发布版本和 CHANGELOG，按各自增量合并。

保留 Codex Model／Resume／Agents 等卡片、Queue／Steer 默认设置及立即引导、warning 数量和模型切换保护；保留 Claude Settings／Agents、Hermes composer 与本地历史／提示、AGY Model／Resume／权限卡片、后台任务识别、专用状态栏及 Chat／History。继续保留状态图标排序、剩余上下文圆环、额度分组和 5h／7d 表示、Input 内按键区与草稿缓存、字体／紧凑操作带／tab 图标、Cursor journal 和适配目录。本次上游没有替代这些定制；不恢复禁用的 GitHub workflows，不创建 GitHub Release。

## 验证与交付

- 后端发送协议、浏览器工具路径和场景清单共 492 项测试通过，涵盖命令替换、重复请求、普通草稿、拒绝界面及本地 Queue／Steer 保护。
- 前端发送组件、回执解释、共享操作列表和国际化共 107 项测试通过，确认命令只提供替换／取消，普通消息保留追加。
- 两侧类型检查、lint、差异空白检查通过。正式版本按标签构建，并定向检查 320px 的 Codex 排队／立即引导及 Input 按键区。
- 本机部署只重启 Collie，核对实际进程、build、health、config、snapshot 和发布说明；回读远端 main 与标签，并保留最近一个完整回滚包。公网有 OAuth，按用户约定仅从本机验收。

没有运行完整原生 Claude／pi／omp 和跨机 Crew 浏览器轮次，也没有调用模型、进行 Windows 或真机 iOS 验证。本次未新增或修改 harness 卡片识别，无需扩大适配目录的原生认证范围；没有重启 Herdr、Headroom 或用户 Agent 会话，没有启用定时巡检。
