# 知研 × TDuck：Vue 3 迁移第一阶段

独立 Vue 3 前端。复用 TDuck 的 Spring Boot + MyBatis-Plus + MySQL 业务，支持账号登录、当前浏览器退出、工作台导航、问卷搜索/状态筛选/分页、文件夹浏览、问卷及题目详情。Apache ECharts 使用后端分页接口的 `total` 展示当前目录状态分布；不是答卷统计。

本次只交付迁移第一阶段（TDuck M0）。保留 `D:\LcProject\frontend`、`backend` 及 `D:\tduck-front`，不替换运行中的 TDuck，不开始 AI 或设计器迁移。

## 目录与环境

- 新前端：`D:\LcProject\tduck-vue3`。
- 原 TDuck 后端：`D:\tduck-survey-form-master`；原 Vue 2：`D:\tduck-front`。
- 本次开发后端：`http://127.0.0.1:8998`；新前端：`http://127.0.0.1:5180`。
- 隔离数据库：`tduck_vue3_dev`，从原 `tduck` 数据库完整恢复；两个数据库不会自动同步。
- 实际使用 Node 22.23.1、npm 10.9.8、Java 17.0.20.1、MySQL 8.0.46；上游 POM 编译目标仍为 Java 8，Spring Boot 2.7.8 / MyBatis-Plus 3.5.3。Java 17 运行本地 JAR 已成功；本阶段未重建或升级上游后端。
- 新前端采用 TypeScript 5.9.3、Vue 3.5.44、Vite 7.3.7、Vue Router 4.5.1、Pinia 4.1.0、Element Plus 2.14.7、ECharts 6.1.0。版本由 lockfile 固定。
- 安装来源：[Node.js](https://nodejs.org/)、[Java 17](https://adoptium.net/temurin/releases/?version=17)、[MySQL 8](https://dev.mysql.com/downloads/mysql/)。本机已有这些环境，不需要为了本阶段重新安装。

## 首次准备（本机已执行，不要重复覆盖）

```powershell
cd D:\LcProject
.\scripts\tduck\Backup-TDuck.ps1
.\scripts\tduck\Initialize-Dev.ps1
# 可选：为隔离开发库创建合成验收账号与问卷，不作用于原数据库
.\scripts\tduck\New-AcceptanceFixture.ps1
```

`Backup-TDuck.ps1` 完整复制后端和 Vue 2 目录（包括本地改动、依赖、Git 元数据），并用 mysqldump 保存库内表、数据、触发器、事件及存储过程，另保存旧知研 Git bundle。所有备份和凭证位于 Git 忽略的 `.local`，不可上传。备份指针见 `.local\tduck-backup-latest.txt`。`Initialize-Dev.ps1` 只允许新建本机 `tduck_vue3_*` 库，存在则拒绝覆盖，生成独立 JWT 密钥、只监听回环地址的配置和运行 JAR。

脚本默认使用当前机器的目录。可通过 `-BackendRoot`、`-LegacyFrontendRoot`、`-MysqlBin`、`-JavaHome` 指定真实安装路径。数据库账号从本地 TDuck 配置读取，不在命令行或报告打印。

## 日常启动（两个 PowerShell 终端）

终端 A：

```powershell
cd D:\LcProject
.\scripts\tduck\Start-Backend.ps1 -JavaHome 'D:\jdk\jdk17'
```

终端 B：

```powershell
cd D:\LcProject\tduck-vue3
npm.cmd ci
npm.cmd run dev
```

如果提示端口已占用，先检查是否本轮服务已在运行；脚本不会停止其他进程。打开 [新工作台](http://127.0.0.1:5180)。可用备份时已有的 TDuck 账号；也可在本地 `.local\tduck-dev\acceptance.json` 查看合成验收账号（owner/other/password）。该文件不提交，不要把密码放进截图或报告。原库后续改密或新增问卷不会同步到开发库。需要强制修改初始密码的账号仍会被拦截。

## 验证

```powershell
cd D:\LcProject\tduck-vue3
npm.cmd run build
npm.cmd test
npm.cmd run test:e2e
npm.cmd audit
cd D:\LcProject
.\scripts\tduck\Verify-HTTP.ps1
.\scripts\tduck\Verify-Original.ps1
```

浏览器测试需要本机 Microsoft Edge 及正在运行的 5180/8998 服务；测试直接连接真实 TDuck 和 MySQL。离线与 XSS 两项是明确标注的故障注入，不能当作后端真实返回的证据。默认关闭 trace，避免保存认证请求。截图仅含合成数据。

`Verify-Original.ps1` 比较备份与原系统当前数据；原系统期间有正常用户登录时，账号/Token 表也会变化，脚本如实以非零退出并列出表名，不自动恢复旧数据。本轮用户已确认使用过原系统；源码/JAR 与其他业务数据仍一致。

构建后可用 `npm.cmd run preview` 在 4180 验证产物，仍经 Vite 的同源代理连接开发后端。正式托管需要为 `/tduck-api/` 配置反向代理并为前端路由配置 SPA 回退；本次没有执行生产部署。`.env.example` 的 `TDUCK_BACKEND_URL` 是 Vite 服务端代理设置，前端没有数据库账号或 JWT 密钥。

## 交付与边界

- [API 对照](../docs/tduck-vue3/API.md)
- [功能差异](../docs/tduck-vue3/FUNCTION_DIFF.md)
- [编辑器及迁移风险](../docs/tduck-vue3/MIGRATION_RISKS.md)
- [人工验收](../docs/tduck-vue3/ACCEPTANCE.md)
- [阶段证据](../evidence/tduck-vue3/M0.md)

原 TDuck 没有服务端注销接口，因此退出只清除本浏览器页签的凭证，不承诺全设备 Token 撤销。验证码/第三方登录、修改初始密码、问卷写操作、完整题型渲染、答题及统计未迁移。

本阶段没有业务表结构变更，SQL 文件 `db/tduck/000_phase1_readonly_audit.sql` 是只读核对脚本，不伪造空 DDL 迁移。原知研 M0/M1 的迁移与证据独立保留。

上游 TDuck 后端和 Vue 2 仓库含 MIT LICENSE；新前端未复制其设计器分发包。Vue/Pinia/Element Plus 等依赖遵循各自许可，Apache ECharts 使用 Apache-2.0。候选设计器只做调查，没有安装进本工程或引入商业组件。Git 仅本地提交，不 push。
