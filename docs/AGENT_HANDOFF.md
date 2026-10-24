# 知研 AI｜验收与后续开发 Agent 交接

交接日期：2026-10-24（Asia/Shanghai）。项目目录：`D:\LcProject`。

**先验收现有 M0/M1，再根据用户明确授权开发下一阶段。当前 M1 为 CONDITIONAL，尚未获得用户最终验收；M2–M6 未开始。** 本文件不是放行下一阶段的授权，也不替代真实源码、测试结果或项目需求文件。

## 1. 接手先读与阶段边界

按顺序完整阅读：

1. 根目录 `AGENTS.md`、`CODEX_KICKOFF.md`。
2. `docs/PROGRESS.md`、`docs/DEVELOPMENT_PLAN.md`、`docs/ACCEPTANCE_GUIDE.md`。
3. `docs/ARCHITECTURE_AND_API.md`、`docs/PRODUCT_SPEC.md`、`docs/RESEARCH_EVAL.md`。
4. `README.md`、`docs/DEPENDENCIES.md`、`db/README.md`。
5. `evidence/M0.md`、`evidence/M1.md`、`docs/M1_API.md`。
6. 后续设计前阅读 `docs/OPEN_SOURCE_RESEARCH.md`。

优先级遵循 AGENTS：老师指定技术栈最高，新 V2.0 文档优先于旧交接材料。`CODEX_KICKOFF.md` 的“本轮只做 M0”是最初启动范围；用户后来明确授权“完成 M0 和 M1 后停止”。**本次仅编写交接，不等于用户批准 M1 或授权 M2。** 新 Agent 只能依据接手时用户的新指令调整范围。

总目标 M0–M6 尚未完成。本聊天的总目标已按用户要求设为 paused，停在人工验收节点；其他 Agent 不能把此状态当作项目已完成，也不需要为验收复跑而重新开发工程。每阶段交付后仍须等待人工验收。Agent 的自检意见不能代替用户批准。

## 2. Git 基线与现有成果

编写本交接前工作树干净，分支为 `master`。接手时重新运行 `git status`，保留之后可能出现的用户修改，不 reset/clean 覆盖。

| 内容 | 已有提交 |
|---|---|
| M0 工程、真实 MySQL 联通、Windows 脚本与证据 | `46f7a82fb86f3525a0bad50ba269995d86899859` |
| M1 业务、测试及六库源码调研 | `20064b7c261452542afb3ee3149b54dcbfab2fbe` |
| M1 提交记录与验收边界文档 | `7437387974d038cc08f176b3fe24c67f925906c6` |

以上是历史基线，不声称为接手时最新 HEAD；本交接另有文档提交，可用 `git log` 查询。新建开发分支默认使用 `codex/` 前缀。修改文件索引见 `evidence/M0-FILES.txt`、`evidence/M1-FILES.txt`。

M0 已有前后端工程、MyBatis-Plus Mapper 实际读写、Flyway、健康检查、登录框架、诊断页和 ECharts 真实诊断数量、Windows 启动与错误数据库配置测试；历史自检 PASS，等待用户最终验收。

M1 已有数据库账户/BCrypt、注册登录、调查所有权、四题型草稿/预览/排序、revision 冲突检测、冻结发布版本、随机公开链接、关闭、匿名知情同意和可拒绝 AI、手动保存恢复、事务幂等提交、指定版本的真实统计/ECharts、开放题原文定位和基础限流。

**AI 当前未实现、未调用，也没有 Mock AI。** 追问上限和 allowFollowup 只是已保存的预留配置，不存在语义追问、预算账本、主题发现、AI 报告或实验运行器，不能从界面文案推断已实现。

## 3. 环境、配置与启动

| 项目 | 当前实现/已执行环境 |
|---|---|
| 前端 | Vue3.5.44、TypeScript5.9.3、Vite7.3.7、Vue Router4.5.1、ECharts6.1.0 |
| 后端 | Spring Boot3.5.16、MyBatis-Plus3.5.17（Boot3 starter）、Java17、Maven Wrapper3.9.11 |
| 本机工具 | Microsoft OpenJDK17.0.20.1：`D:\jdk\jdk17`；Node22.23.1、npm10.9.8 |
| MySQL | 用户已有8.0.46实例，3306；安装目录 `D:\MySQL\MySQL Server 8.0` |
| 数据库 | 开发 `zhiyan_ai`；专用测试 `zhiyan_ai_test`；应用账户 `zhiyan` |
| PowerShell | 开发使用7.6.5；最终28项后端测试实际通过 Windows PowerShell5.1.26100.9711 执行 |

