# M1 问卷核心 API

日期：2026-10-23。本阶段不调用 AI。所有 JSON 文本以 UTF-8 传输；时间使用本地上海开发环境。方法未列出的接口不存在，不能据页面骨架推断后续能力已实现。

## 身份与写请求

1. GET `/api/auth/csrf` 返回 `{token,headerName}`，浏览器保存 HttpOnly 会话 cookie。
2. 所有 POST/PUT（包括匿名会话和答题）需在该 headerName 中传入 token；登录/退出后重新获取。前端统一 `mutation` 客户端处理。
3. POST `/api/auth/register`：JSON `{username,password}`，用户名 `[a-zA-Z0-9_-]{3,60}`，密码 12–72 字符且 UTF-8 最多 72 字节；201。账户实际写入 MySQL，密码 BCrypt。
4. POST `/api/auth/login`：表单 username/password，成功 204；错误 401。GET `/api/auth/me` 读当前用户，POST `/api/auth/logout` 销毁会话。
5. 只有在配置的 bootstrap 用户尚不存在时，启动才将 APP_ADMIN_USER/PASSWORD 创建入库。以后修改环境密码不会静默改变既有账户密码。

本地单节点按真实连接 IP 限流：鉴权写入 100 次/分钟、公开写入 300 次/分钟，429 + Retry-After。不信任客户端伪造的转发 IP；共享 NAT 可能共享额度。生产部署需结合可信代理与分布式限流进一步设计。

## 管理员/发起者接口

下列每个接口都验证当前用户对该调查的所有权。资源不存在或属于其他用户均 404；未登录 401，CSRF 无效 403。

| 方法 | URL | 输入/输出 |
|---|---|---|
| GET | `/api/surveys` | 仅当前发起者调查列表，含 draft/status/revision/latestVersionId |
| POST | `/api/surveys` | Draft → 201，返回新调查 id |
| GET | `/api/surveys/{id}` | draft、revision、status、versions 列表 |
| PUT | `/api/surveys/{id}` | `{draft,revision}`，revision 过期返回 409；保存成功 revision + 1 |
| POST | `/api/surveys/{id}/publish` | `{revision}` → versionId/versionNumber/publicToken/publicPath |
| POST | `/api/surveys/{id}/close` | 关闭调查，全部版本的公开入口停止接受填写/提交 |
| POST | `/api/surveys/{id}/versions/{versionId}/rotate-token` | `{expectedShareRevision}` → versionId/versionNumber/publicToken/publicPath/versionStatus/surveyStatus/shareRevision；旧链接立即失效，过期前置条件返回409 |
| GET | `/api/surveys/{id}/results?versionId=...` | 仅此调查的指定版本已提交样本统计 |

Draft 示例见 `fixtures/m1_survey.json`。字段：title、description、privacyNotice、questions、perQuestionFollowupLimit、totalFollowupLimit。后两者只是未来 M3 配置预留，M1 不会扣减或触发追问。

Question：稳定 id，type=SINGLE/MULTIPLE/SCALE/OPEN，text、required、allowFollowup、options[]、min/max。选择题至少两个选项、id/去空白文本不得重复；scale 必须有递增整数边界且跨度≤20；仅 OPEN 可预留 allowFollowup。题目数 1–50。

发布把整个 Draft JSON 复制成新的不可变版本，新版本收集状态为 OPEN。之后 PUT 只改草稿；旧公开 token 始终读旧 snapshot，旧答案通过 response_session.version_id 关联旧版。发布相同内容返回 409（附 versionId/versionNumber，便于丢失链接后轮换），避免重复点击制造相同版本。调查状态与版本收集状态两级独立：关闭调查把当时全部 OPEN 版本固化为 CLOSED；此后再发布只让新版本收集，已关闭的旧版本不会因发布新版而恢复（公开读取与提交均 410 VERSION_CLOSED）。未被关闭的旧版本在新发布后仍按原快照继续收集。当前无单独重开接口。

公开 token 为 32 字节安全随机数的 base64url，数据库仅存 SHA-256 哈希，发布时返回一次。前端可在当前浏览器保存分享地址；丢失后不能从哈希还原，发起者可对指定版本调用 rotate-token 安全轮换（旧 token 立即失效，新 token 只返回给通过所有权校验的发起者；审计仅记 ROTATE_TOKEN 动作，不记录 token 本身），或修改草稿发布新版本。轮换只影响分享链接，已在填写中的匿名会话不受影响。切勿将管理密码存入 localStorage。

