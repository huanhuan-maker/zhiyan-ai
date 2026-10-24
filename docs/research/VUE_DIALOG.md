# SurveyJS Vue 3 Quickstart 与 Dialog Survey 源码调研

调研日期：2026-10-23（Asia/Shanghai）。范围：只读静态源码审查，不安装依赖、不启动上游应用、不调用真实 LLM，不复制或集成上游实现。本文不表示上游测试通过或 Windows 部署通过。

状态约定：**已验证（源码）**表示可在本次固定提交中直接确认的结构或控制流；**仅文档声称**表示 README/设计文档/注释的描述；**尚未验证**包括运行行为、模型效果、未审查的依赖实现。未找到调用点只能限定到本次检索的仓库和范围，不能证明其他版本、插件或部署环境没有该功能。

本项目约束依据：根目录 `AGENTS.md`、`CODEX_KICKOFF.md` 及 `docs/DEVELOPMENT_PLAN.md`、`docs/PRODUCT_SPEC.md`、`docs/ARCHITECTURE_AND_API.md`、`docs/ACCEPTANCE_GUIDE.md`、`docs/RESEARCH_EVAL.md`。调研开始时 `docs/PROGRESS.md` 尚不存在。知研 AI 继续采用 Vue 3 + TypeScript + Vite + ECharts、Spring Boot + MyBatis-Plus、MySQL 8.x；本调研不授权推进下一开发阶段。

## 1. 版本与证据定位

| 仓库 | 检查分支 | 完整 commit SHA | 本地只读位置 |
|---|---|---|---|
| https://github.com/surveyjs/surveyjs_vue3_quickstart | `main` | `73b58d86bcefac29ed17cef31de5da1b8f1cc116` | `.local/research/surveyjs_vue3_quickstart` |
| https://github.com/boyingliu01/dialog-survey | `master` | `909f0db9cc9263ed6e2ffbb9ba469722de56cb5e` | `.local/research/dialog-survey` |

两个检出的 `git status --short` 均为空。SHA 来自实际 `git rev-parse HEAD`，分支来自 `git branch --show-current`，远端 URL 来自 `git remote -v`。不把本地检出 SHA 等同于未来 GitHub 最新状态。

### SurveyJS 证据

