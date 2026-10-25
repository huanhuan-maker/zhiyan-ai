# TDuck Vue 3 本地迁移版

**当前交付轮次 M4-R（2026-10-25）**：问卷左侧“统计”→“题目统计 / 主题与报告”；按发布版本查看有效/缺失分母、量表均值及 ECharts。报告可用本地相同文本分组（非语义模型）或服务端真实 Provider；真实模式先核对生成输入，并确认已有回答数据处理告知与模型传输授权。原文与数值由后端提供，模型只提出带证据编号的候选归纳/解释。保存报告快照、通过/驳回与审核历史，支持 Markdown / JSON 导出；新改删答卷使旧报告显示数据变化。报告范围与限制见 [ANALYSIS_STAGE.md](../docs/ANALYSIS_STAGE.md)，本轮结果、截图和完整命令见 [M4-R.md](../evidence/M4-R.md)。以下 M3/早期迁移段落均为历史，不恢复追问。

M4-R 新增后端源码保存在 `backend-extensions/analysis/`（Git 跟踪）；构建脚本在既有补丁链后复制这些增量源码，避免修改原 TDuck 工程。现有私有配置与 MySQL 数据继续复用。首次升级只对隔离开发库新增两表：

```powershell
Set-Location D:\LcProject
.\scripts\tduck\Build-FullBackend.ps1 -BuildName tduck-analysis-build
.\scripts\tduck\Apply-AnalysisMigration.ps1
.\scripts\tduck\Install-AnalysisBackend.ps1
```

安装脚本只重启经路径及 8997 核对的隔离后端，私下备份原 JAR。升级完成后日常启动仍用 `.\scripts\tduck\Start-FullBackend.ps1` 和前端目录下的 `npm.cmd run dev`，服务已运行时无需重复启动。若正常 `Build-FullBackend.ps1` 重建标准目录，同样会包含新增分析源码。升级脚本不推送、不公开部署、不清空答卷。

**当前范围（2026-10-25）**：用户决定不继续追问方向。公开填写不再加载追问区或请求追问服务；设置入口移除，旧设置URL跳回编辑器；服务端默认拒绝追问操作，日常启动显式关闭该功能。问卷、答卷、历史追问记录及AI建卷保留。临时8996服务已关闭，仍用5180→8997。以下M3开发记录与脚本仅为历史归档；当前验证用`node scripts/tduck/verify-followup-retired.mjs`，见[停用及回归记录](../evidence/tduck-full/followup-retired/README.md)。

M3用户复验修复：追问需先同意、填写开放题、再点击该题下“查看可选追问”；入口和具体跳过原因现已明确显示。新增独立真实模型版演示（`node scripts/tduck/New-FollowupDemo.mjs LLM`），保留原规则演示与用户记录。见[修复及实测](../evidence/tduck-full/m3-visibility/README.md)。

2026-10-25 M3 可选追问：问卷左侧新增“AI追问”，选择允许追问的开放题、调查目标、全卷/每题/时间预算及本地规则或模型辅助策略。设置随发布版本冻结；受访者默认不同意追问，可同意、拒绝、跳过，原回答/追问/回应独立入库。预算与决策可刷新恢复并经真实后端重启验证。模型辅助实际连接本机推理网关`group/group`，规则模式明确标注非模型。日常仍使用5180→8997；当前停在M3验收，不进入M4。见[M3完整报告](../evidence/M3.md)。

M3新增迁移：根目录运行`.\scripts\tduck\Apply-FollowupMigration.ps1`（新建5表，可重复）；后端重建仍用`Build-FullBackend.ps1`，现改为clean package防止旧依赖进入运行包。完整M3回归：`.\scripts\tduck\Verify-Followup.ps1 -RealAI`，需5180/8997及本机合成验收配置已运行。新机器或服务关闭时按下方日常启动步骤操作，不要重复启动已占用端口的实例。

2026-10-25 M2 续传修复：草稿刷新可恢复；同一草稿保存中断后重试补齐剩余题目。重新生成时选项、描述、必填或量表范围变化会独立导入，并提示之前草稿仍在“我的项目”；查询原问卷断网/被拒绝时保留续传记录，恢复后重试，不会自动新建副本。修复前旧版导入记录会提示先检查原问卷。专项命令：根目录 `node scripts/tduck/m2-import-recovery.mjs`。见[本轮修复报告](../evidence/tduck-full/import-recovery/M2_IMPORT_RECOVERY.md)。

