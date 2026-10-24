# TDuck Vue 3 本地迁移版

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
.\scripts\tduck\Verify-HTTP.ps1
.\scripts\tduck\Verify-Original.ps1
```

端到端套件包含真实登录、设计、发布、匿名答题、数据修改、逻辑/主题/设置、草稿、分类和模板、Excel 导入导出、服务端权限与冻结、17 种本地输入题型的真实控件操作和数据库原始答案核对。单元测试中的 25 项属于保留的阶段原型，另有 6 项迁移协议/校验回归。两者在证据中明确区分。

管理员测试只在 tduck_vue3_dev 中临时设置合成登录资料，先备份并在 finally 恢复。不要同时使用该隔离库管理员做手工操作。测试关闭 trace，避免保存认证请求；截图只保存合成问卷与答卷。导入测试使用本机 `D:\Workspace\python312\python.exe` 的标准库修改合成测试 XLSX，不依赖额外表格库。

`Verify-Original.ps1` 对比原项目及原库与备份。期间正常使用原系统会改变账号/Token 表，因此该项可能以非零退出，必须看报告的具体差异，不能自动恢复覆盖正常登录记录。本轮观察到 727 个文件和原 JAR 一致，业务表一致，仅账号/Token 表变化；用户已确认期间使用过原系统。

## 验收范围

[当前功能、实现及限制](../docs/tduck-vue3/FULL_MIGRATION.md) · [运行证据](../evidence/tduck-full/M0.md) · [后端补丁](../patches/tduck-backend/local-acceptance-fixes.patch)

本轮按用户选择，先验收本地问卷完整流程；短信、微信、地图和文件存储随后配置联调。真实 AI Provider 也未调用。27 种题型设计/渲染入口均已接入，不能据此宣称每种外部集成和全部高级属性组合已经验证。原版未实现的公开答卷列表明确提示未启用。头像裁剪为 canvas 适配，尚未证明原组件所有交互等价。

问卷发布后核心题冻结，停止收集也不能直接改核心题，请复制为新问卷再修改。数据统计继续由后端计算，ECharts 展示真实返回值。

没有新增业务表或修改列。数据库迁移采用备份恢复到独立库，核对见 `db/tduck/001_full_migration_audit.sql`。后端修复通过可审查补丁应用于私有构建副本，原源码不改动。修复项目见当前迁移文档。

旧项目、旧知研代码和备份继续保留。所有 Git 操作仅在本地，不执行 push 或公网生产部署。第三方组件保留各自许可证；设计器原包许可仍需在任何对外分发前核实，不把外层 MIT 自动视为独立设计器包的许可。
