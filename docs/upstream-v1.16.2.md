# 上游 v1.16.2 跟进报告

下游基线为 `v1.16.1+collie.1`，本次交付版本为 `v1.16.2+collie.1`。
已核对上游 [Release](https://github.com/AltanS/collie/releases/tag/v1.16.2)、
[CHANGELOG](https://github.com/AltanS/collie/blob/v1.16.2/CHANGELOG.md#1162---2026-10-04)
及 [v1.16.1 → v1.16.2 的 39 个文件差异](https://github.com/AltanS/collie/compare/v1.16.1...v1.16.2)。
上游标签对应 `14620348`。

## 五项使用修复

本次修复手机滚动、发送完整性和对话操作，没有新增设置项。

- **iPhone 窗格栏恢复横向滚动。** 旧滚动容器设置了 `pointer-events: none`，即使子按钮
  允许点击，iOS Safari 仍无法从按钮开始滚动。现在容器接收触摸，由条带内层控制层级，
  保留紧凑行高、44px 点击范围，以及按钮旁空白处向镜像区透传点击。
  [PR #350](https://github.com/AltanS/collie/pull/350)、
  [`cbc94647`](https://github.com/AltanS/collie/commit/cbc94647)
- **opencode 问答卡不再被无关覆盖行隐藏。** “Type your own answer”下方出现面板路径等
  覆盖文本时，只有指针确实位于自由输入项才视为正在输入；其他情况下忽略覆盖行，
  不把它混入回答或用于绑定界面身份。此修复针对单题单选，多标签问题仍可能保守回退，
  上游将后者留在 #347 跟进。
  [PR #348](https://github.com/AltanS/collie/pull/348)、
  [`418e978f`](https://github.com/AltanS/collie/commit/418e978f)
- **Claude 长回复和语音转写完整送达。** 超过 800 字符时使用一次带边界标记的粘贴，
  避免 Claude 将多个终端读取片段当作多次粘贴，只留下约最后 1 KB。短文本继续原样输入。
  文本内已有的粘贴控制标记会反复清除，避免提前结束粘贴；输入框仍须通过内容验证才能
  发送 Enter。长粘贴旁的图片标记只由本次发送中符合 Collie 上传路径格式、独占一行或
  位于末尾的图片解释，尾随换行不会重复计算图片路径。
  [PR #349](https://github.com/AltanS/collie/pull/349)、
  [`7c926605`](https://github.com/AltanS/collie/commit/7c926605)、
  [`0cf5eec5`](https://github.com/AltanS/collie/commit/0cf5eec5)
- **Claude 的“Switch model?”确认框显示两个选项。** Claude Code 2.1.286 起在会话已有
  模型缓存时可能显示此框；此前只显示通用 Esc，现在可选择切换到目标模型或返回。
  卡片按指针位置发送方向键、重新读取并确认后按 Enter，不猜测数字快捷键；说明正文
  保留在镜像区。新增 2.1.289 的 50／110 列原始捕获、两个指针位置及反例测试，
  并登记 `claude.switch-model` 适配台账。
  [`3e7d1f78`](https://github.com/AltanS/collie/commit/3e7d1f78)
- **方向键之后的卡片操作及时读取新画面。** 所有按键及文本写入在发起和成功后都启动
  快速轮询；上游通用卡片发送成功后等待画面变化再刷新，避免旧高亮最多滞留 6 秒，
  导致下一次点击提示“界面已变化”。等待按实际经过时间限制在最多 1.2 秒，超时会中止
  读取，不会被单次请求的较长超时拖住。原有提交前校验继续生效。
  [`2a64ebad`](https://github.com/AltanS/collie/commit/2a64ebad)、
  [`0cf5eec5`](https://github.com/AltanS/collie/commit/0cf5eec5)

## 文档、测试和打包

文档补充发送证据，打包元数据沿用上游提交中的具体版本。

- ADR 0010 与 `HERDR_API.md` 补充长文本实验：底层字节完整抵达不代表 Claude 的输入框
  完整保留；上游记录了裸发送丢失前段、单次粘贴保留完整内容的对照。
- 增加 Claude 切换模型捕获、粘贴标记清理与图片计数、卡片刷新期限、API 写入刷新、
  opencode 覆盖行及窗格栏事件接收测试。没有新增运行时依赖或修改 flake 锁定版本。
- AUR `PKGBUILD`／`.SRCINFO` 和 Nix `sources.json` 在此标签中从 1.15.0 更新至
  **上游 1.16.1** 的下载地址与校验和，这是上游 #346 的实际内容，不表示它们已指向
  1.16.2，也不是本下游的公开二进制发布。
  [PR #346](https://github.com/AltanS/collie/pull/346)

## 下游取舍

没有新的功能冲突需要选择；机械冲突按现有目标组合。

- 本地 Composer 原先在发送按键前自行启动快速刷新，现由上游 `api.sendKeys` 统一在请求
  发起及成功后处理。直接输入的按键行为、草稿保留、组合键和修饰键标记继续保留。
- 新的 Claude 模型确认识别替代该界面的通用 Esc 回退；其他未识别界面及 Claude 设置页
  继续使用已确认的紧凑卡片、小 Esc 和二次确认。
- 长文本粘贴接入本地发送流程，保留首次界面绑定、发送取消、完整尾部验证和各 Agent
  独有的发送保护。新增组合测试确认长文本加粘贴标记后仍携带首次界面绑定。
- 保留 16px Tab Agent 图标、Codex／Claude／Hermes 卡片、Cursor 历史、紧凑操作带与
  弹层、固定滚动卡片、通知已读清理以及实验性折行合并。本地 Picker 已有逐步读取确认，
  继续使用原有流程，并受益于 API 层统一的快速轮询。
- 不恢复 GitHub Actions、不创建 GitHub Release；交付代码及 annotated tag，更新本机
  macOS 安装，只重启 Collie。

## 验证

使用受影响模块与保存的捕获，未新增模型调用或定时检查。

- Claude／opencode 识别、发送保护、API、菜单和按键写入相关 28 个文件通过，保留
  1 项已知预期失败和 7 项 todo；首次界面绑定与长粘贴组合补充后，发送套件 78 项通过。
- AgentChat、Composer、PaneStrip、TabStrip 共 368 项组件测试通过；适配台账回放通过。
- Chromium 与 WebKit 共 10 个条带浏览器用例通过，涵盖 320px 下最后一个窗格可达、
  滚动容器接收事件、44px 点击范围、两行边界、无纵向溢出及标签切换不挤动邻居。
  两引擎截图保存在本机 `/private/tmp/collie-v1162-evidence/`。未做实体 iPhone 手势复测。
- AUR 与打包更新脚本检查、web 类型检查、全仓 lint 通过。正式标签构建包含双端类型
  检查；最终构建标识与本地／Tailnet 部署结果在交付回复中报告。
- 新模型确认卡的本机证据为上游 ANSI 回放；上游记录了现场按键验证，本次未重新调用
  Claude 模型。原始 ANSI 捕获保留字节与显示空格。
