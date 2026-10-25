# 知研 AI

> **当前交付 M5-B（2026-10-25）**：系统配置 → AI配置已替换旧DeepSeek开关，导入实际在用模型；支持自定义供应商、同供应商多模型、Chat Completions / Responses / Anthropic三种协议，以及每模型思考强度、上下文窗口、历史提问轮数、最大输出Token。管理员保存后统一用于助手/建卷/报告，密钥加密且不回显。启动升级见 [迁移版README](tduck-vue3/README.md)，完整实测与验收见 [M5-B.md](evidence/M5-B.md)。以下M5-A及更早记录为历史。

> **当前交付 M5-A（2026-10-25）**：侧栏“我的问卷”下新增“问卷助手”，入口 `http://localhost:5180/home/assistant`。通过真实只读 MCP 查询自己的问卷、指定发布版本的统计、关键词匹配原文及已审核报告；支持真实 AI 问题理解、本地规则降级与持久化对话。本轮是字面关键词检索，尚未实现向量语义 RAG。管理员现有四项菜单，普通用户两项；下方精简记录为历史。安装与启动见 [迁移版说明](tduck-vue3/README.md)，范围见 [ASSISTANT_STAGE.md](docs/ASSISTANT_STAGE.md)，测试、截图和验收步骤见 [M5-A.md](evidence/M5-A.md)。本轮交付后等待用户验收，追问继续停用。

> **工作台精简（2026-10-25）**：按用户要求，管理员侧栏只保留“我的问卷、用户管理、系统配置”；普通用户仍只显示“我的问卷”。共享模板、模板分类、主题库管理及回收中心已移除前端入口，旧地址返回首页。问卷内部外观设置、AI 建卷、统计与报告保留；已有数据库记录不清理。见 [精简验证](evidence/tduck-full/WORKSPACE_MENU_CLEANUP.md)。

> **当前轮次 M4-R：统计与可追溯分析**。用户已授权在固定问卷基础上增加按版本统计、开放题证据归纳、报告人工审核及 Markdown/JSON 导出。动态追问继续停用。本轮范围见 [ANALYSIS_STAGE.md](docs/ANALYSIS_STAGE.md)，交付与实测见 [M4-R.md](evidence/M4-R.md)。实际入口仍为 `tduck-vue3` / 5180 → 8997；历史原型与下文旧端口不作为当前入口。

> **当前开发入口（2026-10-25）**：[TDuck Vue 3 二次开发版](tduck-vue3/README.md)，访问 `http://localhost:5180`，隔离后端8997。用户已决定停止追问方向，入口与服务端追问调用已停用；继续保留AI建卷、固定问卷、收集与真实统计，见[停用记录](evidence/tduck-full/followup-retired/README.md)。原 `backend/`、`frontend/` 及以下M0/M1说明为旧原型归档。

以下为旧原型的 **M0 工程联通 + M1 固定问卷闭环** 归档。固定技术栈仍为Vue 3 + ECharts、Spring Boot + MyBatis-Plus、MySQL 8.x；当前迁移版的AI和浏览器验证情况以页首M3报告为准。

交给其他 Agent 验收或续开发，请先读 [Agent 交接文档](docs/AGENT_HANDOFF.md)，文末提供可复制的接手指令。

## Windows 安装要求

Windows 10/11、PowerShell 5.1/7、JDK 17+、Node 22.12+（或 20.19+）、MySQL 8.x。无需全局 Maven 或 Docker。首次安装依赖需要网络。