版本以当前 pom/package/lockfile 为准，不擅自换 React、JPA/Hibernate、Node/Python 主服务或数据库。无需 Docker、全局 Maven、AI Key 即可运行当前业务。

`.env` 已在本机配置且被 Git 忽略。接手同一台机器时不要覆盖它或重新初始化已有 MySQL 数据目录。DB_USER/DB_PASSWORD 用于数据库；APP_ADMIN_USER/APP_ADMIN_PASSWORD 是初始网页登录账户，两者不同。密码只在本地读取使用，不能打印、写入报告、提交到 Git 或要求用户发到聊天。bootstrap 用户只在不存在时创建；修改 `.env` 不重置数据库中已有密码。

本次交接时实际检查：3306/5173/8080 有监听，`/actuator/health` 为 UP、前端首页 HTTP200。**这是时点状态，不保证接手时服务仍在运行，也不是完整浏览器验收。** 先检查，不要重复占端口或误停其他进程：

```powershell
Set-Location D:\LcProject
git status --short
git log -3 --oneline
Get-NetTCPConnection -State Listen -LocalPort 3306,5173,8080 -ErrorAction SilentlyContinue
Invoke-RestMethod http://127.0.0.1:8080/actuator/health
```

需要启动时，终端 A：

```powershell
Set-Location D:\LcProject
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\Start-Backend.ps1 -JavaHome 'D:\jdk\jdk17'
```

终端 B：

```powershell
Set-Location D:\LcProject\frontend
npm.cmd ci
npm.cmd run dev
```

前端 `http://127.0.0.1:5173`；后端 `http://127.0.0.1:8080`。前后端绑定回环地址，Vite代理 `/api` 与 `/actuator`，当前不是公网/局域网手机部署。端口变化需同步代理配置。Ctrl+C 停止对应前后端，MySQL独立运行。另一台机器先照 README 安装与初始化，不复制本机密钥进仓库。

## 4. 源码入口与数据关系

| 责任 | 主要文件/目录 |
|---|---|
| 后端启动/配置 | `backend/src/main/java/cn/zhiyan/ZhiyanApplication.java`、`backend/src/main/resources/application.yml`（配置实际文件见该目录） |
| 账户/鉴权/限流 | `service/AccountService.java`、`security/SecurityConfig.java`、`security/RequestRateFilter.java`、`controller/AuthController.java` |
| 管理草稿/发布/关闭 | `service/SurveyService.java`、`controller/SurveyController.java` |
| 匿名保存/提交 | `service/ResponseService.java`、`controller/PublicController.java` |
| 数值统计 | `service/ResultsService.java`；不是由前端或 AI 生成数值 |
| 校验/错误处理 | `dto/SurveyDtos.java`、`controller/ApiExceptionHandler.java` |
| 持久化 | `entity/`、`mapper/`；Mapper extends BaseMapper，实际使用 MyBatis-Plus |
| 前端路由/请求 | `frontend/src/main.ts`、`frontend/src/api/client.ts`、`frontend/src/api/surveys.ts` |
| 页面/组件 | `frontend/src/pages/`；`QuestionInput.vue`、`ResultsChart.vue`；M0 `ConnectionChart.vue` 保留 |
| 迁移 | `backend/src/main/resources/db/migration/` |
| 自动验证 | `backend/src/test/java/cn/zhiyan/`、`scripts/Verify-M0.ps1`、`scripts/Verify-M1.ps1` |

表：V1 创建 system_checks；V2 创建 users、surveys、survey_versions、response_sessions、answers、audit_events；V3 将 answers.question_id 改为 ascii_bin。后续有结构变动须新增迁移，不编辑已应用的 V1–V3，不 drop 已有数据库。

