# 跟进上游 v1.26.1

采用 [v1.26.1 正式标签](https://github.com/AltanS/collie/releases/tag/v1.26.1)，下游版本 `1.26.1+collie.1`。已核对 Release、CHANGELOG 和 [v1.26.0…v1.26.1 完整差异](https://github.com/AltanS/collie/compare/v1.26.0...v1.26.1)，覆盖 13 个提交、71 个文件。

## 完整变化

- **Walky 群发默认不唤醒休息中的会话**：仅针对目录／scope 或 `all` 群发。处于 idle／done 且自上次状态变化已过 15 分钟的 pane，只将消息存入 inbox，不向终端打字；回执为 `inbox-only: resting`，显示“会话正在休息”。状态未知或缺少活动时间时不按休息处理。直接指定单个 pane 的发送不变。[实现](https://github.com/AltanS/collie/commit/202741059)
- **明确唤醒入口**：CLI `send --wake` 可同时唤醒休息中的目标；手机 Crew 群发面板单独列出休息会话，提供默认关闭的“同时唤醒”开关。确认人数只计算当前将被打字的目标，切换开关会撤销此前的确认；正常发送仍需二次确认。`wake: true` 纳入签名及去重依据，不带 wake 的 canonical string 保持原样。[面板](https://github.com/AltanS/collie/commit/0ce8276d1)
- **混合版本 Crew 兼容**：lead 向低于 1.26.1 的 member 发送 wake 时转换为普通发送，因为旧 member 本就会向全部目标打字；按既有信任边界重签／证明，避免签名失败。新 member 遇到旧 lead 时明确提示“lead older than 1.26.1: send without --wake”，未知版本遇到拒绝也给出针对性原因。[修复](https://github.com/AltanS/collie/commit/7f3ad90e7)
- **Walky skill 约束**：只有用户明确要求时 agent 才能使用 `--wake`；`resting` 回执是最终结果，不应重发消息。精简重复说明，使模板保持在 185 行限制内；文档补充休息判定、inbox、CLI 和混合版本行为。[文档](https://github.com/AltanS/collie/commit/1720797f4)、[skill](https://github.com/AltanS/collie/commit/78daa2c40)
- **测试临时目录自动清理**：根目录 `bun test` 预载 `scripts/test-preload.ts`，每个进程使用独立的短前缀 `ct-*` 目录，子进程继承，结束时删除；支持 rerun-each，`COLLIE_TEST_KEEP_TMP=1` 可保留诊断。强制终止仍可能留下该进程的一个目录，清理失败只报告。web／examples 的独立 Bun 配置不受这项预载影响。[实现](https://github.com/AltanS/collie/commit/c031a66c5)
- **测试证据与工具**：加入 Claude Code 2.1.318 的 21 个 rig cassette／元数据文件，来自已有 1.26.0 验证，不表示本次重新调用模型。补充休息／唤醒、签名、路由、CLI 及面板测试，修正 lint；Windows skip 预算由 188 调至 190（CLI 新增两项 Unix socket 用例），pre-commit 将 test preload 按测试基础设施处理。[cassettes](https://github.com/AltanS/collie/commit/6ab40ebe5)
- **打包元数据**：AUR PKGBUILD／SRCINFO 与 Nix sources 更新到已发布的上游 1.26.0 下载地址／校验值，随这次标签纳入；没有依赖或 `flake.lock` 变更。本机仍使用下游签名构建，不使用这些上游下载包。[打包](https://github.com/AltanS/collie/commit/3796c0b0b)

## 下游取舍

这次没有独立下游实现被上游替换。采用上游 Walky 新行为；保留禁用 GitHub Actions 的既定选择，只合并 Windows skip 预算，不恢复读取不存在 workflow 的测试。版本号、CHANGELOG 和新增测试的冲突均为机械合并。

保留 Codex／Claude Queue／Steer、排队消息立即引导、输入区 Keys／草稿缓存、Standard／Fast 单控件、默认 1000 行镜像及屏幕优先发送检查、慢历史保护、Hermes／AGY 识别和状态栏、AGY `.pb` 历史后备、固定卡片／小 Esc、图标／字体／PWA 定制。未新增 harness 卡片，不改变适配目录的原生认证状态。

## 验证与部署

定向 Walky 后端、CLI socket、skill 和工具检查 400 项通过；群发面板、发送 hook 和 Walky logic 共 100 项通过。两端类型检查、lint 通过。手机浏览器、正式构建及固定签名部署验收结果待补充。

未新增模型调用、全量测试或定时巡检；不宣称跨机混合版本 Crew、真实 agent 唤醒或真机验证。既有 Cursor 输入框旧失败、core ANSI 样式和 Hermes 完成状态缺口不在本次修改范围。