2026-10-25 M2 用户问题修复：期望题数可见可编辑；生成后可直接点击“预览答题效果”，不必先导入。同步修复长内容滚动、卷首语导入、生成请求30秒超时和停收草稿误锁定。专项复验命令（仓库根目录）：`node scripts/tduck/m2-usability.mjs`、`node scripts/tduck/m2-slow-request.mjs`、`node scripts/tduck/m2-real-usability.mjs`。真实AI十三题已走通生成到匿名提交/后端统计；详见[本轮报告](../evidence/tduck-full/usability/M2_USABILITY.md)。

当前新建题型已按用户要求收敛为单选、多选、量表、开放题，右侧复杂属性默认折叠；旧问卷题型继续兼容。见 [简化编辑器记录](../evidence/tduck-full/SIMPLE_EDITOR.md)。

2026-10-24 补齐本地核心流程：同一答题会话重复提交只保存一次；量表均值、有效/缺失数与开放题原文由后端提供。见 [本轮验收记录](../evidence/tduck-full/CORE_CLOSURE.md)。AI 尚未进入开发。

2026-10-24 深夜补齐 M1 不可变问卷版本机制：发布生成题目快照版本与 `?t=` 随机令牌链接，答卷按版本绑定；停收后可改草稿、重发布生成新版本并关闭旧版本；旧链接加载旧版内容且拒绝提交；统计按版本口径计算。见 [M1 收尾验收](../evidence/tduck-full/M1_VERSIONS.md)。