关系：users → surveys.owner_id → survey_versions.survey_id → response_sessions.version_id → answers.session_id。题目/选项含稳定ID，存于草稿JSON和冻结快照JSON；答案按session+question唯一。公开/匿名能力token只SHA-256入库。统计只读指定版本已SUBMITTED会话，缺失不计有效分母，多选各项人数占有效人数，均值由后端算。发布新版本不自动关闭旧版本，关闭调查影响所有版本。

API细节以 `docs/M1_API.md` 与源码为准：所有写请求（包括匿名）需要CSRF；管理请求用Cookie登录并逐调查校验所有权；匿名sessionToken仅允许访问自己的答卷。新Agent应从真实API取CSRF，不禁用保护来“修复”验收。

路由：`/login`、`/`、`/surveys/new`、`/surveys/{id}/edit`、`/surveys/{id}/results`、`/public/{token}`。`/statistics` 是M0环境诊断，`/public` 无token时仅说明入口，均不应误认为M1统计/完整问卷。

## 5. 已有测试证据及复跑

最后一次完整测试报告已重新读取：**28项通过，0失败/错误/跳过**。这是上轮实际执行结果，本次写交接没有重新跑全套测试。请独立验收时复跑并记录自己的时间、命令、结果，而不是照抄结论。

| 验证 | 已有结果 | 证据 |
|---|---|---|
| M0IntegrationTest | 9成功，真实MySQL | `backend/target/surefire-reports/`；提交摘要 `evidence/m1-verification.txt` |
| M1IntegrationTest | 16成功，真实MySQL | 同上；涵盖账户/越权/版本/恢复/统计/幂等/关闭/过期/输入等 |
| M1ConcurrencyTest | 2成功，两线程/独立连接 | 并发重复提交、MySQL RR旧快照关闭回归 |
| RequestRateFilterTest | 1成功，Filter单元测试 | 不把它冒称为数据库或浏览器集成 |
| 前端build/npm audit | 构建成功，632modules；audit0已知漏洞 | `evidence/m1-verification.txt`、`evidence/m1-npm-audit.json` |
| 真HTTP/真Java重启 | 两独立匿名会话、保存恢复、重复提交仍2份、50%/50%、均值3、快照冻结、重启保留 | `evidence/m1-smoke.json`、`scripts/Verify-M1.ps1` |
| MySQL对账 | 开发库迁移1–3成功、答案/人数/均值相符 | `db/verify-m1.sql`、`evidence/m1-mysql-query.txt` |
| M0截图 | 已保存历史实拍 | `evidence/m0-*.png`，仅证明当时M0 |
| M1完整浏览器流程/移动端/截图 | **未完成** | 不得把HTTP/构建或M0截图当作此项通过 |

集成测试使用MockMvc作为HTTP入口，但数据库是真实MySQL；独立脚本才是真监听端口/Java重启。`.log`、target与.local被忽略，新机器没有原始日志属正常情况；提交过的摘要可查，原始结果可复跑生成。

```powershell
Set-Location D:\LcProject
.\scripts\Start-Backend.ps1 -JavaHome 'D:\jdk\jdk17' -Test
Push-Location frontend
npm.cmd ci
npm.cmd run build
npm.cmd audit
Pop-Location
```

测试库必须是专用 `_test` 库，不要指向开发/生产业务库。无MySQL应明确失败，不换H2/内存/Mock数据库。不要同时运行两个使用相同测试库的完整测试批次。

真重启脚本先让8080空闲（在对应后端终端Ctrl+C停止，勿批量杀Java/MySQL）：

```powershell
Set-Location D:\LcProject
.\scripts\Verify-M0.ps1 -JavaHome 'D:\jdk\jdk17'
.\scripts\Verify-M1.ps1 -JavaHome 'D:\jdk\jdk17'
```

脚本自行启停Java，结束后需要重新启动后端供浏览器验收。M1每次会新建并保留一份合成调查和两份答卷，不删除历史数据；请不要误把所有调查的总样本当作单版本人数。

当前最后一次smoke记录surveyId=2、versionId=2，2份提交；另有此前survey1的合成数据。接手时读最新 `evidence/m1-smoke.json`，不要把ID2写死在新测试或产品里。最新分享路径在忽略的 `.local/m1-demo.json` 的publicPath；该文件还含匿名sessionToken，禁止整体输出、上传或提交。如果文件不在新机器上，应自己创建新的验收问卷，不要求找回数据库哈希原文。

