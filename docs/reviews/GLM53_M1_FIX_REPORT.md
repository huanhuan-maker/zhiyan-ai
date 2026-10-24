# GLM-5.3 M1 缺陷修复报告（P1-01 / P1-02）

日期：2026-10-24（Asia/Shanghai）。执行者：GLM-5.3（缺陷修复 Agent）。分支：`fix/m1-publication-lifecycle`，基线：`6170e97`（master）。修复提交：**`ae122a9`**（本报告为随后独立 docs 提交）。未覆盖其他 Agent 未提交修改（工作树仅有一个来路不明的 `zhiyan-ai-package-2026-10-24.zip`，未纳入提交）。

## 1. 根本原因

### P1-01 旧版问卷关闭后意外重新开放

- 原模型只有调查整体状态 `surveys.status`（DRAFT/OPEN/CLOSED），`survey_versions` 没有任何收集状态。
- `publish()` 把调查重新置为 `OPEN`；`publicSurvey()` / `start()` / `answer()` / `complete()` 只检查调查状态（`ensureOpen(surveys.selectById(...))`），从不检查"这个版本是否还开放"。
- 因此：关闭调查（status=CLOSED）→ 修改草稿发布 V2（status=OPEN）→ 旧 V1 token 仍能解析到 V1 版本行，且调查状态是 OPEN → V1 链接恢复读取和提交。关闭操作事实上被下一次发布"整体撤销"，违背版本生命周期语义。

### P1-02 一次性分享链接丢失后无法安全恢复

- 公开 token 只在 `publish()` 响应中出现一次，数据库仅存 SHA-256 哈希，原文不可还原（这是正确的安全设计，保留）。
- 但系统没有任何所有者侧的恢复/轮换机制：发布成功而 HTTP 响应丢失（超时/断网）后，用户重试发布只会得到 `409 ALREADY_PUBLISHED`，既拿不到旧 token 也无法生成新 token；主动丢失链接同样只能重发新版本，旧版收集被迫中断。

## 2. 实际修改的文件与关键逻辑

后端（Spring Boot + MyBatis-Plus）：

| 文件 | 关键逻辑 |
|---|---|
| `db/migration` `V4__version_lifecycle.sql` | `survey_versions` 新增 `status VARCHAR(16) NOT NULL DEFAULT 'OPEN'`；把迁移时已 CLOSED 调查的历史版本回填为 `CLOSED` |
| `entity/SurveyVersion.java` | 增加 `status` 字段映射 |
| `service/SurveyService.java` | ① `publish()`：新版本写入 `status='OPEN'`，不再影响旧版本状态；`ALREADY_PUBLISHED` 409 附带 `versionId/versionNumber` 供恢复入口。② `close()`：在调查置 CLOSED 的同一事务（持有调查行锁）把该调查全部 `OPEN` 版本固化为 `CLOSED`。③ 新增 `lockVersion()`（FOR UPDATE 锁读）与 `ensureVersionOpen()`（410 `VERSION_CLOSED`）。④ 新增 `rotateToken(id,versionId,owner)`：所有权校验（404 越权）→ 调查行锁 + 版本行锁 → 生成新 token 覆盖哈希 → 审计仅记 `ROTATE_TOKEN`（不含 token）→ 返回 `publicToken/publicPath/versionStatus/surveyStatus`。⑤ `detail()` 版本列表附带 `status` |
| `service/ResponseService.java` | `start()` 与会话写路径在调查锁读之后追加版本锁读校验（与既有"当前锁读治理关闭"同一模式，防止 RR 旧快照绕过）；已 SUBMITTED 会话的幂等重放不受影响 |
| `service/BusinessException.java`、`controller/ApiExceptionHandler.java` | 异常支持可选 `details` 字段并入响应体；既有错误响应形状不变 |
| `controller/SurveyController.java` | 新端点 `POST /api/surveys/{id}/versions/{versionId}/rotate-token`（会话 + CSRF + 所有权） |

前端（Vue 3）：

| 文件 | 关键逻辑 |
|---|---|
| `pages/SurveyEditorPage.vue` | 发布记录中每个版本显示收集状态并提供"重新生成分享链接"（确认框说明旧链接立即失效、已停收版本轮换后仍不能填写）；轮换结果走既有 `rememberShare` 本地保存与展示 |
| `api/surveys.ts` | `Version` 接口增加可选 `status` |
| `style.css` | `.version-row` 少量样式 |

