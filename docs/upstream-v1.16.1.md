# 上游 v1.16.1 跟进报告

下游基线为 `v1.16.0+collie.1`，本次交付版本为 `v1.16.1+collie.1`。
已交叉核对上游 [Release](https://github.com/AltanS/collie/releases/tag/v1.16.1)、
[CHANGELOG](https://github.com/AltanS/collie/blob/v1.16.1/CHANGELOG.md#1161---2026-10-03)
及 [v1.16.0 → v1.16.1 的 36 个文件差异](https://github.com/AltanS/collie/compare/v1.16.0...v1.16.1)。
上游标签对应 `0890f72e`。

## 通知与 OMP 输入

这两项修复直接影响终端任务通知和 OMP 的手机输入。

- **补上 working → idle 的完成通知。** Herdr 0.9 有时将完成状态报告为 idle，tmux、zellij
  也使用 idle；此前只按 done 触发的“已完成”通知会漏发。现在本机与 Crew 对端都将该转换
  视为完成，沿用现有通知开关、延迟合并和翻译。blocked → idle 仍表示用户处理了问题，
  不算完成。手动中断也可能产生 working → idle，因此也可能收到完成通知；“已完成”开关
  默认关闭，本次不修改现有设置。[#345](https://github.com/AltanS/collie/issues/345)、
  [`a01c22e6`](https://github.com/AltanS/collie/commit/a01c22e6)
- **识别 OMP 的 claude、borderless 输入框。** 此处的 claude 是 OMP 的外观设置，
  并非 Claude Code。此前这两种外观没有输入框定位器，每次发送都会询问“仍然输入？”；
  现在可正常发送，并读取终端草稿、提示区域及状态栏。支持标题、折行和空输入提示，排除
  补全占位内容；遇到模态菜单或不满足边界的画面仍保守拒绝。新增 8 份 OMP 18.4.10
  原始捕获及反例测试；18.3.0 的较短边框变体来自问题描述，未冒充实测样本。
  [#343](https://github.com/AltanS/collie/issues/343)、
  [`1897d3cc`](https://github.com/AltanS/collie/commit/1897d3cc)

## Windows 修复

本次采用上游 Windows 逻辑及其测试，当前部署仍为 macOS。

- **PowerShell 查找跳过同名目录。** PowerShell 7 环境中，PATH 较前位置可能存在
  `System32\PowerShell` 目录；此前将其误当可执行文件，导致 status、doctor、start、
  restart、stop、uninstall 和更新检查失败。现在要求目标是可执行的普通文件，仍支持
  指向可执行文件的符号链接。该工具查找修复也适用于其他平台。
  [#344](https://github.com/AltanS/collie/issues/344)、
  [`a86d8b91`](https://github.com/AltanS/collie/commit/a86d8b91)
- **doctor 与 crew status 不再推荐不可用的 Crew 命令。** Windows 无 Crew 时明确说明
  此版本不能加入或主持 Crew；Linux、macOS 保留原有提示。
  [`c9322daa`](https://github.com/AltanS/collie/commit/c9322daa)
- **doctor 的访问入口建议符合 Windows 实际行为。** Windows 不由 Collie 自动发布入口，
  提示改为手动运行 `tailscale serve --bg --set-path=/ <port>`，并说明发布后应立即配对。
  手工创建且指向本实例的映射可通过检查；其他程序的映射仍只报告。
  [`ebc5f304`](https://github.com/AltanS/collie/commit/ebc5f304)
- **接受 Headscale 的 HTTP 80 端口入口。** 在询问 HTTPS 证书前先检查有效的手工映射，
  修复入口已经可用却仍报告无 HTTPS 证书的问题；Linux、macOS 的检查规则不变。
  [`1418ba02`](https://github.com/AltanS/collie/commit/1418ba02)

## 文档与发布工具

文档补全 Windows 从安装到配对的流程，并更新已验证范围。

- README、安装指南及 Windows 指南新增完整步骤：安装器、打开独立终端启动服务、
  Tailscale／Headscale 入口、地址配置、配对、日常维护及故障排查。说明 HTTP 下无法使用
  主屏安装、Web Push 和麦克风，手工发布后到首次配对前的访问范围也有明确说明。
- 上游更新了验证记录：已从公开 v1.16.0 安装到 Windows 11 VM，并通过 HTTP／Headscale
  用手机尺寸的桌面浏览器检查访问和配对。跨两个真实发布版本的更新、Windows HTTPS
  入口及相关 PWA 功能仍未验证；这不是本机 Collie 的 Windows 验证结果。
- Windows 发布说明和 zip 内 README 改为提供已上线的 PowerShell 安装器和指南链接，
  删除“尚无安装器”的过时文案。工作约定澄清 Windows 制品门槛从首个携带 zip 的稳定
  发布起生效，或最迟于 2026-11-15 生效；未改变本下游只推代码和标签的发布方式。
- Release 文本生成器与 CHANGELOG 不再每次重复 0.x 升级路径；步骤仍在
  `docs/upgrading.md`，未删除升级功能。
  [`8b1f4faf`](https://github.com/AltanS/collie/commit/8b1f4faf)
- 增加通知、Windows 工具查找、doctor 与 OMP 回归测试；工具目录测试使用实际宿主平台，
  POSIX 专用 doctor 场景显式固定平台。无新增依赖或 flake 锁定变更。

## 下游取舍

没有下游专属功能被上游实现替换，也没有新的功能取舍需要确认。

本次沿用上游通知修复，同时保留本地“查看或操作会话后清除待发／已发通知”的行为及
Crew 各主机独立的已读记录。OMP 原有定位器继续服务其他输入框外观，新定位器补足两种
缺失外观。保留带 `+collie.N` 的版本解析、Cursor 历史、Codex／Claude／Hermes 卡片、
紧凑操作带与弹层、固定滚动卡片、Esc 二次确认、直接输入草稿与组合键，以及实验性折行合并。

继续不创建 GitHub Release、不恢复 GitHub Actions；仅更新 macOS 本机安装并重启 Collie。
Windows 制品和 VM 演练不属于本次下游交付。

## 验证

验证限定在受影响的模块，保留已有待验证项，不为清零数量调用模型。

- 后端／CLI／发布脚本 7 个文件：491 项通过，涵盖本地通知已读清理与新增完成状态。
- OMP、相关发送逻辑及表格区域 11 个文件：3618 项通过，7 项原有 todo。
- 全仓 lint 通过。版本一致性、正式标签构建（含双端类型检查）以及本地／Tailnet
  部署回读随交付执行，最终构建标识见交付回复。
- 本次未改组件布局，因此未重复浏览器截图或现场模型探测。OMP 的证据是上游 ANSI
  捕获回放；Windows 测试在 macOS 上使用平台模拟，不等同于 Windows VM 实测。