## 6. 接手第一优先级：补齐M0/M1独立验收

完整剧本以 `docs/ACCEPTANCE_GUIDE.md` 为准；至少实际操作并保存新证据：

1. 复跑构建/测试，检查源码中 Vue3/ECharts、Boot/MP/MySQL 实际参与业务；确认没有替代栈或假数据。
2. 注册或使用本地初始账户登录，新建“食堂满意度验收”：单选满意/一般/不满意，多选价格/口味/排队，1–5量表，开放建议。说明为合成数据。
3. 保存→刷新→检查题目/选项/顺序→预览→发布并保留一次性分享链接。
4. 用两个独立匿名浏览器上下文打开公开链接，无需发起者登录；主动同意参与，至少一份拒绝AI。不要复制已建立会话的标签页后把相同sessionStorage误当成独立受访者。
5. 第一份选满意、量表4、开放“中午排队慢”；先保存→刷新确认恢复→提交。第二份选不满意、量表2、开放“菜有时会卖光”，再提交。
6. 管理端选择对应版本，确认2份、满意/不满意各1人/50%、均值3；图表、统计表、接口和MySQL一致；核对多选分母、缺失、开放原文定位。
7. 刷新已提交页不新增第3份；同会话重复HTTP提交不得改变已提交答案。检查另一个账户不能列出/编辑/发布/关闭/读统计，匿名公开入口不能访问后台。
8. 编辑已发布问卷的草稿，旧链接仍旧版；另发新版后两个版本答案/统计隔离。关闭测试调查，不能新开会话、保存或提交，历史统计仍可查。
9. 查看浏览器Console/Network，记录真实问题；验证窄屏布局、滚动按钮、ECharts resize。当前绑定回环，不把远程手机访问失败误判为业务故障。
10. 截图至少覆盖编辑/发布、保存刷新恢复、提交成功、2份真实统计；截图避免管理密码和匿名能力token。写独立验收报告（建议 `evidence/M1_REVIEW.md`），列检查项、结果、时间、命令、日志/截图、失败复现及新commit。不要覆盖旧证据来抹去失败历史。

上一轮浏览器恢复到错误页时，被当时工具URL安全策略拒绝，故停止该操作，未绕过。它是**既往验收工具阻碍，不是已证明的产品缺陷，也不代表所有新会话都不能验收**。接手者按自己工具的正常授权流程访问本地HTTP页面；若再次被拒绝，不绕过策略、不冒称UI通过，记录具体缺项并交由用户手验。

若发现FAIL，留在M0/M1：先补可复现回归测试→最小修复→运行受影响测试及完整阶段回归→更新进度/证据。验收Agent给出PASS/FAIL/CONDITIONAL后仍需用户确认；在用户明确批准前不进入M2。

## 7. 已修过的关键问题，勿回退

- BCrypt存储使用 `{bcrypt}` 编码标识，Spring Security能正确识别；账户已从M0内存配置升级为M1数据库用户。
- 不从注入的CGLIB服务代理直接访问实例字段；跨Service使用方法调用。
- MySQL默认RR下，关闭检查必须基于持有调查锁后的**当前锁读**，不能用先前普通读快照；调查→会话→答案的锁序保持一致。
- 已提交状态幂等返回；提交事务校验全部答案后才落库；不能重复计数或重试改写已提交答案。
- answers.question_id的ascii_bin与Java区分大小写ID语义一致。
- null题目/选项元素返回400；错误路径参数/缺参返回400；非多选题空数组返回400。空数组回归曾真实失败后修复，测试保留。
- 无本地存储时仍保留发布返回的一次性链接；不能因自动跳转把唯一可见链接丢掉。
- ECharts tooltip使用richText，用户内容不作为HTML插入；Vue展示不用v-html渲染任意回答。

## 8. 已知限制，后续勿误报为已完成

