# v1.22.6 合并记录

从 `1.22.5+collie.2` 升级至 `1.22.6+collie.1`。已交叉核对[官方发布说明](https://github.com/AltanS/collie/releases/tag/v1.22.6)、标签内 CHANGELOG 和 [v1.22.5…v1.22.6 完整差异](https://github.com/AltanS/collie/compare/v1.22.5...v1.22.6)：115 个文件、28 个非合并提交。以下包含正式说明之外的兼容性、文档、测试和打包变化。

## 上游全部变化

| 范围 | 行为变化与边界 |
| --- | --- |
| 待发送消息 | Bridge 暂存的消息卡浮在镜像区上方，与终端草稿提示共用位置，不再撑高底部输入区。两条及以上默认折成数量和首条文字，可展开逐条操作；展开列表最高为 `45dvh`，软键盘出现时随可视高度缩小。切换或移除 pane 后恢复折叠。这是服务端 held 消息，不改变 Codex 原生队列的排队／引导设置。[浮动卡片](https://github.com/AltanS/collie/commit/3a4e4c4f)、[高度修复](https://github.com/AltanS/collie/commit/6a86b1f1) |
| 韩语 | 调整全应用韩语表达、按钮和操作说明，使其更自然。[PR #498](https://github.com/AltanS/collie/pull/498) |
| 直接输入与 IME | 输入法组合期间，物理 Enter、退格、方向键、Esc、Tab 交给输入法处理；Safari 组合结束后的 `keyCode 229` 确认回声仅在 500ms 内跳过，失焦清理未结束的组合。停止直接输入、空闲暂停或切 pane 时重置发送器，避免延迟按键落入另一状态；空闲遮罩和追赶镜像期间也暂停直接输入。保留 Android 原生 beforeinput 行为。[PR #500](https://github.com/AltanS/collie/pull/500)、[后续修复](https://github.com/AltanS/collie/commit/368c1472) |
| 中日韩终端列宽 | 关闭 Wrap 时，终端和原始卡片中的宽字符固定占两列；共享原有表格字符绘制器，链接内宽字符保留下划线。ASCII 和不含宽字符的片段跳过字素分割，减少开销。开启 Wrap 的普通正文仍按自然字宽排版。[PR #499](https://github.com/AltanS/collie/pull/499)、[链接](https://github.com/AltanS/collie/commit/275c0eb7)、[性能](https://github.com/AltanS/collie/commit/9f9a67b0) |
| Claude Heads up | 提示下方列出多个后台 agents 时仍显示卡片，点击绑定也能通过。前后端一致地只排除 profile 明确命名的 footer 行，保留有界尾部检查，不把普通正文一概裁掉。增加 Claude 2.1.302 的 69 列原生捕获。[PR #493](https://github.com/AltanS/collie/pull/493)、[边界修复](https://github.com/AltanS/collie/commit/1ca658b3) |
| 禁止暂存的命令 | `/clear`、`/new`、`/exit`、各 profile 的 never-held 命令及 `!` 命令，先检查不能暂存的规则，再处理运行中拒绝；即使 CLI 版本未知也不会先进入 held 队列、等本轮结束后意外执行。[PR #491](https://github.com/AltanS/collie/pull/491) |
| OMP 18.11 | 识别带边框的 composer、Nerd Font 符号、折行和两行草稿、图片标记／路径、光标处单词提示，以及超过一分钟的工具运行计时。共享 frame、profile 和自身命令列表处理 slash／skill 命名空间；命令与 skill 意义不明确时仍拒绝提交。[PR #497](https://github.com/AltanS/collie/pull/497) |
| 测试组织与推送检查 | Surface 测试迁入 Node 逻辑项目；原大型 fold 套件拆成六组，复用测试辅助函数。pre-push 优先运行相对 `origin/main` 的受影响 Web 测试，缺少该 ref 时回退全量。上游 CI 改为三分片；本 fork 保持工作流禁用，只合入可复用配置和 hook。[拆分](https://github.com/AltanS/collie/pull/492)、[推送检查](https://github.com/AltanS/collie/commit/4efd6f28) |
| 浏览器测试与 Herdr socket | Playwright 支持 `E2E_SET=rest\|swap`：rest 只启动 4173／4175，swap 只启动 4174，并修复 ignore 配置。隔离 rig 使用按状态路径散列的短 `XDG_CONFIG_HOME`，校验实际 Unix socket 长度并可回退 `/tmp`，不修改用户 Herdr；短路径测试限 POSIX，nightly 路径断言兼容 Windows。[拆分](https://github.com/AltanS/collie/commit/1c529aad)、[socket](https://github.com/AltanS/collie/commit/5b91bf09)、[平台修复](https://github.com/AltanS/collie/commit/153363cf) |
| Durable Cloudflare 示例依赖 | 示例的 `agents` 从 0.28.0 升至 0.28.1；锁定的 MCP SDK 从 1.30.0 升至 1.32.1，MCP client／core／server 从 2.0.0 升至 2.3.1。不改 fork 主运行时依赖，不部署该示例。[PR #472](https://github.com/AltanS/collie/pull/472) |
| 打包与文档 | AUR／Nix 下载元数据跟进官方 1.22.5 产物，保留上游标签所带值。更新 ADR 0061 的浮动 held 卡片、ADR 0109 的提示尾部边界、multiplexer 和 rig socket 文档、样本来源；playground 增加 held 卡片五种状态，更新 ADR 索引和发布记录。[打包](https://github.com/AltanS/collie/pull/496)、[ADR](https://github.com/AltanS/collie/commit/d518e133)、[playground](https://github.com/AltanS/collie/commit/f3531dcf) |

## 下游取舍与维护

本次没有用上游功能替换独立的下游实现。采用上游浮动 held 卡片、IME、列宽和发送安全修复，同时保留以下用户已选择的行为：

- 输入按钮展开按键区，缓存并恢复手机草稿和附件；不要求先清空草稿才能开启直接输入。IME 和发送器重置合入现有 hook，不新增另一套输入状态。
- Codex 默认排队／引导偏好、单次立即引导、原生队列消息提升、模型／模式切换互斥；Resume、Model、Agents、Plan、Review、权限卡片、警告数量，以及自身命令列表和图片占位符校验。
- 已发送灰底用户消息继续普通折行，保留原文空行及有来源依据的终端折行合并，避免上一轮修复被新字符绘制器覆盖。
- Claude 固定高度可滚动 Settings、Agents 和中文问答；Hermes 中文输入、历史、操作提示和发送／通知修复；Cursor 历史；紧凑字体、PWA 视口与 tab 图标。
- 合并区域标注保留 Claude Config 的 bounded Settings 语义。共享 ANSI 绘制器保留下游行连接、镜像搜索高亮及偏移处理；区域数组只追加新样本，避免无意义重排。

适配目录现为 65 项：补上 Claude 后台 agents 下提示卡、OMP 18.11 样本及相关源文件／测试，修正拆分后失效的 fold 测试路径。这些证据注明来自上游真实捕获与本地回放／协议模拟，不能当作本机当前 CLI 已全部实测。

## 验证与交付

- 22 个定向逻辑测试文件通过 7,642 项，7 项保留 todo；12 个相关组件／输入／绘制测试文件通过 482 项，另补跑绑定合同及受影响测试存根。根目录和 Web 类型检查、lint、版本一致性检查通过。
- 相关后端发送协议、提示绑定、socket、nightly 和适配目录检查通过；65 项目录样本全部回放通过。保留真实 ANSI 捕获中的空格和尾部空行。
- Chromium／WebKit 手机模拟共 34 项通过，覆盖中日韩列宽、输入按键区和草稿缓存、320px 布局、Codex 排队／引导及常规输入。浮动 held 卡片的折叠、portal 和高度上限由组件测试覆盖。
- 发布 `v1.22.6+collie.1` 的代码与 annotated tag，正式构建后部署本机 Herdr 管理的安装目录，仅重启 Collie。按当前约定仅从 localhost 回读构建、配置、快照、健康和更新说明；保留一个完整回滚包，清理本轮暂存及更旧自建备份。不创建 GitHub Release，不恢复工作流。
- 未新增模型调用或启用定时检查；没有重新认证所有 CLI、运行完整模型 browser rig、Windows VM、iPhone 真机键盘或 Cloudflare 示例。公网有 OAuth proxy，本轮不作公网验收。
