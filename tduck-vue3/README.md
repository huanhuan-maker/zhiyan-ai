# TDuck Vue 3 本地迁移版

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
.\scripts\tduck\Verify-HTTP.ps1
.\scripts\tduck\Verify-Original.ps1
```

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