- M1只手动保存，未保存/断网内容无离线持久化承诺；sessionStorage被清理或标签关闭后无法找回原会话。
- 分享token仅发布时返回一次，本浏览器localStorage留公开链接；服务器哈希不可还原。没有密码找回。
- 同调查写操作以调查锁串行保证正确性；统计Java加载指定版本数据聚合。大样本分页、吞吐、压测未完成。
- 限流是本地单节点IP固定窗口：鉴权POST100/min、公开POST300/min；共享NAT共享额度。未做生产分布式限流、独立安全审计。
- 本地HTTP、数据库未启用TLS；无公网部署验收。未在另一台干净Windows或真实手机完成全套部署/界面测试。
- 现有npm audit0漏洞只表示当时npm审计结果，不是所有后端依赖或全系统安全保证。
- AI同意目前只记录是否愿意追问。未来M4分析数据使用范围/同意机制要按产品与研究要求独立核实，不默认扩大用户授权。

## 9. 验收获批后的开发路线（现在不要实施）

每阶段完整要求以开发计划和验收指南为准，下表只标交接重点：

| 阶段 | 重点与必须保留的边界 |
|---|---|
| M2 AI草稿 | 服务端统一可配置OpenAI兼容Provider；结构化输出/Schema与业务校验；可编辑、人工审核再发布；无Key/超时/坏JSON不破坏手工流程；真实模型与Mock明确区分，真实运行记录模型标识且不泄Key |
| M3 自适应追问 | CLARIFY/DEEPEN/EXPLORE/SKIP语义动作、理由和策略版本；拒绝/跳过/停止/失败状态；追问原文独立保存；原子全卷预算与幂等，不能只做逐题次数或字数阈值；不改已发布核心题 |
| M4 新维度 | 语义单元+可定位原文证据；自发/中立追问/选项提示/未确认模型推断四分类；按独立受访者去重；预设维度比较、离题处理、人工接受/合并/重命名/驳回与审计 |
| M5 可信报告 | Java/SQL算数，AI只解释；版本/有效分母/缺失/条件暴露明确；事实、解释、假设分开；ECharts真实趋势/主题证据/导出；不得把有条件追问频率说成总体比例 |
| M6 实验交付 | 同数据、同预算A/B/C/D对照；合成场景、独立人工盲评、可重放事件/成本/耗时；不以AI自评证明增益；Jev仅可插拔可选，未经实验不宣称创新效果 |

沿用M1业务闭环，先查差距再扩展；不重写一个平行原型。新增表走新迁移，保留已有版本/答案。每阶段都要真实代码、Windows命令、相应自动测试和 `evidence/Mx.md`；交付后等用户验收。

六库研究为静态源码阅读，固定分支/SHA、证据路径和许可均在 `docs/OPEN_SOURCE_RESEARCH.md`。没有一个仓库被验证完整覆盖知研核心研究组合；不是“都已实现”或“都没有实现”。SurveyKing/BERTopic为MIT，tduck为Apache2，OASIS为AGPL3；Dialog正文授权、SurveyJS模板许可存在未确认边界。未运行上游、未复制/集成代码。不能因参考BERTopic而擅自新增Python生产服务，不能因其他库是React而更换前端。

## 10. 可复制给接手Agent的首条指令

```text
你接手 D:\LcProject 的「知研 AI」。请先完整阅读 docs/AGENT_HANDOFF.md 及其中的必读文件，然后依据真实源码和当前环境独立验收 M0/M1。

老师技术栈不可改：Vue3+TypeScript+Vite+ECharts，Spring Boot+MyBatis-Plus，MySQL8。当前已有M0/M1代码，历史自动测试28/28，但M1为CONDITIONAL，完整浏览器流程/窄屏/截图尚未完成，用户尚未最终验收。不要推倒重建、伪造结果、覆盖本机.env或用Mock替代数据库。

请复跑真实测试，重点完成浏览器建卷→保存刷新→发布→两个独立匿名会话→保存恢复→提交→指定版本2份/50%/均值3核对，并检查越权、重复提交、关闭和版本冻结。保留真实截图、命令、成功失败数和SQL对账，生成 evidence/M1_REVIEW.md。若失败，先补回归再修复并复验。保护所有密码和匿名能力token。

本次先交付验收结论与待办，等待我的人工确认；没有我明确批准，不进入M2。获批后再按M2–M6逐阶段推进，每阶段都停下验收。开源调研只作参考，不复制集成上游代码，不改变技术栈。
```

若用户之后已验收，可追加明确指令：“已通过M0/M1验收，允许实施M2；M2完成后停止等待验收。” 接手Agent应记录这条新授权，不能自行补写批准记录。
