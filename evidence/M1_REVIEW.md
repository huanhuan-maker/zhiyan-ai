# M0/M1 独立验收报告（接手 Agent 复验）

日期：2026-10-24（Asia/Shanghai），执行者：接手验收 Agent（自动化操作 + 真实浏览器）。基线：`f624143`（工作树干净，无本地修改被覆盖）。验收依据：`docs/AGENT_HANDOFF.md` 第 6 节、`docs/ACCEPTANCE_GUIDE.md` M0/M1 剧本。

**自检结论：M1 独立验收通过（建议 PASS）。用户最终验收仍待你本人确认；未开始 M2。**

## 1. 自动验证复跑（全部实际执行，非照抄历史）

| 验证 | 命令（根目录） | 结果 | 原始日志 |
|---|---|---|---|
| 后端完整测试 | `powershell -File .local\run-backend-tests.ps1`（内部 `mvnw clean test`，真实 MySQL `zhiyan_ai_test`） | **28/28 通过，0 失败/错误/跳过**（M0 9、M1 16、并发 2、限流 1），BUILD SUCCESS，2026-10-24 11:35 | `.local/review-backend-test.log`（被忽略） |
| 前端构建 | `npm.cmd ci && npm.cmd run build` | 退出码 0，构建成功（含 ECharts chunk） | `.local/review-frontend-build.log` |
| npm audit | `npm.cmd audit --json` | **0 已知漏洞** | `.local/review-npm-audit.json` |

技术栈复核：`pom.xml` 为 `mybatis-plus-spring-boot3-starter` 3.5.17 + Boot 3.5.16，无 JPA/Hibernate；`package.json` 有 vue 3.5.x + echarts；测试真实连接 MySQL（Flyway V1–V3 校验通过），无 H2/Mock 兜底。统计数值由后端计算（页面标注"均值由后端计算"），ECharts 数据来自 `/api/surveys/{id}/results`。

执行环境备注：本机当前无 PowerShell 7，首次用 PS5.1 直接跑 `Start-Backend.ps1 -Test` 因 `Load-Env.ps1` 的 `$ErrorActionPreference='Stop'` 与原生 stderr 重定向冲突而中断（环境问题，非产品缺陷）；改用 cmd 层重定向的包装脚本后完整执行成功。

## 2. 浏览器完整流程（真实 UI 操作，全部 PASS）

调查：`surveyId=3`，标题"食堂满意度验收"，四题：单选（满意/一般/不满意）、多选（价格/口味/排队）、量表 1–5、开放题。数据为合成验收数据。

| # | 检查项 | 结果 |
|---|---|---|
| 1 | 登录（`.env` 管理账户，密码仅运行时变量、不落入任何报告） | PASS（`/api/auth/me` 返回 researcher） |
| 2 | 建卷→保存草稿→F5 刷新→逐题/选项/顺序完整 | PASS（修订 1，四题无丢失） |
| 3 | 预览渲染（题型、必填标记） | PASS |
| 4 | 发布 V1→一次性链接返回并保留 | PASS（11:43:35，链接已存 `.local/review-m1-demo.json`） |
| 5 | 受访者 A（新标签页=独立 sessionStorage）：同意参与、**拒绝 AI** | PASS（默认未勾选 AI，状态显示"AI 已拒绝"） |
| 6 | A 填写（满意/价格+口味/4 分/"中午排队慢"）→保存进度→**刷新恢复** | PASS（4/4 题从数据库恢复） |
| 7 | A 提交成功页 | PASS（提示"刷新仍会显示提交成功，不会新增回收次数"） |
| 8 | 受访者 B（又一独立标签页）：**同意 AI**、不满意/排队/2 分/"菜有时会卖光"、提交 | PASS（"AI 已同意，但本阶段不启用"） |
| 9 | 统计核对（指定版本 V1）：**2 份提交、满意/不满意各 1 人 50%、均值 3.00**、多选各 50%（分母 2）、缺失 0、开放原文两条可定位（匿名会话 5/6 · 答案 20/24） | PASS（图表、统计表、API、MySQL 四方一致） |
| 10 | ECharts 真实渲染（3 个 canvas，数值标签与表一致） | PASS |
| 11 | 幂等：A 刷新已提交页不新增；**同会话重复 HTTP 提交携带篡改答案返回 200+SUBMITTED，未接受新答案** | PASS |
| 12 | 版本冻结：改草稿标题→旧链接仍 V1 原标题（未泄露草稿）→发布 V2→**V1=2 份/V2=0 份统计隔离** | PASS |
| 13 | 关闭调查：公开链接显示"已关闭"，无同意框/开始按钮；**历史统计仍可查（V1 仍 2 份）** | PASS |
| 14 | 越权：新账户 reviewer_two 注册登录后，调查列表 0 条；`GET /api/surveys/3`、`results` 均 **404**；`publish`、`close` 均 **403**；UI 直接访问他人调查页显示"资源不存在或无权访问"且不渲染数据；纯匿名（无凭证）访问管理 API **401** | PASS |
| 15 | AI 同意落库：version 3 有 ai_consent=0 与 =1 各 1 条 SUBMITTED，与操作一致 | PASS |
| 16 | 窄屏 375×667：统计页、图表（canvas 自适应 283px）、公开页布局正常；放宽到 1280 后 canvas 变 875px（**resize 生效**） | PASS |
| 17 | Console 全程零错误检查 | **受限**：所用浏览器自动化接口无 console 日志读取能力；以页面状态、功能正确性与错误提示替代，未发现异常。此项留给你人工复核 |

