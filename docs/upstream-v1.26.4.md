# 跟进上游 v1.26.4

本次从 `v1.26.1+collie.1` 跟进上游 `v1.26.2`、`v1.26.3`、`v1.26.4`，发布 `v1.26.4+collie.1`。核对了三版 GitHub Release、CHANGELOG 和完整标签差异：6 个提交、46 个文件，新增 762 行、删除 54 行。

来源：[v1.26.2](https://github.com/AltanS/collie/releases/tag/v1.26.2)、[v1.26.3](https://github.com/AltanS/collie/releases/tag/v1.26.3)、[v1.26.4](https://github.com/AltanS/collie/releases/tag/v1.26.4)、[完整差异](https://github.com/AltanS/collie/compare/v1.26.1...v1.26.4)。

## 完整上游变化

- **v1.26.2：Zoom 只在终端视图显示。** 放大按钮操作的是终端正文，Chat 中不再显示；实际回退到终端的 pane 仍可使用。Settings → Appearance 新增 Zoom pill 的 Screen view／Off 选项，按设备保存。主题增加 `surface.zoom = screen | none`，用户的设备选择优先，其次是主题，默认 Screen view。[实现](https://github.com/AltanS/collie/commit/9034c572e)
- **主题、文案和验证同步更新。** 扩展主题 schema／surface 的封闭 token 集合，更新首次绘制的 `theme-init.js` 及主题文档；12 种语言各补四条文案。加入 Zoom 显示规则和设置控件测试，覆盖 Chat、终端回退、主题与设备选择的优先级、未知存储值和持久化。
- **v1.26.3：修复 Linux Claude 被识别成 shell。** Ubuntu／Debian 的 `/bin/sh` 为 dash 时，hook 的直接父进程可能只是短命 shell，导致 beacon 立即失效。emit 和 hold 现在最多向上查三层已知 shell，使用首个非 shell 祖先进程，再执行原有进程启动时间验证；遇到 PID 1、读取失败等情况有界停止。[实现](https://github.com/AltanS/collie/commit/5f0e6d1c9)
- **进程读取和 doctor 兼容。** Linux 从 `/proc/<pid>/stat` 读取，正确处理名称中的空格和右括号；macOS 使用有一秒超时的 `ps`，其他平台保持原 PID。doctor 识别可带 `exec ` 前缀的 hook 命令。新增包装 shell、不可读进程、边界 PID 和本平台读取测试；不自动改写用户 hooks，也不重启 agent。
- **v1.26.4：iPhone 键盘打开时第一次点发送即可提交。** Send 在 `mousedown` 阻止焦点转移，保留 `pointerdown` 默认行为，避免 iPhone WebKit 丢掉后续 click。忙碌、离线、启动或锁定状态采用 `aria-disabled`、灰度样式和显式点击拦截，按钮仍承接触摸，防止穿透到输入区并收起键盘；长按菜单继续受同一发送条件限制。[实现](https://github.com/AltanS/collie/commit/2c002b4dc)
- **发布元数据。** 另三个提交分别为上游版本号和 CHANGELOG 发布记录。本范围没有依赖、锁文件、打包脚本、AUR／Nix 或 CI workflow 改动，也没有新增模型调用、定时任务或 harness 卡片认证。

## 下游取舍

本次没有独立下游功能被上游替换。Send 的焦点和不可用状态机制采用上游实现，保留模型／模式切换期间的互斥保护，以及直接输入模式下可随时退出的 Stop。对应本地断言改为检查 `aria-disabled`，并继续验证锁定时不会发请求。设备设置合并保留本地 `rejoinExperiment` 与上游 `zoomPill`，没有覆盖用户既有偏好。

保留 Codex／Claude／AGY Queue／Steer、排队消息立即引导、输入区 Keys／草稿缓存、Standard／Fast 单控件、默认 1000 行镜像和屏幕优先发送保护、Hermes／AGY 状态栏和识别、AGY `.pb` 历史后备、固定卡片／小 Esc、图标／字体／PWA 定制。继续不启用 GitHub Actions。

## 验证与交付

定向后端 beacon、hooks、hold 与 bridge/beacon 共 352 项通过；受影响前端 16 个文件、1,102 项通过（本地旧 `disabled` 断言更新后单文件 285 项复验通过）。两端类型检查、lint、版本一致性通过。

320px Chromium／WebKit 共 4 项通过：一次触摸仅发送一条、忙碌按钮拦截重复触摸且输入区保留焦点、发送成功清空草稿；Zoom 关闭、重载持久化及页面无横向溢出。忙碌按钮使用强制触摸，防止 Playwright 等待 `aria-disabled` 恢复后才操作；初次测试的长等待触发了协议重试，修正的是测试操作。已保存并目视检查 [WebKit 发送后截图](/private/tmp/collie-v1264-send-focus-320.png)。

干净标签构建通过，构建标识 `1.26.4+collie.1+6b07ee0341.1793885738`。标签后仅修改 E2E 操作及报告，没有改变运行产物。main 与 annotated tag 已推送；显式刷新 `origin/main`，避免远端追踪引用过旧而显示虚假的 ahead 数量。收尾再次查询 GitHub Release，最新稳定版仍为 v1.26.4。

部署前及重启前均验证固定 `Collie Local Signing` 签名和 `dev.collie.bridge` 指定要求，仅重启 LaunchAgent `herdr.collie`，新监听进程 23012。localhost 的 build-info／响应头／config.build 一致，匿名 config 为 403，认证 health／config／snapshot 正常；3 个工作区、7 个智能体，现有 Codex／Claude／AGY session 正常。Documents 内本仓库 README 实际读取成功；空闲 pane 的镜像为 1000 行、发送保护为当前屏幕 45 行，两次读取合计 87ms。

Herdr、herdr-core、Headroom 和采样 agent PID／执行路径均不变，没有向用户会话发键或执行终止操作。临时验收设备已撤销，已有配对信息保留；清理暂存与旧 v1.26.0 回滚，仅保留完整签名的 `v1.26.1-collie.1.plk7lbda` 回滚包。按约定只从本机验收，未访问或绕过公网 OAuth。没有活跃 Hermes pane，未做 Hermes 原生验证。

未运行全量测试或调用真实模型；浏览器 stub 不代表真实 iPhone 软件键盘、Linux dash 主机或所有 agent 原生发送的认证。既有 core ANSI 样式和 Hermes 完成状态缺口不在此次补丁范围。