状态模型（两级独立）：版本可收集 ⇔ 调查 `OPEN` **且** 版本 `OPEN`。关闭调查 = 调查 CLOSED + 当时全部 OPEN 版本 CLOSED；再发布 = 新版本 OPEN（旧 CLOSED 版本保持关闭，未关闭旧版按文档契约继续按原快照收集）。历史答卷、会话、统计口径零改动。

## 3. 数据库迁移与兼容性

- 新增 Flyway **V4**（`V4__version_lifecycle.sql`）：加列 + 回填，幂等由 Flyway 管理；已在 `zhiyan_ai_test`（测试）与 `zhiyan_ai`（开发库）真实应用成功。
- 回填语义 = 把旧模型"调查关闭即全部停止"如实固化为版本状态：迁移时 CLOSED 调查的历史版本 → CLOSED；OPEN 调查版本 → OPEN。开发库实测：调查 3（CLOSED）版本 3/4 → CLOSED；调查 1/2/4（OPEN）版本保持 OPEN，已提交答卷数（各 2 份）不变。
- API 兼容：既有接口路径、方法、成功响应不变；仅 ① `ALREADY_PUBLISHED` 409 响应体新增 `versionId/versionNumber` 字段（新增字段，向后兼容）② 旧版本"因发布新版而恢复收集"这一错误行为修正为 410（错误码新增 `VERSION_CLOSED`）③ 新增 rotate-token 端点。

## 4. 新增/修改的测试（未删除、未跳过任何现有测试）

新增 `backend/src/test/java/cn/zhiyan/M1PublicationLifecycleTest.java`（真实 MySQL，MockMvc 仅作 HTTP 入口，事务回滚）：

1. `closedOldVersionCannotBeReopenedByPublishingNewVersion`：完整复现 P1-01 流程——V1 收到 1 份答卷 → 关闭（SURVEY_CLOSED 410）→ 发布 V2 → V1 旧链接读取/开会话/答题/在途会话提交全部 410 `VERSION_CLOSED`；V2 正常填写提交；V1 统计仍为 1 份、V2 为 1 份；DB 断言版本与调查状态。
2. `openOldVersionKeepsCollectingUntilExplicitClose`：钉住文档契约——未关闭旧版在 V2 发布后仍可读可交（200），显式关闭后全部版本 410 且 DB 全 CLOSED，历史统计不变。
3. `rotateTokenIssuesNewLinkInvalidatesOldAndKeepsInFlightSessions`：轮换返回新 token（旧 token 立即 404、新 token 200）；轮换前开始的在途匿名会话仍可提交；DB 哈希更新；审计存在 `ROTATE_TOKEN` 且不含明文 token。
4. `rotateTokenRequiresOwnerSessionCsrfAndMatchingVersion`：匿名（携合法 CSRF）401；登录他人/缺 CSRF 403；轮换他人调查的版本或不存在版本 404；被测原链接不受失败尝试影响。
5. `duplicatePublishExposesExistingVersionForLinkRecovery`：重复发布同稿 409 返回既有 versionId/versionNumber 且不新建版本；据此轮换即恢复可用链接——覆盖"发布成功但响应丢失"场景。

`M1ConcurrencyTest.java` 追加（现有 2 用例原样保留）：

6. `concurrentTokenRotationLeavesExactlyOneLiveLinkWithoutBreakingInFlightSessions`：两线程真实独立 MySQL 事务并发轮换，按调查行锁串行，恰好一个新链接存活（DB 哈希等于存活 token 的哈希），在途会话照常提交，completedCount=1。

首次运行 1 例失败（新测试把"匿名+无CSRF"预期为 401，实际 Spring Security 先拒绝 CSRF 返回 403）——修正测试预期为与 M0 口径一致的"匿名+合法CSRF → 401"后复跑通过。非产品缺陷。

## 5. 实际执行的测试命令与结果（真实执行，非声称）

