# 跟进上游 v1.26.0

采用 [v1.26.0 正式标签](https://github.com/AltanS/collie/releases/tag/v1.26.0)，发布 `1.26.0+collie.1`。已核对发行说明、CHANGELOG 和 [v1.25.6…v1.26.0 实际标签差异](https://github.com/AltanS/collie/compare/v1.25.6...v1.26.0)，共 306 个文件；其中包含此前修复分支的重复合并，下面区分新增行为与已经拥有的修复。

## 新功能

- **Crew 共用启动项**：New 页面在任意目标机器上展示 lead 的 `launchers.toml` 和手机添加的启动项；按目标机器检查程序和固定目录，lead 家目录映射到目标机器家目录。同命令的 member 本地项优先；旧 member 能列出 lead 项，但不能检查固定目录。[实现](https://github.com/AltanS/collie/commit/e9f7f98)
- **在目标 member 执行 lead 启动项**：支持普通新空间和新 worktree 的 agent。只接受经 Crew 链路、由 lead 标记的转发，拒绝手机直接伪造；旧 member 拒绝不认识的命令，不会误执行。[实现](https://github.com/AltanS/collie/commit/5f4690e)
- **手机启动项归整个 Crew 管理**：Add／Rename／Remove 交给 lead，所选机器仍决定第一次运行位置。member 原有本地项不会被 lead 编辑；deputy 持有独立的只读副本，接管后保留，取消 deputy 身份时删除副本。旧 deputy 不支持复制。[管理](https://github.com/AltanS/collie/commit/cfbe813)、[持久副本](https://github.com/AltanS/collie/commit/9cff370)
- **Walky 频率限制可配置**：`COLLIE_WALKY_PAIR_LIMIT` 或 `[bridge].walky_pair_limit`，范围 1–100；默认仍是同一对 pane 十分钟六条。[实现](https://github.com/AltanS/collie/commit/58cdc0a)
- **Gentle Shell／pi 任务计划**：`todo` 工具填充既有 Tasks 入口，显示完成数；blocked 当待办，dropped 移除。由 Chat 的 live window 读取，需打开该 pane 的 Chat；dashboard 不显示。其他没有独立任务来源、但 journal 有计划调用的 harness 同样受益。[#669](https://github.com/AltanS/collie/pull/669)
- **后台任务 Jobs 面板**：操作带新增计时器入口，显示运行中的数量；面板列出标签、命令、运行时长和近十分钟已结束任务的退出码。目前由 Gentle Shell 的 `bash_background`／`monitor` 填充，同样依赖 Chat live window；不改变工作灯或 dashboard 计数。隐私遮罩同时覆盖任务标识、标签和命令。[#670](https://github.com/AltanS/collie/pull/670)
- **Windows Crew 实验开关**：`COLLIE_CREWS_ON_WINDOWS=1` 或 `[crew].crews_on_windows`；默认关闭。Windows SSH 不使用连接复用。上游只手动验证 Windows lead／Linux member，Windows 加入 Crew 仍未验证。[#662](https://github.com/AltanS/collie/pull/662)

## 行为与结构调整

- **Walky 用会话名称展示**：Chat、Messages、Crew 回执使用当前 pane 名称，重命名后旧消息也更新。正文中的完整地址可映射为实时名称，在 Messages 中可点击跳转；裸 pane id 只在唯一匹配时映射。失效地址保持文本，并以实例信息防止打开被复用的 pane。终端、CLI、`who` 和线上协议的地址／消息 id 不变。[展示](https://github.com/AltanS/collie/commit/b04a211)
- **Walky skill 要求完整地址**：引用会话时使用 `collie walky who` 的完整地址，不用裸 id、窗口 id 或标签。`collie update` 会自动同步；手动安装构建可能由 doctor 报 skill stale，可用 `collie skill sync` 刷新。[skill](https://github.com/AltanS/collie/commit/4da218b)
- **工作树由 bridge 统一管理**：所有 mux 都从磁盘读取仓库／worktree 关系，无需启动 git 查询归属；Windows 路径使用对应的规范形式。删除 mux 层旧的工作树动词，统一由 bridge 调 git 创建，再让具备 `createSpace` 能力的 mux 打开空间，包含 herdr-core。[归属](https://github.com/AltanS/collie/commit/7806648)、[创建](https://github.com/AltanS/collie/commit/8aa8b35)、[接口收敛](https://github.com/AltanS/collie/commit/ea85e74)
- **工作树失败恢复与远程目标**：沿用 Herdr 的工作树目录或用户选定目录；checkout 成功而空间打开失败时保留 checkout，同请求重试只打开，不重复创建。分支或 ref 不匹配时拒绝，创建失败按规则清理本次新分支。Crew 的计划和创建在所选机器完成，要求该机器同时具备 git 和创建空间能力；仓库事实遍历在家目录边界停止。
- **工作树名称更明确**：dashboard 展示仓库、分支和 `from main` 等基础分支；detached HEAD 用短 SHA，未知信息省略。Switch pane 和 pane 顶栏使用仓库分组，避免随机工作树目录名。[dashboard](https://github.com/AltanS/collie/commit/b2cf339)、[pane](https://github.com/AltanS/collie/commit/165485e)
- **已查看的完成状态回归静止圆环**：done 且 seen 的 pane 使用 idle 外观，绿色计数只表示未读完成；共享已读标记，shell 不变。与本地跨设备读清通知行为兼容。[实现](https://github.com/AltanS/collie/commit/327223f)

## 修复

- **本地 Origin 边界**：另一个 loopback 端口的网页不能直接调用 bridge；Origin 必须匹配 bridge 主机与端口或显式 allowlist，鉴权仍先执行。Vite 仅为自身同源开发请求重写代理 Origin。[实现](https://github.com/AltanS/collie/commit/b4d3b01)
- **herdr-core 新空间**：`createSpace` 用新 UUID 的 `herdr.space`／`herdr.tab` 标签启动 shell，空 core 同样可用，随后由 app 接管；仍不支持自定义空间标签。[实现](https://github.com/AltanS/collie/commit/cf420be)
- **单 pane tab 重命名同步**：从手机重命名 agent 同时更新只有一个 pane 的 tab，多 pane tab 不受影响。[实现](https://github.com/AltanS/collie/commit/bc1d532)
- **断连恢复**：网络失败在任意时刻只保留一个未应答 strike；八秒内仍无健康回答的后续失败才锁存断连，成功回答或唤醒后重新计时。Chat／pane 读失败等待 herd 的统一锁存后再展示保存副本，既有 5xx 规则保留。[实现](https://github.com/AltanS/collie/commit/482e3c8)
- **Gentle Shell 浮动输入框**：pi 支持 `│` 侧边框的 float editor、带草稿及多行输入，增加 `.gentle-shell/agent/sessions` 等 bundled journal 目录。NORMAL／SELECT 模式和引用文本伪造的侧边框仍不认作可发送输入框；pi 1.4.0 仍为 provisional。
- **长时间静默的 Claude 会话**：herdr-core 上 beacon 超时后，如果 PID 和进程开始时间仍匹配，保留 Chat／History 的 session 关联；不借旧 beacon 恢复状态灯，进程结束则移除关联。[#663](https://github.com/AltanS/collie/pull/663)
- **Claude 2.1.317 verbose**：容纳 Heads-up 提示下方的 verbose token 行空隙，避免普通发送退化成二次确认；新增真实及衍生样本。[#668](https://github.com/AltanS/collie/pull/668)
- **光标下的灰色建议**：灰色补全文本首格为反色光标时仍视为 ghost suggestion，单字符真实草稿仍保护。Cursor 对该规则选择退出，避免把 shell 提示误认为空输入；ANSI parser 增加 inverse 信息。[#659](https://github.com/AltanS/collie/pull/659)
- **卡片不再挤掉 Chat**：dock 可收缩，Chat 保留约三分之一视口的阅读空间；未知界面正文滚动锚定底部。本地固定高度 Settings 卡片及小 Esc 保留。[#667](https://github.com/AltanS/collie/pull/667)
- **用量接口退避**：窗口查询至少间隔五分钟；429 尊重 Retry-After，至少十五分钟，连续失败倍增、最高一小时，并记录等待原因。[#672](https://github.com/AltanS/collie/pull/672)
- **Markdown 列表序号**：有序列表被缩进无序列表分隔后，后续仍从原始序号继续。[#674](https://github.com/AltanS/collie/pull/674)
- **pi／OMP 恢复会话定位**：先从启动 argv 找到明确 resume session，再处理同目录多会话的歧义；herdr-core 从 terminal record 暴露前台 PID／argv，优先复用 snapshot 缓存。[#675](https://github.com/AltanS/collie/pull/675)
- **已在上版拥有的修复**：Android composer 关闭浏览器拼写检查、旧 Herdr 使用前台 cwd、AGY 子智能体区域、Hermes 0.22.5 带标题输入框及 Chat 卡片随分支再次合入；保留上版更完整的本地中简繁／动画／同宽保护，没有叠加重复实现。

## 文档、工具与兼容性

新增 ADR 0126（bridge 工作树）、0127（Crew 启动项）、0128（后台任务）；更新既有架构决策、ARCHITECTURE、DESIGN、HC_API、MUX_CONTRACT、CREW_PROTOCOL，以及配置、安装、Crew、multiplexers、安全、排错、升级、Walky、Windows／Claude 手机文档。README 补充已有 Whistle 功能的入口说明。

Claude 2.1.317、OMP 18.6.1、pi 1.3.0 的 rig cassette 随新版 Walky skill 重录；修正 Walky agent 场景的误判和按消息 id 选取目标。增加 Gentle Shell、Claude next-steps／verbose 样本与标签，Windows skip 预算纳入六条 POSIX fake-git 测试；开发代理配合 Origin 收紧。依赖及 `flake.lock` 未变，不恢复 GitHub Actions，不创建 GitHub Release，不发布 Windows 二进制。

## 下游取舍

替换两段功能等价的本地实现：

1. **core 前台进程读取**：采用上游带 snapshot 缓存的 PID／argv 实现，删除本地重复方法及类型；保留本地 Hermes 身份回退和 journal 扩展。正常身份识别不变，pi／OMP 的 resume 定位获得明确 argv 证据。
2. **未知界面卡片滚动**：以共享 `RawMirror` 的 bottom anchor 替换本地独立滚动 effect；保留固定滚动容器、键盘聚焦、小 Esc 和紧凑报告按钮。用户仍从最新正文开始浏览，减少重复维护。

未替换其他独立下游功能。保留 Standard／Fast 单控件、Codex／Claude Queue／Steer 与排队消息立即引导、输入区 Keys 与草稿缓存、默认 1000 行镜像及屏幕优先发送检查、慢历史保护、Hermes Python bootstrap 识别、AGY `.pb` 历史后备、中英文状态栏／卡片、图标／字体／PWA 定制。新增 Jobs 的第六个固定按钮按现有紧凑操作带计算宽度，避免套用上游宽渐变的尺寸。

适配目录补充 Gentle Shell 输入框与 Claude verbose 样本、相关卡片测试；回放不提升为当前 CLI 原生认证。AGY 的撕裂边界反例在旧 HEAD 也失败：单次异常会被既有 settle 重读恢复，因此测试改为持续异常，验证仍在输入前拒绝；发送协议生产逻辑未放宽。

## 验证与部署

- 受影响后端首轮覆盖 42 个文件、3223 项通过；两处断言分别为 Cursor 下游 journal 根计数和上述 AGY 持续撕裂反例，修正后相关 908 项定向重跑通过。额外 herdr-core／unstyled 协议检查 209 项通过、3 项平台跳过。Unix socket 检查在允许本地 socket 的环境运行。
- 受影响 logic 覆盖 15 个文件；新增四条 Claude frame golden 补齐后，该文件 785 项通过。保留一条 Cursor `cursor--idle-bottom-docked` 既有失败，上版已隔离复现，不宣称全套全绿。30 条既有 todo 未作为认证。
- 受影响 DOM 首轮覆盖 39 个文件、2032 项通过；紧凑第六按钮宽度和未知卡片显式正文断言调整后，相关子集均通过。79 项适配目录回放全部通过。
- 320px Chromium／WebKit 共 16 项通过：Claude 四类固定滚动卡片和未知界面小 Esc、Codex／Claude Queue／Steer、中文命令面板默认五项、Jobs 数量／长命令折行／退出码／关闭后输入框位置。新 Jobs 截图快进入场动画，避免保存空白中间态；未改变生产动画。已目视检查 [Jobs 面板](/private/tmp/collie-v1260-jobs-320.png)。这些 API stub 的无 session 提示不代表部署故障。
- 两端类型检查、lint、版本一致性通过；干净 annotated tag `v1.26.0+collie.1` 的构建成功，构建标识 `1.26.0+collie.1+1d126e81c0.1793790391`。后续只有报告／E2E 断言提交，不改变部署产物。

部署验收通过：运行构建 `1.26.0+collie.1+1d126e81c0.1793790391`，监听进程 93008。替换前和重启前均通过固定签名及指定要求检查；只重启 LaunchAgent `herdr.collie`，Herdr、herdr-core、Headroom 和采样智能体进程 PID 均未改变。按约定仅从 localhost 验收，匿名 config 为 403，认证 config／health／snapshot 正常；2 个工作区、6 个智能体，现有 Codex／Claude／AGY 均有 session。实际读取 Documents 内本仓库 README 成功；镜像 1000 行，发送保护读取 40 行。当前没有活跃 Hermes pane，旧验收脚本的 t8 已失效，未把它当作 Hermes 原生验证。

临时验收设备已撤销，原有设备和待配对信息保留；安装目录干净，暂存及旧回滚包已清理，只保留完整且签名正确的 `v1.25.6-collie.1.xbumdf88`。预检查曾将 Surge 的 LAN 8788 监听计入 Collie，现已限定到 `127.0.0.1:8788` 并写入本机部署约定，未改动 Surge。fork main 与 annotated tag 的解引用提交已远端回读匹配。

Walky skill 状态仅作读取：本机没有可更新的有效副本，Claude 路径是指向不存在目标的既有软链接，其他 harness 的 block 未安装；没有借本次升级新建全局规则或改动该软链接。新 skill 内容已随二进制提供，但本机 agent 的完整地址引用行为未认证。

未新增模型调用、定时巡检或完整 CLI 原生发送认证；未做 Windows、跨机 Crew、真实 Gentle Shell 后台任务或真机 iOS／Android 验证。既有 core ANSI 样式、Hermes 完成状态及 Cursor 输入框旧失败不在本次升级修复范围。