当前验收入口：[http://localhost:5180/home](http://localhost:5180/home)。UI 和业务页面来自 `D:\tduck-front`，前端已改为 Vue 3、Vite、Router 4、Pinia、Element Plus 和 Apache ECharts。当前入口是 `src/td/main.js`；此前有限功能的 TypeScript 原型及测试作为历史代码保留。

后端复用 `D:\tduck-survey-form-master` 的 Spring Boot / MyBatis-Plus / MySQL 业务。当前 5180 代理修复版隔离后端 **8997**，使用 **tduck_vue3_dev**；原版 **8890/8999** 和第一轮隔离后端 8998 均保留。原库后续操作不会自动同步到开发库。

本机实际环境：Node 22.23.1、Java 17.0.20.1、MySQL 8.0.46；后端 Spring Boot 2.7.8 / MyBatis-Plus 3.5.3。原 POM 编译目标仍为 Java 8，实际用 Java 17 构建及运行。迁入的 Options API 页面主要为 JavaScript，不能把构建通过等同于所有业务代码完成严格 TypeScript 类型检查。

## 日常启动

当前服务已经运行时不重复启动，不停止占用端口的其他进程。

首次准备的备份与开发库初始化 **本机已执行**，不要重新覆盖数据库。新机器须先按原脚本完成 `Backup-TDuck.ps1`、`Initialize-Dev.ps1`，需要合成测试数据时执行 `New-AcceptanceFixture.ps1`。备份、数据库配置、账号和密钥均保存在 Git 忽略的 `.local`，不可提交。

构建修复版后端（先停用自己启动的修复版实例后再重建同一 JAR）：

```powershell
cd D:\LcProject
.\scripts\tduck\Build-FullBackend.ps1
.\scripts\tduck\Apply-ClosureMigration.ps1
.\scripts\tduck\Apply-VersionMigration.ps1
.\scripts\tduck\Apply-FixMigration.ps1
```

终端 A 启动后端：

```powershell
cd D:\LcProject
.\scripts\tduck\Start-FullBackend.ps1
```

终端 B 启动前端：

```powershell
cd D:\LcProject\tduck-vue3
npm.cmd ci
npm.cmd run dev
```

后端仅监听 127.0.0.1:8997；前端仅监听 127.0.0.1:5180。Vite 的 `.env.example` 指定代理地址，不包含数据库凭证。使用备份时已有的 TDuck 账号，或本地 `.local/tduck-dev/acceptance.json` 中的合成 owner/password；不要把凭证放入截图或报告。原版后来修改过密码，开发库中不会随之改变。

## 验证

以下回归向隔离开发库写入明确标记的合成数据，需要本机 Microsoft Edge 和正在运行的 5180/8997。不会清空已有问卷。

```powershell
cd D:\LcProject\tduck-vue3
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
npm.cmd audit
cd D:\LcProject
node scripts/tduck/check-templates.mjs
node scripts/tduck/version-flows.mjs
node scripts/tduck/version-fixes.mjs
node scripts/tduck/credential-scan.mjs
node scripts/tduck/ai-draft.mjs
node scripts/tduck/m2-ui-flows.mjs
.\scripts\tduck\Verify-HTTP.ps1
.\scripts\tduck\Verify-Original.ps1
```

`ai-draft.mjs`/`m2-ui-flows.mjs` 是 M2 AI 问卷草稿回归：AI Provider 只由服务端调用（`.local/tduck-dev/application-local.yml` 的 `ai:` 段，含本机推理网关地址与密钥，不入库），页面与响应明确标注 Provider/模型/真实 AI 或 Mock；草稿经服务端校验后导入现有四题型编辑器，发布由用户手动完成（复用 M1 版本机制）。

`version-fixes.mjs` 是 M1 修复轮专项回归（22 项）：版本快照冻结表单标题/描述/逻辑/主题、提交回执按版本分键（跨版本同会话键不互相吞答卷）、历史答卷/数据页按所属版本题目渲染与筛选。`credential-scan.mjs` 扫描全部 Git 跟踪文本文件不得包含 `.local/tduck-credentials.json` 中的真实凭据；测试脚本一律从 `.local` 读取账号与口令，不落仓库。

端到端套件包含真实登录、设计、发布、匿名答题、数据修改、逻辑/主题/设置、草稿、分类和模板、Excel 导入导出、服务端权限与冻结、17 种本地输入题型的真实控件操作和数据库原始答案核对。新增高级选项回归覆盖动态标签、嵌套路径、级联子项、加载失败重试、互斥选项和题目禁用属性；动态源是明确标注的合成 fixture，问卷及答卷持久化仍走真实后端。单元测试中的 25 项属于保留的阶段原型，另有 6 项迁移协议/校验回归。两者在证据中明确区分。

管理员测试只在 tduck_vue3_dev 中临时设置合成登录资料，先备份并在 finally 恢复。不要同时使用该隔离库管理员做手工操作。测试关闭 trace，避免保存认证请求；截图只保存合成问卷与答卷。导入测试使用本机 `D:\Workspace\python312\python.exe` 的标准库修改合成测试 XLSX，不依赖额外表格库。

`Verify-Original.ps1` 对比原项目及原库与备份。期间正常使用原系统会改变账号/Token 表，因此该项可能以非零退出，必须看报告的具体差异，不能自动恢复覆盖正常登录记录。本轮观察到 727 个文件和原 JAR 一致，业务表一致，仅账号/Token 表变化；用户已确认期间使用过原系统。

## 验收范围

[当前功能、实现及限制](../docs/tduck-vue3/FULL_MIGRATION.md) · [运行证据](../evidence/tduck-full/M0.md) · [后端补丁](../patches/tduck-backend/local-acceptance-fixes.patch)

本轮按用户选择，先验收本地问卷完整流程；短信、微信、地图和文件存储随后配置联调。真实 AI Provider 也未调用。27 种题型设计/渲染入口均已接入，不能据此宣称每种外部集成和全部高级属性组合已经验证。原版未实现的公开答卷列表明确提示未启用。头像裁剪为 canvas 适配，尚未证明原组件所有交互等价。

问卷发布后生成不可变版本快照：收集中题目冻结；停止收集后可修改草稿，重新发布生成新版本并自动关闭旧版本。旧版本链接（`/s/{key}?t=令牌`）始终加载旧版内容并拒绝提交，旧答卷按版本绑定不受后续编辑影响。数据统计由后端按版本口径计算，ECharts 展示真实返回值，统计页可切换版本。

数据库首次采用备份恢复到独立库，核对见 `db/tduck/001_full_migration_audit.sql`。本轮新增 `002_public_submission.sql`，只在开发库添加提交回执表，不修改已有题目/答卷表。`Apply-ClosureMigration.ps1` 本机已执行，可重复执行，不覆盖已有数据。

后端在 `.local/tduck-closure-build` 构建，顺序应用 `local-acceptance-fixes.patch`、`core-closure.patch` 和 `version-snapshots.patch`。构建脚本仅在私有副本统一换行符，并拒绝覆盖正在运行的同一 JAR。原源码不改动。

公开提交接口现在要求 `X-Submission-Key`：5180 答题页自动生成并在同一标签页会话中复用；旧页面/直接 API 客户端需要适配。独立会话可再次提交，这是重试防重，不是每人限填一次；复制标签页可能继承 sessionStorage，请用独立浏览器上下文模拟另一位受访者。已有历史重复答卷不会自动删除。开放题统计最多展示前 100 条原文，完整记录见数据页；多选比例以本题有效回答人数为分母，合计可超过 100%。

旧项目、旧知研代码和备份继续保留。所有 Git 操作仅在本地，不执行 push 或公网生产部署。第三方组件保留各自许可证；设计器原包许可仍需在任何对外分发前核实，不把外层 MIT 自动视为独立设计器包的许可。