截图（均为实际捕获，避免管理密码与匿名会话 token）：`evidence/m1-review-publish.png`、`m1-review-submit-success.png`、`m1-review-results.png`、`m1-review-open-text.png`、`m1-review-closed.png`、`m1-review-mobile-results.png`、`m1-review-mobile-chart.png`、`m1-review-mobile-public-closed.png`。

## 3. 真实重启持久化与 SQL 对账

`Verify-M1.ps1`（先停止占用 8080 的后端后执行，11:58）在最后一步"重启后断言"抛错。**定位：脚本数据链全部成功（新合成调查 4 已创建、2 份提交、均值 3.0、标题修改已持久化——MySQL 直查证实），失败发生在 PowerShell 5.1 客户端比较：PS 5.1 的 `Invoke-RestMethod` 将无 charset 的 UTF-8 JSON 按 Latin-1 解码，中文标题比较必然为假。上一轮该脚本通过记录为 PowerShell 7 环境；本机现无 PS7。此为验证工具的 PS5.1 兼容性问题，不是产品缺陷。**

等价复验（UTF-8 安全，全部 PASS，12:00）：

- 真实 Java 重启（`java -jar backend/target/zhiyan-ai-0.0.1-SNAPSHOT.jar`，健康 3 秒 UP）后 HTTP 查询：`completedCount=2`、草稿标题 `"食堂满意度 · M1 合成验收 / draft updated"` 完全一致、满意/不满意各 1、各 50%、均值 3、versionId=5。
- `db/verify-m1.sql` 只读对账：Flyway V1–V3 success；版本 1/2/3/5 均 2 份 SUBMITTED；`satisfaction` yes/no 各 1；量表均值 3.000000；AI 同意标记分布与浏览器操作一致。结果存 `evidence/m1-review-mysql-query.txt`。
- 失败日志：`.local/review-verify-m1.log`（被忽略）；脚本修复建议见第 5 节。

## 4. 沿用历史证据

本轮未重跑 M0 截图流程与另一台机器部署（历史 `evidence/m0-*.png`、`m0-verification.txt` 仍然有效于当时环境）。历史 28 项测试口径与本轮复跑一致。

## 5. 发现的问题与建议（均不阻断 M1）

1. **[工具] `Verify-M1.ps1` 在 PowerShell 5.1 下中文断言失败**：建议在脚本头部注明"需 PowerShell 7"，或将 `Invoke-RestMethod` 结果的编码处理显式化为 UTF-8（如改用 `HttpClient`/字节解码），修后先在 PS5.1 复现失败再修复。未获授权前未改动该脚本。
2. **[观察] 375px 下顶部导航出现横向滚动条**（"登录与会话"等项需横滑）：可用但可优化；非阻断。
3. **[受限] 浏览器 console/Network 全程检查未完成**：工具能力限制，建议人工按 F12 复核一遍。
4. **[提示] 验收过程中，页面快照曾一次带出密码框内容**（工具对 `type=password` 字段仍显示值）：该值来自本机 `.env`，仅存在于本机会话记录；如在意请轮换 `.env` 的 `APP_ADMIN_PASSWORD`（注意 bootstrap 不会重置已有账户密码，需用数据库方式或新建账户改密）。
5. 已知限制（手动保存、一次性链接、单机限流、本地 HTTP 等）沿用 `evidence/M1.md`，本轮未发现新增产品缺陷。

## 6. 交付与提交

- 新增证据：本报告 + 8 张截图 + `evidence/m1-review-mysql-query.txt`；`.local/` 下原始日志（被 Git 忽略）。
- 测试数据：调查 3（CLOSED，V1 两份答卷、V2 空）与 Verify-M1 合成调查 1/2/4 保留在开发库供复核，未删除历史数据。
- 验收后环境：后端已以 jar 方式在 8080 运行、前端 dev server 在 5173 运行，供人工验收直接使用。
- **结论：M1 独立验收自检 PASS，等待你按 `docs/ACCEPTANCE_GUIDE.md` 复核确认；未获得你明确批准前不进入 M2。**