| 命令 | 结果 |
|---|---|
| Git Bash：`cd backend && JAVA_HOME='D:\jdk\jdk17' && set -a && . ../.env && set +a && ./mvnw.cmd clean test` | **Tests run: 34, Failures: 0, Errors: 0, Skipped: 0，BUILD SUCCESS**（M0 9 + M1 16 + 生命周期 5 + 并发 3 + 限流 1；真实 MySQL `zhiyan_ai_test`，Flyway V1–V4）。日志 `.local/m1fix-test2.log`（首轮含 1 失败的日志 `.local/m1fix-test.log`） |
| `cd frontend && npm.cmd run build` | 退出码 0，vue-tsc + vite 构建成功（632 模块）。日志 `.local/m1fix-frontend-build.log` |
| `./mvnw.cmd package -DskipTests` + `java -jar ...`（开发库启动） | 健康检查 `{"status":"UP"}`；Flyway V4 应用成功 |
| 开发库只读 SQL 对账（mysql CLI，不查哈希/token） | `flyway_schema_history` V4 success=1；调查 3 两版本 CLOSED、调查 1/2/4 版本 OPEN，各版本已提交数 2/2/2/0/2 与迁移前一致 |

环境说明：为执行 `mvn clean`，终止了 M1 验收 Agent 留在 8080 的旧 jar 进程（占用 target）；测试后已用修复版 jar 重新在 8080 启动，5173 Vite dev server 一直保持运行，前端改动即时生效。

## 6. 未解决的问题 / 需产品负责人决策

- **旧版"停收"页面的文案**：V1 停收后公开页显示通用错误"该发布版本已停止收集，请使用发起者提供的最新分享链接"，未提供"跳转最新版"按钮（自动跳转需要把版本关联关系暴露给匿名端，属新增需求，未擅自扩大）。
- **轮换的非幂等性**：网络重试轮换会再次轮换（上一次的新链接失效）。响应每次都含完整新链接，语义安全；如需"幂等轮换窗口"属产品决策。
- **多版本同时收集**：按既有契约，未显式关闭的旧版在新发布后继续收集（已钉住测试）。若产品希望"发布新版即停收旧版"，只需改 `publish()` 一行并调整 1 个测试，建议明确后决定。
- 沿用既有已知限制：本地 HTTP、单机限流、`Verify-M1.ps1` 在 PS5.1 的中文断言编码问题（工具问题，未获授权未改动）。

## 7. Windows 手动验证步骤（约 10 分钟，浏览器为主）

前置：MySQL80 服务运行；后端 `.\scripts\Start-Backend.ps1`（或直接 `java -jar backend\target\zhiyan-ai-0.0.1-SNAPSHOT.jar`，当前已运行）；前端 `cd frontend; npm.cmd run dev`（当前已运行）。打开 <http://127.0.0.1:5173>。

P1-01：

1. `/login` 用 `.env` 的 APP_ADMIN_USER/PASSWORD 登录；`/surveys/new` 建一份简单问卷 → 保存并发布 → **复制 V1 链接**。
2. 新标签打开 V1 链接，同意并提交一份答卷。
3. 回编辑页点"关闭调查"；刷新 V1 标签 → 显示"调查已关闭，无法继续填写或提交"。
4. 编辑页改标题 → 保存并发布 V2 → **复制 V2 链接**。
5. 再开旧 V1 链接 → 应显示"该发布版本已停止收集…"（而非恢复填写）；V2 链接可正常填写提交。
6. `/surveys/{id}/results` 分别选 V1/V2：V1 仍是第 2 步的 1 份，V2 只含新答卷。

P1-02：

7. 编辑页"发布记录"中选 V1 → 点"重新生成分享链接"→ 确认 → 得到新链接。
8. 打开**旧** V1 链接 → "资源不存在或无权访问"（404，立即失效）；**新**链接 → 停收提示同第 5 步（V1 已停收，轮换不改变收集状态——预期行为）。
9. 对正在收集的版本轮换：新链接可填写，旧链接 404。
10. 越权抽查（可选，PowerShell）：未登录 `Invoke-RestMethod -Method Post http://127.0.0.1:8080/api/surveys/{id}/versions/{vid}/rotate-token` 应 401/403；另一账户登录后调用应 404。

## 8. 供 Codex 集成

- 分支：`fix/m1-publication-lifecycle`；修复提交：**`ae122a9`**（15 文件，+292/−18；本报告为后续 docs 提交）。
- 集成建议：`git merge fix/m1-publication-lifecycle`（无与 master 的分叉冲突，基线即 6170e97）；迁移 V4 在启动时自动应用，无需手工 SQL。
- 未验证项：无——本报告所列测试与构建均已实际执行；浏览器端手动步骤（第 7 节）留待用户按流程复核。