| 编号 | 固定提交证据文件及行号 | 所证明的内容 |
|---|---|---|
| S1 | [package.json L6–41](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/package.json#L6-L41) | Vite/Vue/TS、SurveyJS 依赖和 `latest` 声明 |
| S2 | [src/main.ts L1–13](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/src/main.ts#L1-L13)、[src/router/index.ts L3–19](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/src/router/index.ts#L3-L19) | Vue 插件、六个演示路由 |
| S3 | [src/components/Survey.vue L1–10](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/src/components/Survey.vue#L1-L10)、[Creator.vue L1–14](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/src/components/Creator.vue#L1-L14) | 本地 JSON 初始化渲染器/编辑器 |
| S4 | [data/survey_json.js L1–95](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/data/survey_json.js#L1-L95) | pages/elements 结构、题型及 `visibleIf` 条件 |
| S5 | [Dashboard.vue L9–26](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/src/components/Dashboard.vue#L9-L26)、[DashboardTabulator.vue L9–29](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/src/components/DashboardTabulator.vue#L9-L29)、[data/dashboard_data.js L228–269](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/data/dashboard_data.js#L228-L269) | 仪表盘直接使用两个内置样本，非后端统计 |
| S6 | [package-lock.json L3045–3118](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/package-lock.json#L3045-L3118) | 锁文件中各 SurveyJS 组件为 2.0.0，许可证元数据不同 |
| S7 | [README.md L1–8](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/README.md#L1-L8)、[PDFGenerator.vue L13–22](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/src/components/PDFGenerator.vue#L13-L22) | README 的数据库概述与客户端 PDF 示例范围 |

### Dialog Survey 证据

| 编号 | 固定提交证据文件及行号 | 所证明的内容 |
|---|---|---|
| D1 | [package.json L25–102](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/package.json#L25-L102)、[src/server.ts L1–58](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/server.ts#L1-L58) | Node/TS、Fastify、Nunjucks、Prisma、钉钉接入；非 Spring/Vue 栈 |
| D2 | [prisma/schema.prisma L7–104](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/prisma/schema.prisma#L7-L104)、[L139–215](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/prisma/schema.prisma#L139-L215) | PostgreSQL、访谈/消息/回答/模板/分析及批报告实体 |
| D3 | [src/core/types/index.ts L14–71](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/core/types/index.ts#L14-L71)、[L89–108](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/core/types/index.ts#L89-L108) | 完整状态、每题计数、字符串题目列表、pending 消息/回答 |
| D4 | [src/services/followup.service.ts L72–137](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/services/followup.service.ts#L72-L137)、[L153–193](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/services/followup.service.ts#L153-L193)、[L220–277](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/services/followup.service.ts#L220-L277) | 上下文、结构化动作解析、限制及失败分支 |
| D5 | [src/core/nodes/interviewing.ts L30–145](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/core/nodes/interviewing.ts#L30-L145)、[L149–226](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/core/nodes/interviewing.ts#L149-L226) | FOLLOWUP/NEXT/END 状态转移、NEXT 清零、回答深度与异常回退 |
| D6 | [src/services/prompt.service.ts L78–137](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/services/prompt.service.ts#L78-L137) | 模型策略提示与拒绝/结束识别的语义指导 |
| D7 | [src/repositories/interview-state.repository.ts L167–220](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/repositories/interview-state.repository.ts#L167-L220) | 事务写消息/回答/状态与版本条件更新 |
| D8 | [src/services/analysis.service.ts L52–164](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/services/analysis.service.ts#L52-L164)、[src/services/report.service.ts L220–285](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/services/report.service.ts#L220-L285) | 单人维度分析实际接入与宽松解析，引用脱敏但无逐条原文定位校验 |
| D9 | [src/services/llm-clustering.ts L1–114](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/services/llm-clustering.ts#L1-L114)、[src/services/batch-aggregation.service.ts L40–118](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/services/batch-aggregation.service.ts#L40-L118) | 跨人主题 helper、模型估计数、按一份报告内维度去重的确定性统计 |
| D10 | [src/api/analysis.ts L74–118](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/api/analysis.ts#L74-L118)、[src/services/analysis.service.ts L302–345](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/services/analysis.service.ts#L302-L345) | 聚合接口实际仅建 PENDING 空报告并读取 |
| D11 | [tests/interviewing-routing.test.ts L90–169](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/tests/interviewing-routing.test.ts#L90-L169)、[tests/llm-clustering.test.ts L6–118](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/tests/llm-clustering.test.ts#L6-L118)、[tests/batch-aggregate-api.test.ts L29–58](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/tests/batch-aggregate-api.test.ts#L29-L58) | 有 Mock 动作/聚类单测，聚合 API 测试只断言 PENDING，不能证明端到端聚合完成 |
| D12 | [README.md L69–74](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/README.md#L69-L74)、[L311–313](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/README.md#L311-L313)、[src/core/graph.ts L49–103](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/core/graph.ts#L49-L103) | 自定义流程而非 LangGraph SDK；MIT 仅 README 声明 |
| D13 | [src/integrations/llm/openai-compatible.ts L90–115](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/integrations/llm/openai-compatible.ts#L90-L115)、[L147–171](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/integrations/llm/openai-compatible.ts#L147-L171)、[src/core/nodes/planning.ts L10–26](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/core/nodes/planning.ts#L10-L26) | AbortController 超时、缺 Key 抛错、首题经模型润色 |

## 2. SurveyJS Vue 3 Quickstart

### 2.1 实际技术栈、目录和职责

**已验证（源码）**：Vue 3 + Vue Router 4 + TypeScript + Vite；`package.json` 声明 Vue `^3.3.4`、Vite `^4.4.11`、TypeScript `~5.0.4`，SurveyJS 六个包声明 `latest`。锁文件的 SurveyJS 包为 `2.0.0`，因此须区分依赖声明范围与锁定解析值，不能写成固定使用“当前最新版”。组件包含 Survey Form、Creator、Analytics、PDF；没有采用 ECharts（S1、S6）。

- `src/main.ts`：注册 SurveyJS 表单和 Creator Vue 插件。
- `src/router/index.ts`：主页、表单、建卷器、PDF、图表和表格演示路由。
- `src/components/Survey.vue` / `Creator.vue`：用同一个本地 JSON 分别构造 `Model` 和 `SurveyCreatorModel`。
- `data/survey_json.js`：声明式问卷；`data/dashboard_data.js`：另一份问卷定义及两个内置答卷。
- `Dashboard.vue` / `DashboardTabulator.vue`：SurveyJS Analytics 图表/表格；不是 ECharts，不是 MySQL 统计链。
- `PDFGenerator.vue`：客户端 PDF 保存示例。

完整仓库文件清单及对 `src`、`data` 的 `fetch|axios|localStorage|onComplete|saveSurvey|budget|followup|openai` 检索，加上所有业务组件直接阅读，未找到该 quickstart 自有的 REST 服务、数据库 Mapper、完成后保存回调、LLM Provider 或预算模块。此结论限定为该固定提交的模板自身，不外推 SurveyJS 整个产品或扩展库。

### 2.2 可参考的业务与数据结构

**已验证（源码）**：`pages → elements` 的声明式题目组织，将稳定 `name` 与显示 `title` 分离；`choices` 可区分 `value/text`；已有 `radiogroup`、`checkbox`、`rating`、`comment`、`matrix` 等题型示例。`visibleIf` 例如 `{satisfaction} > 3` 为预置条件显隐，供知研 AI 理解“固定问卷条件逻辑”的边界（S4）。底层表达式求值实现位于外部 `survey-core`，本次没有审计其内部算法。

可借鉴“定义与答卷分离”“题目稳定标识”“编辑/预览使用相同定义”的产品设计。知研 AI 仍应自行定义受控的四题型 DTO、发布版本与答案表，由 Spring Boot 校验并通过 MyBatis-Plus 持久化。不要直接引入这一模板作为真实数据库交付。

### 2.3 四项核心机制核验

| 核心问题 | 结论及边界 |
|---|---|
| 动态追问 | **已验证的是预置条件题显隐**，不是对开放回答进行语义分析并新生成追问。该模板内没有发现自有生成式追问路径；不能把 SurveyJS 的“动态面板/条件题”等产品概念等同于知研 AI 的 CLARIFY/DEEPEN/EXPLORE。 |
| 追问预算 | 检查全部模板业务组件与数据定义后，未见追问计数、全卷剩余额度、幂等扣减或预算事件。外部库是否有其他配额能力尚未验证。 |
| 停止策略 | JSON 为有限页和题，普通完成流程由外部库负责；没有证据证明模板实现语义停止、拒绝 AI、低信息增益停止或故障降级。 |
| 跨受访者主题聚合 | 实际仪表盘输入为两个本地常量答卷（S5）。没有发现本模板主题抽取/嵌入/聚类/证据表；SurveyJS Analytics 的整体功能范围未做外部源码审计。 |

### 2.4 与知研 AI 的差距和许可证

README L3 说 SurveyJS 组件允许把问卷存数据库，是组件用途概述；**该 quickstart 已实现真实数据库提交**不能由此推出。源码目前是展示集成方式的前端样例，缺少知研 AI 必须的 Spring Boot/MyBatis-Plus/MySQL、所有权、不可变发布版本、提交幂等、全局预算、主题来源分类、引用校验及 ECharts 真实统计。它适合参考渲染器与 JSON 定义的分工，不是后端基础工程或核心创新实现。

许可证必须分层：

1. **模板自身**：固定提交 `git ls-tree -r --name-only HEAD` 未见 `LICENSE/COPYING/NOTICE` 文件；README 未声明授权条款、`package.json` 无 license 字段。当前不能确认模板代码获得 MIT 复用授权，公开可读不等于任意复用。
2. **依赖元数据已验证**（S6）：`survey-core`、`survey-vue3-ui` 的锁文件 license 为 `MIT`；Creator 两个包指向 `https://surveyjs.io/Licenses#SurveyCreator`；Analytics、PDF 为 `SEE LICENSE IN LICENSE`。不能把整个 SurveyJS 套件写为 MIT。
3. **完整许可条款尚未验证**：本次没有取得各依赖发行包的完整许可证、商业/教育授权范围和再分发条款。尝试 `git ls-remote` 读取外部 SurveyJS 仓库失败（GitHub 443 连接失败），没有将失败写成查证成功。若未来考虑复用，应先固定发行版本、审阅其 LICENSE 与官方授权；本次只做设计研究，无代码复制。

## 3. Dialog Survey

### 3.1 实际技术栈、目录和职责

**已验证（源码）**：TypeScript/ESM + Node.js `>=20.19.0`、Fastify 5、Prisma 7.10.0 + PostgreSQL、Zod、Nunjucks 服务端模板、HTMX/Alpine 静态脚本、钉钉 Stream/消息接口、OpenAI 兼容 LLM。测试依赖为 Vitest/PGlite，另有 Stryker、Playwright（D1、D2；前端脚本可从仓库 `public/js/` 和 `src/views/` 查证）。不能使用其 Node/Prisma/PostgreSQL 直接替换知研 AI 的规定栈。

`src/core/graph.ts` 名称虽然含 graph，实际是手写顺序/分支流程：首次走 planning、非活动态短路、后续走 interviewing、结束时异步调度单人分析（D12）。`package.json` 没有 LangGraph SDK 依赖；README 英文也明确是 “LangGraph-inspired workflow (not StateGraph API)”。不要写成已接入 LangGraph StateGraph。

关键目录：`src/api/` 为模板/计划/分析/健康接口；`src/core/nodes/` 为开场及访谈路由；`src/services/` 为追问/提示词/报告/维度/聚合 helper；`src/repositories/` 为事务与 Prisma 访问；`src/integrations/llm/` 为模型边界、`dingtalk/` 为触达渠道；`prisma/` 为 schema/migrations；`src/views/` 为管理台和报告；`tests/` 为单元及集成测试源码。

### 3.2 数据结构与可参考机制

- **访谈状态**（D2、D3）：`currentQuestion`、`followupCount`、`maxFollowups`、状态枚举及乐观锁 `version/originalVersion`；待写 `pendingMessages/pendingResponses`。
- **原答与追问分开标识**（D2、D5）：Response 含 `questionId/content/isFollowup/followupDepth`，消息另表保留对话。方向可参考；知研 AI 还需要明确 followup ID、决策 ID、提问原文、源回答 ID、来源类别和字符偏移，不能只存深度。
- **模型动作与执行器分离**（D4、D5）：LLM JSON 解析为 `NEXT/FOLLOWUP/END`，控制层二次限制 FOLLOWUP 次数并更新状态；失败转 NEXT。知研 AI 可独立设计 Java Provider + 决策校验器 + 状态机，使用 CLARIFY/DEEPEN/EXPLORE/SKIP。
- **并发持久化**（D7）：消息、回答与状态在事务中写入，并用版本条件更新。只说明其源码有此保护，不把它视为知研 AI 所需的“全卷预算唯一扣减”已经解决。
- **单人维度标注**（D8）：模板维度输入模型，得到 `dimensionTags/emergentTags` 并保存，引用做 PII 脱敏。适合作为“分析失败不影响主访谈”的职责划分参考。

### 3.3 动态追问、预算和停止的实际控制流

**动态追问已验证到源码接线层**：`interviewingNode` 接受当前回答、题目、下一题，调用 `generateSmartResponse`；提示词包含最近 6 条历史、当前回答和每题追问计数（D4、D5）。模型可以决定 FOLLOWUP 而不移动题号。真实模型能否稳定识别模糊性、产生中立高质量追问，**尚未运行验证**；本次不能声称 AI 效果达标。

**预算是每题上限，不是全问卷预算**：`routeAction` 在 FOLLOWUP 时 `followupCount + 1`，NEXT 时清零（D5 L100–118）；状态中只有该计数和 `maxFollowups`（D3）。因此 5 题各追问多次仍符合这套实现；没有证明全卷最多 N 次，也没有全卷预算账本、唯一决策扣减约束或跨题机会成本分配。不能把 `Interview.maxFollowups` 字段所在实体层级误判为“全局预算”。

**停止已验证的硬控制**：FOLLOWUP 到达每题上限强制 NEXT；NEXT 在末题完成；模型 END/shouldEndInterview 可提前完成；异常分支可推进下一题（D5）。**仅提示词控制**：回答充分时 NEXT、拒答时 NEXT、要求结束时 END（D6）；这些自然语言意图依赖模型，不等于确定性“跳过/拒绝 AI”交互和不可撤销状态保护。源码没有证明信息增益阈值、诱导风险评分、跨题预算最优分配。

值得谨慎参考的边界：

- `resultFromParsed` 对 FOLLOWUP 原文不调用 `stripExtraQuestions`（D4 L123–133），尽管 prompt 和注释声称每次只能一问；所以“每轮严格一问”没有被所有输出路径硬保证。相关单测也明确保留 FOLLOWUP 原文（`tests/interview-dialog-determinism.test.ts` L106–116）。
- `STAY` 是节点执行器接受的内部动作，超上限也允许重复；正常 `parseLLMResponse` 不接受 STAY，会降级 NEXT（D4 L81–88、D5 L30–43）。不能把仅测试 mock 可注入 STAY 写成正常模型必然可以绕过上限，也不能照搬该隐式动作集。
- 追问 Provider 的 `fromEnv()` 在函数 try 块外；缺 Key 可由外层 interviewing 捕获并前进，但首题 `polishFirstQuestion` 同样在 try 前构造客户端，planning 未见本地捕获（D4 L48–68、D13）。因此不能宣称所有入口无 Key 都可靠降级，需运行验证并在知研 AI 中统一处理。
- 首题会调用模型润色，后续 NEXT 的题干由模型生成过渡文本（D13、D6）。这与知研 AI“发布核心题文本冻结”的测量一致性要求不同，应保持固定题干原文，追问单独显示与存储。

### 3.4 跨受访者聚合：有 helper，不等于闭环

**已验证（源码）**：

1. 单人分析真实调用维度抽取并保存 `dimensionTags/emergentTags`（D8），但 `batchAnalyze` 只是循环做单人报告（`analysis.service.ts` L168–188），本身不是跨人聚类。
2. `clusterDimensionQuotes` 将引文列表交给 LLM 分为 3–8 类；`discoverEmergentIssues` 对多人的 emergent tags 要求至多 5 个议题；`mentionCount` 由模型提供，新议题 prompt 明说 estimated count（D9）。这不是 BERTopic/embedding/HDBSCAN 实现。
3. `computeDimensionStats` 在每份 tags 内用 Set 去重维度，然后用出现次数/调用方给定 `totalInterviews` 计算提及率（D9 L47–118）。它假设输入一份数组代表一个人/一份访谈，未携带受访者身份自行去重，因此不能保证来自多份重复报告的人不被重复计数。
4. `BatchAnalysisReport` 有 metrics/topics/emergents/checkpoint 字段；聚合 POST 实际仅创建内容空的 PENDING 报告（D2、D10），GET 读取它。
5. 在固定提交的全 `src/` 搜索 `clusterDimensionQuotes|discoverEmergentIssues|computeDimensionStats|createCheckpoint|runWithTimeout|executeWithConcurrencyLimit`，这些 helper 仅见定义，未见生产调用点；`src/server.ts` 未接入聚合执行 worker。因此**已检查主应用中未验证到从聚合请求→执行聚类→保存 COMPLETED 的闭环**。不排除仓库外部署工具，但本仓库不能据此声称该功能完整。

**主题可信差距**：当前引用是自由字符串，解析主要判断数组，不按回答 ID、原文偏移或存在性校验（D8、D9）。没有在已检查路径证明四类来源标签、人工接受/合并/驳回审核、排除模型推测后的有效人数分母。新主题的 model-estimated mentionCount 更不能直接作为可信统计。知研 AI 必须将模型主题候选与数据库确认的证据、独立受访者计数分开。

### 3.5 许可证及验证等级

**仅 README 声称 MIT**：README badge 与 L311–313 写 MIT；该提交根 `package.json` 无 license 字段，完整树未见 LICENSE/COPYING/NOTICE 正文。结论应写为“作者声明 MIT，授权正文/版权归属仍需确认”，不能假装已逐条审阅完整 MIT 授权。若后续获完整 MIT 授权，通常须保留版权及许可通知；依赖仍需分别清点。本次没有复制代码。

测试源码是证据，不是执行报告：D11 的追问路由与聚类测试使用 mock；聚合 API 测试期望 PENDING。README 的大量测试数、钉钉生产运行与质量宣传属于文档描述，本次未复跑。没有真实模型、钉钉、数据库、Windows 部署和实际主题精度验证，不能写为已通过。

## 4. 对知研 AI M0–M6 的参考建议

| 阶段 | SurveyJS quickstart 参考边界 | Dialog Survey 参考边界 | 知研 AI 应自行完成的差距 |
|---|---|---|---|
| M0 工程 | 参考 Vue/Router 组件分工；不要照搬 latest 依赖或演示数据当真实链 | 参考 Provider 与业务分层、健康检查边界；不引入 Node/Prisma/PostgreSQL | 固定兼容版本，Spring Boot + MyBatis-Plus 真 MySQL 集成测试、ECharts 联通及 Windows PowerShell 命令 |
| M1 固定问卷 | 参考 stable name/value 与展示 title/text、定义/答卷分离；四题型先行 | 参考消息/回答分表和版本冲突处理思想 | 数据库发布快照、真实匿名会话、提交幂等、所有权与 SQL 统计；核心题原文冻结 |
| M2 AI 设计 | JSON 问卷结构可作为设计对比对象，不复制 Creator 或引入未知许可证组件 | 参考 OpenAI 兼容 Provider 与结构化返回分离 | Java 服务端 JSON Schema/题型/重复/诱导校验，人工审核，明确 Mock/model，无 Key 所有入口可用 |
| M3 单人探索 | `visibleIf` 作为固定条件分支对照，不当作语义追问 | 重点参考动作执行器、每题上限、历史上下文、异常前进；识别模型提示和硬规则的区别 | 实现 CLARIFY/DEEPEN/EXPLORE/SKIP；全卷预算与唯一扣减；明确拒绝/跳过、隐私/诱导硬门槛、决策证据日志 |
| M4 跨人新维度 | 本模板无可确认的语义聚合实现 | 借鉴单人抽取→跨人归并的职责划分、每份报告内去重；不可把未接线 helper 当成完整 pipeline | 批处理闭环、四类来源、存在性和偏移校验、按受访者去重、人工复核、发布题不回写 |
| M5 可信统计 | 参考问卷/表格展示分工；不使用 SurveyJS Analytics 替换 ECharts | 确定性 mentionRate 的分母思想可参考；模型估计次数不可当事实 | Spring Boot/MyBatis-Plus 计算有效分母、缺失和版本；ECharts 接真实 API；数字/AI 解释/假设分层 |
| M6 实验 | 可作固定条件问卷产品设计对照，不能称 AI 基线 | 可设计普通 LLM 自由追问的概念基线；未跑源码、未证明效果、许可证未清不得直接集成 | 用本项目实现 A–D 策略、同预算、盲评、来源准确率/新增语义单元/退出负担/成本；记录模型种子版本与真实运行日志 |

研究结论：两库分别提供“声明式问卷组件接法”和“模型动作驱动多轮访谈”的具体源码参考，但都不能证明已经满足知研 AI 的固定核心问卷 + 全卷幂等预算 + 证据可信跨人新维度发现组合。本次只产出调研，不改变业务技术栈、不迁移或集成代码、不提前进入 M1–M6。
