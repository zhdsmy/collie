# 跟进上游 v1.25.4

本次采用 [v1.25.4](https://github.com/AltanS/collie/releases/tag/v1.25.4)，核对发行说明、CHANGELOG 和 [v1.25.3…v1.25.4 全部差异](https://github.com/AltanS/collie/compare/v1.25.3...v1.25.4)，发布为 `1.25.4+collie.1`。

## 上游完整变化

- **延迟按键提示**：Claude 忙于子智能体、晚画出 Collie 探针时，以 `late_keys` 解释等待后重试，不再建议无效的重绘。仍拒绝不确定发送；下次发送先清除可确认属于自身的探针。其他草稿保持保护。[#623](https://github.com/AltanS/collie/commit/b21f615)
- **core 发送延迟**：不带修饰键的 Enter、Backspace、Tab 改走 raw input，避开 core 约 3 秒的 named-key hold；其他按键仍按名称发送。文本后的 raw 键至少间隔 150ms，避免 Codex 将文本与 Enter 当成粘贴并插入换行；键接键不加延时，避免清理长草稿超时。不同 pane 独立。[#637](https://github.com/AltanS/collie/commit/1b89e56)、[间隔修复](https://github.com/AltanS/collie/commit/5289ec9)、[仅文本后等待](https://github.com/AltanS/collie/commit/543be03)
- **pi 命令恢复**：`/s` 或 `/model haiku` 的模糊列表不再令后续发送一直被“未识别界面”拦截。指向其他命令仍拒绝提交，但可 Discard／Replace 清理草稿；补充 1.4.0 样本和回归。[#638](https://github.com/AltanS/collie/commit/b6f018b)
- **Cursor 空框识别**：跳过 shell approval 后的指令提示识别为空框，屏幕最后一行的底部 prompt 也可识别；新增样本。[#640](https://github.com/AltanS/collie/commit/6907416)
- **Messages 完整正文**：Walky 卡片仍截三行，详情 sheet 展示全文，移除原六行截断。[#641](https://github.com/AltanS/collie/commit/9f0036d)
- **Chat 日志更新**：文件大小不变但时间变化时检查尾部内容；实际重写才重置，单纯 touch 不强制重载。Load older 前先同步，避免页码与新内容错位。[#642](https://github.com/AltanS/collie/commit/b225d08)
- **子智能体详情隔离**：相同名称和任务文字的两个调用以各自 item id 关联详情，避免打开的 sheet 被另一调用覆盖。[#643](https://github.com/AltanS/collie/commit/ccec616)
- **文档**：HC_API、multiplexers、troubleshooting 更新 raw 键及间隔；rig 说明补充 core 高负载验证，并明确 Hermes、Kiro 尚未在 core 认证；Walky 文档补最短上手、引用行、图片步骤，Changes 增加 Comment on lines 指引；configure、README 和样本来源同步。
- **打包与工具**：更新 AUR/Nix 的 1.25.3 包装元数据；Windows bridge skip budget 从 98 增至 100，计入 omp/pi 不适用的两个 Claude-only raw Enter 用例；同步预算检查。当前 fork 继续不恢复 workflows、不创建 GitHub Release。

## 下游取舍

本次没有以新增上游功能替换独立下游实现。core raw 键改动进入共用 adapter，与本地历史读取及会话发现兼容。

保留默认 1000 行 mirror 与屏幕优先发送检查、慢历史读保护、Hermes Python bootstrap 身份识别、四类智能体会话发现、纯文本提示适配；保留 Queue/Steer、Keys 合并输入和草稿缓存、自定义卡片、紧凑状态栏、图标、字体/PWA、AGY `.pb` 后备和固定签名。

Cursor 原有无边框输入框 alternate 保留，同时加入上游底部停靠 alternate 与空框提示；样本标签按条目合并，保留本地额外样本。只删除依赖已禁用 workflows 的测试冲突片段，保留实际 Windows skip budget 更新。

## 验证边界

运行本次受影响的 core adapter/keys/socket 故障、发送协议（包括延迟按键）、live journal、pi/Cursor/Surface 样本和 Chat/Walky/subagent 组件回归，两端类型检查、lint、版本检查与构建；手机浏览器检查发送设置与千行历史相关行为。结果见交付。

不启用定时任务，不额外调用模型；未全跑四类 CLI 原生发送、Windows VM、跨机 Crew 或真机 iOS。部署只重启 Collie，固定签名在替换前和重启前验证，回读 localhost 构建、鉴权 API、snapshot 和 Documents 文件。公网前置 OAuth，按用户约定不验证。

本版本未提供 ANSI 样式或 Hermes done 状态来源；上一轮迁移审查中的这些缺口没有因本次升级消失。