官网：[JDK](https://learn.microsoft.com/java/openjdk/download)、[Node](https://nodejs.org/)、[MySQL](https://dev.mysql.com/downloads/mysql/)。依赖锁定及官方兼容依据见 [DEPENDENCIES.md](docs/DEPENDENCIES.md)。

以下命令从项目根目录开始。若 PowerShell 禁止脚本，仅对当前终端执行：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
java -version
node -v
npm.cmd -v
```

## 初始化已有 MySQL（推荐，无 Docker）

在 Windows“服务”中启动自己的 MySQL 8 服务；若服务名是 MySQL80，可在管理员终端运行 `Start-Service MySQL80`。不要重复初始化已有数据目录。

```powershell
# 已有配置时不要复制覆盖
Copy-Item .env.example .env
notepad .env
# 根据实际安装路径修改参数；会提示输入现有 root 密码
.\scripts\Initialize-Database.ps1 -MySqlHome 'D:\MySQL\MySQL Server 8.0'
```

默认地址 `127.0.0.1:3306`，开发库 `zhiyan_ai`、测试库 `zhiyan_ai_test`，专用账户 `zhiyan`。可在 `.env` 修改 host/port；DB_PASSWORD、APP_ADMIN_PASSWORD 留空时脚本自动生成并写入 `.env`。脚本只创建两个库并授权专用账户，不删除数据、不改变 root 或已有账户的密码。若同名账户密码不匹配，换一个独立 DB_USER 后重试。**本次已完成初始化，无需重做。**

发起者初始网页登录账户位于 `.env` 的 APP_ADMIN_USER / APP_ADMIN_PASSWORD。M1 仅在该用户名尚不存在时创建数据库用户，以后修改环境密码不会重置既有账户密码；也可以在网页登录页注册新账户。`.env` 已被 Git 忽略，禁止上传密码、密钥或备份。

## 没有 MySQL 服务时：隔离本地实例（同样无需 Docker）

下载并解压 MySQL 8 Windows ZIP；仅使用项目独立 `.local/mysql-data`，不触碰其他实例：

```powershell
.\scripts\Start-LocalMysql.ps1 -MySqlHome 'D:\MySQL\MySQL Server 8.0' -Port 3307
# 先复制 .env.example 为 .env（如尚不存在）；将 .env 中 DB_PORT 改为 3307
notepad .env
$localRoot = Get-Content .\.local\mysql-root-password.txt -Raw
.\scripts\Initialize-Database.ps1 -MySqlHome 'D:\MySQL\MySQL Server 8.0' -AdminPassword (ConvertTo-SecureString $localRoot -AsPlainText -Force)
Remove-Variable localRoot
```

监听回环地址，不安装系统服务。关闭时使用安装目录的 `mysqladmin.exe -h 127.0.0.1 -P 3307 -u root -p shutdown`。本次实际测试采用已有 3306 实例；此备用脚本验证状态见 M0 报告。

## 启动命令

终端 A（根目录）：

```powershell
.\scripts\Start-Backend.ps1 -JavaHome 'D:\jdk\jdk17'
```

终端 B（根目录）：

```powershell
Set-Location .\frontend
npm.cmd ci
npm.cmd run dev
```

需要手机扫二维码填写时改用局域网模式（同端口，额外监听局域网网卡）：`npm.cmd run dev:lan`，配置步骤见 [局域网二维码分享指南](docs/LAN_SHARING_GUIDE.md)。

Java 已在 PATH 且 JAVA_HOME 正确时可以省略 `-JavaHome`；路径可换成自己的安装目录。

前端：<http://127.0.0.1:5173>，后端健康：<http://127.0.0.1:8080/actuator/health>。

页面：`/` 我的调查、`/login` 登录/注册/会话、`/surveys/new` 手工建卷、`/surveys/{id}/edit` 编辑/预览/发布/关闭、`/surveys/{id}/results` 指定版本统计、`/public/{token}` 公开答题。发布会生成独立随机链接，请自行保存；编辑页”分享已发布版本”面板可配置电脑局域网 IPv4 并生成手机可扫的本地二维码（详见 [局域网指南](docs/LAN_SHARING_GUIDE.md)）。匿名填写不要求发起者登录。点击”保存进度”后同标签刷新可从数据库恢复，最终提交后计入回收统计。

M1 支持单选、多选、量表、开放题；发布核心题冻结，之后编辑草稿不改变旧版。ECharts 读取真实后端人数，后端给出版本、有效分母、缺失、比例与均值。`/public` 无完整链接时显示说明；`/statistics` 保留明确标记的 M0 联通诊断，不冒充调查统计。

后端仅绑定 127.0.0.1；Vite 同源代理 `/api`、`/actuator` 至 8080。若修改 SERVER_PORT，须同步修改 `frontend/vite.config.ts` 的代理地址。前后端均按 Ctrl+C 停止，MySQL 独立运行。

直接使用 Maven Wrapper 的等效命令：

```powershell
$env:JAVA_HOME='D:\jdk\jdk17'
$env:Path="$env:JAVA_HOME\bin;$env:Path"
. .\scripts\Load-Env.ps1
Set-Location .\backend
.\mvnw.cmd spring-boot:run
```

## 真实测试和构建

先启动 MySQL 并初始化两个库。测试使用 DB_TEST_NAME，必须以 `_test` 结尾；不要配置有业务数据的库。MySQL 不可用时测试明确失败，不自动换用 H2 或 Mock。

```powershell
# 根目录；内部实际执行 .\mvnw.cmd clean test
.\scripts\Start-Backend.ps1 -JavaHome 'D:\jdk\jdk17' -Test
Set-Location .\frontend
npm.cmd ci
npm.cmd run build
```

JUnit 报告：`backend/target/surefire-reports/`。最新42项通过（0失败/错误/跳过），包含M0回归9项、M1集成16项、发布生命周期与会话恢复11项（含轮换后恢复/关闭只读/LAN地址端点）、迁移1项、真实并发4项、限流单元测试1项。前端另有 vitest 单元测试14项（`npm.cmd run test:unit`：局域网链接构造、二维码编码与显示一致、无效地址拒绝、轮换后二维码更新）。集成测试用真实MySQL8，MockMvc只是HTTP测试入口；覆盖账户/所有权/版本冻结/恢复/幂等/分母/关闭/过期/输入及并发回归，测试数据回滚或清理。Windows PowerShell5.1和PowerShell7均已真实执行脚本。

自动启动/重启并检查持久化（先关闭占用 8080 的后端，根目录执行）：

```powershell
.\scripts\Verify-M0.ps1 -JavaHome 'D:\jdk\jdk17'
# M1：创建四题型合成调查、两独立HTTP会话，核对2份/50%/均值3并真实重启
.\scripts\Verify-M1.ps1 -JavaHome 'D:\jdk\jdk17'
```

脚本打包并启动真实 Java 服务，再停止并重启验证持久化。M0 另以错误数据库端口验证启动失败。M1 每次保留新建的合成调查和两份答卷供复核，最新ID在 `evidence/m1-smoke.json`；公开链接保存在忽略的 `.local/m1-demo.json` 的 publicPath。该本地文件也含匿名能力凭证，请勿提交或公开。日志位于 `.local/`。

## M0 API 与安全边界

| API | 说明 |
|---|---|
| GET `/actuator/health` | 公开，无敏感详情，MySQL 纳入健康检查 |
| GET `/api/auth/csrf` | 公开，返回 CSRF token 和请求头名 |
| POST `/api/auth/login` | 表单 username/password + CSRF；成功 204 |
| GET `/api/auth/me` | 已登录账户信息 |
| POST `/api/auth/logout` | 会话 + CSRF，销毁会话 |
| GET/POST `/api/system-checks` | 会话；最新 20 条 / 写入，POST 必须 CSRF |
| GET `/api/system-checks/summary` | 会话，真实 MySQL 总数 |

POST 诊断 JSON：`{"message":"M0 联通验证"}`，1–200 字；参数错误 400，未登录 401，CSRF/权限失败 403，数据库读写不可用 503。Vue 文本插值不会执行诊断消息中的 HTML。

Spring Security 使用 HttpOnly、SameSite=Strict cookie、30 分钟空闲会话、会话固定攻击保护；CSRF 保持启用。M1账户及BCrypt密码哈希存在MySQL，管理登录会话重启后需重新登录；调查/版本/匿名填写会话/答案/诊断记录均在真实MySQL中保留。每个发起者只管理自己的调查，所有权校验在服务端执行。

完整 M1 API 契约见 [M1_API.md](docs/M1_API.md)。POST鉴权接口100次/分钟、公开写入300次/分钟，按本地连接IP限流。当前为本地部署，HTTPS/Secure cookie/数据库TLS及分布式限流尚未作生产验证。匿名token只在标签页sessionStorage中保留，清理后无法找回原填写；分享token在发布时返回一次，丢失后发起者可在编辑页对指定版本安全轮换（旧链接立即失效）。没有真实AI或Mock AI。

## 常见问题

- `Access denied`：核对本地配置、账号授权；不改用临时数据库。
- `Unknown database`：执行数据库初始化；表由 Flyway V1–V3 自动创建/迁移，勿手动重复执行或修改已应用迁移。
- 错误数据库配置：启动时 Flyway 会报连接失败，运行时接口返回 503 / 健康非 UP，不生成假数据。
- 401：先登录；403：重新取 CSRF，前端已自动处理，勿关闭 CSRF。
- 找不到 Java：设置 JDK 的 JAVA_HOME 或传 `-JavaHome`。
- Maven Wrapper 使用阿里云中央镜像下载 Maven；依赖按 Maven settings/中央仓库解析。首次下载较慢，不需改变版本或全局设置。
- npm 网络故障：可临时 `npm.cmd ci --registry=https://registry.npmmirror.com`，不要移除 lockfile。

数据库迁移与备份说明：[db/README.md](db/README.md)。验收报告：[M0](evidence/M0.md)、[M1](evidence/M1.md)。M0有历史真实截图；M1完整浏览器端到端/窄屏/截图尚未完成，工具安全策略拦截后未绕过，不以自动测试代替人工UI验收。六库源码调研：[OPEN_SOURCE_RESEARCH.md](docs/OPEN_SOURCE_RESEARCH.md)，未复制集成上游代码。原始材料说明保留于 `docs/DELIVERY_PACKAGE_README.md`。

**以上为M0/M1原型归档。追问方向已按用户决定停用；后续阶段尚未推进。**