轮换前从所有者详情 `versions[].shareRevision` 读取当前分享版本标识（64位十六进制不透明值，非公开token）。在调查/版本锁内比较前置条件；同一值重复或并发提交只有一个200，其余409 `STALE_SHARE_LINK`，不再改token或新增审计。无/非法标识400，合法请求的非所有者404。成功响应 `Cache-Control: no-store`。这不是“重放原成功响应”的幂等缓存：仅存token摘要，故成功响应丢失后无法恢复同一明文链接。客户端不得自动更新标识并重试；需重新读详情、用户明确确认再轮换一次，新的成功响应才提供可复制链接。在重读前重试原请求始终409，不会使另一标签已复制的链接失效。公开start在锁内复查当前token摘要，阻止旧快照绕过轮换。

## 公开填写

| 方法 | URL | 输入/输出 |
|---|---|---|
| GET | `/api/public/surveys/{publicToken}` | 冻结 survey + versionId/number；调查关闭返回 410 SURVEY_CLOSED，版本停止收集返回 410 VERSION_CLOSED |
| POST | `/api/public/surveys/{publicToken}/sessions` | `{consent:true,aiConsent:false}` → 201，sessionToken/versionId/expiresAt |
| GET | `/api/public/sessions/{sessionToken}` | 只读该 token 的 status、survey、answers、version、aiConsent，用于刷新恢复 |
| POST | `/api/public/sessions/{sessionToken}/answers` | `{questionId,value}`，覆盖保存当前会话该题；必填约束在最终提交校验 |
| POST | `/api/public/sessions/{sessionToken}/complete` | `{answers:{题id:JSON值}}`，与已保存值合并后完整校验、事务提交 |

答案：SINGLE=选项 id 字符串，MULTIPLE=去重选项 id 字符串数组，SCALE=范围内整数，OPEN=最多 5000 字符文本。最终提交的未答可缺省或 null；单题保存 value 不可为 null，清空使用空字符串（多选也可空数组）。空数组只接受于多选；必填题最终提交不得缺失。未知题/错误选项/错误类型返回 400。匿名会话 7 天过期，过期 410；随机伪造会话返回 404。

sessionToken 是匿名受访者的能力凭证，不等于发起者会话；持有它只能读写其自身答案，不能读管理列表或他人会话。前端仅在标签页 sessionStorage 存匿名会话 token；未提交答案真正在 MySQL，可刷新恢复。若清理标签页存储，M1 不提供通过姓名找回应答的能力。

提交持有调查及会话行锁；答案唯一键 `(session_id,question_id)`，SUBMITTED 状态只转换一次。重复 complete 返回原提交状态，不修改答案、不新增人数。真实并发测试用两条独立 MySQL 连接复核。关闭与提交也按相同锁顺序串行，使用当前锁读检查状态，避免重复读旧快照绕过关闭；已经提交的请求幂等重试可以返回 SUBMITTED。

## 统计口径

仅计算所选 version 中 SUBMITTED 的 response_session，未提交会话不计回收数。每题返回 total、denominator（非空有效人数）、missing、options[] 中 numerator/denominator/percentage。量表有 average，空分母时为 null；多选按有效答题人数计算，合计可以超过 100%。开放题返回仅发起者可见的文本、answerId 与匿名 sessionId，便于核对来源；M1 不做主题归纳或 AI 解释。

统计目前从 Mapper 读取当前版本已提交会话/答案后由 Java 确定性计算，事务一致性读，不依赖前端常量。对大型样本尚未做分页/专用聚合 SQL 性能优化。

## 数据与迁移

- V1 system_checks 为 M0 联通诊断。
- V2 users、surveys、survey_versions、response_sessions、answers、audit_events。
- V3 answers.question_id 使用 ascii_bin，保持 JSON 稳定题 ID 的大小写语义。
- V4 survey_versions 增加 status（OPEN/CLOSED），并把迁移时已关闭调查的历史版本回填为 CLOSED；发布/关闭/轮换产生审计事件，事件只存 actor/survey/action/time，不记原始答卷或 token。
- MyBatis-Plus 实际负责所有业务实体读写；SQL 迁移仍由 Flyway 执行，不手动编辑已经应用的迁移。

响应错误包含安全的 code/message，不返回 SQL、密码、会话 token 或内部堆栈。输入文本使用 Vue 插值；禁止把问卷或答案作为 v-html 渲染。
