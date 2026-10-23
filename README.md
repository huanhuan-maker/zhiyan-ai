# 知研 AI

当前交付仅为 **M0：工程搭建与环境联通**，等待人工验收。固定技术栈：Vue 3 + ECharts、Spring Boot + MyBatis-Plus、MySQL 8.x。问卷业务和 AI 尚未开发。

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

发起者网页登录账户位于 `.env` 的 APP_ADMIN_USER / APP_ADMIN_PASSWORD。`.env` 已被 Git 忽略，禁止上传密码、密钥或备份。

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

Java 已在 PATH 且 JAVA_HOME 正确时可以省略 `-JavaHome`；路径可换成自己的安装目录。

前端：<http://127.0.0.1:5173>，后端健康：<http://127.0.0.1:8080/actuator/health>。

页面：`/` 工作台、`/login` 登录/会话、`/public` 公开答题真实空状态、`/statistics` 数据库诊断。登录后进入“统计与联通”，写入诊断消息、刷新、重启后端，再读同一记录。图表来自真实诊断记录总数，醒目标记“开发环境联通演示”，不冒充调查结果。

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

JUnit 报告：`backend/target/surefire-reports/`。覆盖真实 MySQL 8/Mapper 中文读写、HTTP→数据库、计数、登录/退出、未登录访问、CSRF、错误密码、非法输入、SQL 字符串字面存储。测试数据事务回滚。

自动启动/重启并检查持久化（先关闭占用 8080 的后端，根目录执行）：

```powershell
.\scripts\Verify-M0.ps1 -JavaHome 'D:\jdk\jdk17'
```

脚本打包并启动真实 Java 服务，经 HTTP 插入记录，停止并重启后再读取同一 ID；另以错误数据库端口验证启动失败。测试诊断记录有意保留供复核。日志位于 `.local/`。

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

Spring Security 使用 HttpOnly、SameSite=Strict cookie、30 分钟空闲会话、会话固定攻击保护；CSRF 保持启用。环境配置账户启动时 BCrypt 哈希，M0 账户与会话在内存，重启须重新登录；**诊断记录存在真实 MySQL，不随重启消失**。只供单个本地发起者使用，不收集隐私。

M1 待人工授权补齐账户入库、注册、调查所有权、公开会话权限及登录限流。M0 不作为公网部署版本；HTTPS/Secure cookie/数据库 TLS 不在此次本地环境部署。没有真实 AI 或 Mock AI。

## 常见问题

- `Access denied`：核对本地配置、账号授权；不改用临时数据库。
- `Unknown database`：执行数据库初始化；表由 Flyway V1 自动创建，勿手动重复执行迁移。
- 错误数据库配置：启动时 Flyway 会报连接失败，运行时接口返回 503 / 健康非 UP，不生成假数据。
- 401：先登录；403：重新取 CSRF，前端已自动处理，勿关闭 CSRF。
- 找不到 Java：设置 JDK 的 JAVA_HOME 或传 `-JavaHome`。
- Maven Wrapper 使用阿里云中央镜像下载 Maven；依赖按 Maven settings/中央仓库解析。首次下载较慢，不需改变版本或全局设置。
- npm 网络故障：可临时 `npm.cmd ci --registry=https://registry.npmmirror.com`，不要移除 lockfile。

数据库迁移与备份说明：[db/README.md](db/README.md)。实际结果、截图、Git 提交与缺陷：[evidence/M0.md](evidence/M0.md)。原始材料说明保留于 `docs/DELIVERY_PACKAGE_README.md`。

**完成 M0 后停止；只有用户明确通过 M0 验收并授权，才开始 M1。**
