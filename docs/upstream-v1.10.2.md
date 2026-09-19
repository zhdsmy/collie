# v1.10.2 上游合并说明

目标下游版本：`v1.10.2+collie.1`。本次上游发布只动安装识别与子进程环境，全部落在 `cli/`、`.adr/`、`packaging/`；下游改动集中在 `web/`，因此没有功能重叠，也没有被上游替代的下游实现。

## 核对范围

- 上游 Release：[v1.10.2](https://github.com/AltanS/collie/releases/tag/v1.10.2)，2026-09-19 发布。
- 上游比较：[v1.10.1...v1.10.2](https://github.com/AltanS/collie/compare/v1.10.1...v1.10.2)，5 个提交、20 个文件、+540 / -51。
- 上游发布提交：`dc7f193b`。
- 合并前下游：`v1.10.1+collie.7`，`78dc15c9`。
- 文件分布：`cli/` 10 个、`.adr/` 3 个、`packaging/aur/` 2 个、`packaging/nix/` 1 个，以及四个版本／变更文件（`web/package.json` 只改版本号）。**没有** `CLAUDE.md`、`docs/`、`bridge/`、`web/src/`、依赖或 Workflow 变更。
- 已交叉核对官方 Release、CHANGELOG、五个提交的逐个 diff 与实际文件差异；下面的测试、文档与打包变化在 Release 摘要中未逐项列出。

## 上游完整变更

### 1. 一个目录只有被仓库“拥有”时才算 checkout（#243）

`isGitCheckout` 原来问的是 `git rev-parse --git-dir`。git 的仓库发现会**向上走**，所以这个问题实际是“某个仓库包含了这个路径”，在任意深度都返回 0。后果是：`$HOME` 本身是 git 工作区（dotfiles 仓库的常见形态）时，位于 `~/.local/share/collie/versions/1.10.0` 之类的二进制安装被判定为 `linked-clone`，`collie update` 于是去读**dotfiles 的 remote**、拒绝该 release，并提示操作者把 `COLLIE_UPDATE_REPO` 设成自己的 dotfiles 仓库。

现在改为 `git rev-parse --show-prefix`：它输出工作目录相对仓库顶层的路径，正好在顶层时为**空**。一次调用，比较在 git 内部完成，两侧都已解析符号链接，因此通过符号链接到达的 checkout 仍被认作 checkout（本机开发通道的形态）。

该问题可被回答的前提是下一个变更（没有子进程继承会迁移仓库的变量）。

### 2. git 数据读不出来的 checkout 不再被当成二进制安装

git 对“此处没有仓库”和“此处有仓库但我读不了”（`HEAD` 损坏、`.git` 权限不可读、`.git` 文件指向已不存在的目录）返回的退出码**都是 128**，stderr 不是契约。原逻辑在 `isGitCheckout` 为假后继续往下走，命中 `versions/` 父目录 + `current` 符号链接那一支，判定为 `binary` —— 而二进制路径会把版本目录重命名进 `.trash/`。

也就是说：一个 `.git` 因为一分钟读不出来（权限抖动、`HEAD` 写了一半、`git gc` 被中断）的工作区，会被操作者为了**升级**而运行的动词整个挪走，连同其中未提交的工作。

现在 `InstallProbe` 增加 `hasGitEntry`（`<root>/.git` 存在，目录或 linked worktree／submodule 用的那一行文件都算），`classifyInstall` 在落到 `binary` 之前先返回 `{ kind: "unknown", why: "broken-checkout" }`：停下并说明，绝不穿过。

用户可见的两处文案随之更新：

- `collie doctor` 把这一种与“无法判断安装方式”分开，给出 `a checkout whose git data is unreadable (<root>/.git exists, git will not read it)`，修法是 `git -C <root> status` 看 git 怎么说、修好或重新 clone 后再升级 —— 而不是重装（重装会丢掉工作区）。
- `collie update` 的拒绝理由新增 `broken-checkout` 分行：`<root>/.git exists but git will not read it`。

`unknown` 的原因集合因此从 3 个变成 4 个：`no-marker`／`orphan-layout`／`loose-binary`／`broken-checkout`。**安装种类本身仍是三种**，本文件与下游 `CLAUDE.md` 里“三种答案”的说法不受影响。

### 3. 没有子进程继承会迁移仓库的 git 变量（ADR 0049）

`GIT_DIR` 及其七个同类变量直接指定仓库、索引或对象库的位置，git 在任何工作目录都服从，并且**胜过 `-C` 和命令行上的路径**：它们不是调整发现，而是取代发现。Collie 此前把自己的整个环境交给每个子进程，所以带着 `GIT_DIR` 运行 `collie` 时，它问的每个 git 问题都在问别人的仓库：`isGitCheckout` 在没有 `.git` 的目录报告 checkout，`originOf` 读那个仓库的 remote，`update` 会去推进它。

两条进入路径都很普通：一是 shell profile 为 dotfiles 管理器导出这些变量（与 #243 同一批人群）；二是 **git hook** —— git 给每个 hook 都设置 `GIT_DIR` 和 `GIT_PREFIX`，所以一个调用 `collie` 的 hook 会在无人写下这些变量的情况下把它们递进来。项目自己已被后者伤过：`scripts/collie-cli.test.sh` 顶部记录着，pre-push 运行该套件时继承的 `GIT_DIR` 把它内部的 `git -C "$sandbox" init` 变成对调用方仓库的重新初始化，从 linked worktree 触发时还往共享 config 写了 `bare = true`，把开发者的 checkout 弄成不可用；该套件自那以后用 `unset "${!GIT_@}"` 自卫，而**发布出去的二进制从未长出同样的防护**。

做法（`cli/sys.ts`）：

- `GIT_RELOCATORS` 八个名字被剥离：`GIT_DIR`、`GIT_WORK_TREE`、`GIT_COMMON_DIR`、`GIT_INDEX_FILE`、`GIT_OBJECT_DIRECTORY`、`GIT_ALTERNATE_OBJECT_DIRECTORIES`、`GIT_NAMESPACE`、`GIT_PREFIX`。每个都表示一个位置，其余变量都不符合。
- 接缝是 `realExec`，作用于**每个**子进程而不只是 git，五个构造点加 bridge 一并覆盖。
- 过滤在 `envAdd` 合并**之后**再跑一次，否则 `envAdd` 就是被剥离变量回来的唯一通道。
- 唯一不走 `Exec` 的 git 子进程 —— `cli/remote.ts` 里的 `git bundle create` —— 手工套用同一条规则。没有它，导出了 `GIT_DIR` 的 lead 会把**另一个仓库**打成 bundle 交给 peer，而它前面那句 `rev-parse HEAD` 校验会因为读的是同一个被重定向的仓库而照样通过。

刻意**不**剥离三组：`GIT_CEILING_DIRECTORIES` 只阻止发现向上走，只能把“是 checkout”变成“不是 checkout”，最终方向是拒绝而非删除；`GIT_CONFIG_*` 能经 `core.worktree` 触达仓库，但只在发现已经找到真仓库之后，且 hermetic build／update 路径有意设置它们；`GIT_SSH_COMMAND` 与凭据类变量决定的是**怎么认证**而不是**看哪个仓库**，剥离它们会为了一个理论暴露破坏真实的升级。

### 4. 文档与打包

- 新增 [ADR 0049](https://github.com/AltanS/collie/blob/main/.adr/0049-no-child-inherits-a-relocated-repository.md)，并在 ADR 索引登记；ADR 0048 顺带改一行。
- `packaging/aur/.SRCINFO`、`PKGBUILD`、`packaging/nix/sources.json` 由机器人提交 `6066cfa5`（#237）跟踪到 **1.10.1**（注意不是 1.10.2，它落在 1.10.1 标签之后、因此计入本次范围）。下游不发布 AUR／nix 包，这三项仅为记录。
- 无依赖更新、无后端协议变更、无安装迁移、无构建工具链调整、无 GitHub Workflow 变更。

## 下游合并取舍

| 部分 | 处理及用户可见差异 |
| --- | --- |
| 安装识别（`isGitCheckout`、`probeInstall`、`classifyInstall`） | **采用上游实现**。上游改的是上游自己的旧算法，下游在 `cli/install-kind.ts` 上没有改动，因此这里不是取舍而是直接跟进；下游只是继续依赖它，`CLAUDE.md` 里“三种安装种类”的说法仍然成立。 |
| 子进程环境（`withoutGitRelocators`） | 采用上游实现。本机 shell 里只有 `GIT_PAGER`，不是八个迁移变量之一，也不在该剥离名单内（见 ADR 0049 的说明），因此本机行为不变。 |
| 下游 `collie version` 拼写 | **保留**：`cli/context.ts` 的 `displayVersion()` 仍把 `+collie.N` 后缀渲染出来（`cli/lifecycle.ts`、`cli/program.ts` 调用它）。上游只打印 `collieVersion`，下游版本号需要完整可见。 |
| 其余 `cli/` 差异 | 保留 `cli/docs-embed.test.ts`、`cli/tools.test.ts`、`packaging/refresh.test.sh` 里下游自有的期望值，均为测试／打包刷新脚本，不涉及运行时行为。 |
| `web/` 全部内容 | 本发布未触及，下游原样保留：Composer、状态条与其防闪断保持（`use-held-statuslines`）、Claude tip 图标与 aside 规则、Hermes diff 矩形、Cursor 视图、字体与底部安全区。 |
| 发布规则 | 保留下游 CHANGELOG 与独立发布提交，版本用 `1.10.2+collie.1`；只推 `main` 和附注标签，不创建 GitHub Release，不恢复 Actions。 |

**本次没有任何一项独立下游功能被上游整体替代。** 文本冲突只在四个版本／变更文件（`package.json`、`web/package.json`、`herdr-plugin.toml`、`CHANGELOG.md`），按既有约定解析：三个版本文件保留下游版本方案，CHANGELOG 保留下游标题并新增一条记录本次合并的 `Unreleased` 条目；上游自己的 `## [1.10.2]` 段落由发布提交原样插入到新的 `## [1.10.2+collie.1]` 标题之下。

## 全部上游提交

| 提交 | 内容 |
| --- | --- |
| [6066cfa5](https://github.com/AltanS/collie/commit/6066cfa5) | 机器人：AUR／nix 打包跟踪到 1.10.1（#237） |
| [d43f8fd1](https://github.com/AltanS/collie/commit/d43f8fd1) | 仓库必须拥有该目录才算 checkout（`--show-prefix`；#243） |
| [0091f5ec](https://github.com/AltanS/collie/commit/0091f5ec) | git 读不出来的 `.git` 停下并说明，不继续当成二进制安装 |
| [dcd313b1](https://github.com/AltanS/collie/commit/dcd313b1) | 没有子进程继承会迁移仓库的 git 变量（ADR 0049） |
| [dc7f193b](https://github.com/AltanS/collie/commit/dc7f193b) | 发布 1.10.2 |

## 验证范围

上游本次的改动全在 CLI：安装种类判定、`doctor` 文案、以及所有子进程的环境。验证因此集中在“本机两种真实安装是否仍被正确识别”“`GIT_DIR` 这类变量是否真的不再影响结果”“现有 `clip`／bridge 行为未被牵动”三点，外加常规的前后端类型、lint、测试与正式构建。浏览器与真机行为不在本次影响面内。

- 二进制安装（`~/.local/share/collie`，detached checkout）与开发 checkout 仍分别被识别为原有种类，`collie doctor`／`version` 正常。
- **三处修复都在本机用真实二进制做了前后对照**（旧版 `1.10.1+collie.7` vs 新版 `1.10.2+collie.2`）：
  1. **#243**：把一个合法的二进制安装树放进一个 origin 为 `https://example.invalid/wrong-repo.git` 的仓库里，旧版 `doctor` 报 `linked clone …（origin https://example.invalid/wrong-repo.git）` —— 正是把别人的仓库当成自己的；新版不再如此。根因用两个 git 问题即可复述：在同一深度问 `--git-dir` 得到 `/private/tmp/collie-gitdir-probe/.git`（退出码 0，只说明“有个仓库包含这里”），问 `--show-prefix` 得到 `new/versions/1.10.2/`（非空 = 不是顶层 = 不是 checkout）。
  2. **读不出来的 `.git`**：直接调用发布出去的 `cli/install-kind.ts`，二进制布局 + `hasGitEntry` 从 `{kind:"binary"}` 变为 `{kind:"unknown", why:"broken-checkout"}`，不再落到会把版本目录挪进 `.trash/` 的那一支。
  3. **ADR 0049**：在真实安装上用 `GIT_DIR=/tmp/collie-gitdir-probe/.git` 跑同一条命令，旧版 `install` 与 `update-source` 两行都跟随了这个诱饵仓库（`linked clone … origin wrong-repo`），新版两行都给出自己的仓库；再叠加 `GIT_WORK_TREE`／`GIT_PREFIX`／`GIT_NAMESPACE`（git hook 的环境形态）结果不变。同时确认 `GIT_PAGER` 保留、未被误删。
- 上游自带的定向测试（`cli/install-kind.test.ts` 与 `cli/sys.test.ts` 各新增上百行）全部通过；根测试套件 1499 + 128 pass / 0 fail，全量 lint 与前后端两个 typecheck 通过；正式构建（`bun run build`）通过并核对产物版本；web 全量套件 9167 pass / 0 fail。
- 未覆盖：本机 `$HOME` 本身不是 git 仓库，因此上表第 1 项用的是“二进制安装位于某个仓库内部”这一等价形态，而非真实 dotfiles 工作区；真实 dotfiles 环境的表现以上游 `cli/install-kind.test.ts` 的表驱动用例为准。
