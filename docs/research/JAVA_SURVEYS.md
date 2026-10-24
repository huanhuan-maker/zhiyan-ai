# Java 问卷系统源码调研：SurveyKing 与 tduck-platform

研究日期：2026-10-23（Asia/Shanghai）。本报告为六库总报告的专项证据附件。依据知研 AI 的 AGENTS.md、CODEX_KICKOFF.md、DEVELOPMENT_PLAN、PRODUCT_SPEC、ARCHITECTURE_AND_API、RESEARCH_EVAL 及验收要求解读。

只做静态源码阅读与设计比较，未执行上游代码、安装上游依赖或验证其运行结果；没有将上游实现复制到知研 AI 业务工程。以下“已验证”仅表示固定 commit 下实际读到相应源码，不代表功能端到端测试通过。关键负面结论使用“已读范围未发现”，不把搜索不到解释为全仓库不存在，更不覆盖商业版或其他仓库。

## 1. SurveyKing

- 仓库：[javahuang/SurveyKing](https://github.com/javahuang/SurveyKing)
- 本地静态阅读副本：`D:/LcProject/.local/research/SurveyKing`。
- 分支：`main`；commit：`5de0d05b682ee34244c0b6c07be24eb6358cd8a5`。
- 使用 `git branch --show-current`、`git rev-parse HEAD`、`git remote -v`、`git status --porcelain` 核对；阅读副本工作树干净，为浅克隆。结论仅对应此 commit，不推断历史版本。
- 阅读范围：父/子 Maven 清单、核心实体与 schema、项目/公开填答/答卷/报表服务、全部 AI 模块文件目录与关键实现、数据库初始化器、许可证。Java 源文件内检索 followup/probe/budget/openai/llm/topic/cluster 及中文追问/预算/聚类，逐一阅读有关命中；排除巨大压缩静态资源参与负面结论。

### 1.1 技术栈与核心目录（来源分层）

| 层 | 实际观察与验证状态 |
|---|---|
| 服务端 | **源码已验证** Spring Boot 2.7.7、Java 8、Spring Security、MyBatis-Plus 3.5.0；父 POM 锁定，rdbms 模块实际引 Starter、服务通过 MP ServiceImpl/Wrapper 读写（S1/S2/S6/S8）。 |
| 数据库 | **源码已验证** MySQL Connector 8.0.26，初始化器提供 MySQL/H2 分支（S2/S13）。此处证明代码路径，未连库验证；不能把其 H2 快速启动方案用于知研 AI 的 MySQL 验收。 |
| AI | **源码已验证** Spring WebFlux WebClient 访问 OpenAI 兼容 chat completions，系统配置管理 endpoint/key/models，响应 Flux 流式输出（S10）；这不是 Python 或 Node 服务端。 |
| 业务前端 | **README 声称** React、Ant Design（S15）；**编译产物佐证**静态 Umi bundle 包含 React hooks 与业务路由（S16）。`client/` 在该 commit 仅 README todo（S14）；因此原始前端 package/组件目录、精确 React/AntD 版本、图表库和重新构建能力**尚未验证**。 |
| 文档站 | `website/` 是单独文档站；其中 React 依赖不能当作业务前端 package 的证据。 |

核心目录：`server/api` 是 HTTP 接口与资源装配；`server/shared` 是 DTO/schema/安全与通用契约；`server/rdbms` 是实体、Mapper、业务服务；`server/ai` 是 AI 建卷聊天适配；`server/flow` 等虽在目录中，父 Maven 模块未启用，不能仅凭目录认定当前运行链已启用（S1）。

### 1.2 可参考的业务模型与机制

**源码已验证**：`Project` 将问卷 schema 和 setting 通过 JacksonTypeHandler 存储，`SurveySchema` 以稳定 id、题型、递归 children 与 attribute 表示问题树；attribute 有显示、必填、跳转、终止、计算规则字段（S3/S5）。这是“问卷结构与渲染规则”的参考，而非 AI 生成问题的证据。

`Answer` 独立存项目关联、临时与最终答案、问卷 schema 和元信息；公开保存服务有事务边界，答卷服务区分更新与新增（S4/S7/S8）。可借鉴“原始业务对象与答卷生命周期分开”，但已有 schema 字段不自动证明每次发布都创建不可变版本。项目更新实现仍可更新原项目与状态（S6）；**没有在已读链路验证知研要求的 survey_version 冻结协议**。

`ReportServiceImpl` 实际从 AnswerMapper 按项目查询答卷，然后在服务端解析答案做计数、数值最小/最大/均值、每日回收统计（S9）。可参考后端确定性统计的分层；该方法未呈现问卷版本过滤、逐题有效分母/缺失排除契约，查询本身也未见 tempSave 完成状态过滤，不能未经测试直接作为知研统计口径。

AI 方面，默认 prompt 要求生成问卷/考试及题型标记文本（S11），不是严格 JSON Schema 草稿；聊天历史仅取最后10条、缓存会话10分钟（S10/S12）。可参考 Provider 的系统配置、流式用户反馈与错误事件；知研仍须独立实现结构校验、人工确认、模型身份记录和失败降级。响应明文日志见 S10:201/225，故隐私记录设计不能照搬。

### 1.3 创新能力逐项核验

| 需求 | 判定 | 可核查的边界 |
|---|---|---|
| 基于当前开放回答动态生成澄清/深化/探索追问 | **已读范围未发现对应实现；不可认定已支持** | S10/S11 的 AI 主链是创建者建卷/考试聊天；S7/S8 的受访答卷保存未看到调用 AI 决策。通用聊天接口不是受访者追问状态机。 |
| 全问卷追问预算与幂等扣减 | **已读范围未发现** | S10 的“最后10条历史”是上下文截断；S12 的10分钟是缓存失效。两者均不是每题/全卷追问额度，更未证明并发重试不重复扣。 |
| 停止策略 | **收集门禁已验证；语义停止尚未验证** | S7 的 validateProject（591–636）检查暂停、总回收数、截止时间及填答限制；S5 有 finishRule 字段；S10 有网络超时/错误终止。均不等于信息充足/诱导风险/负担评估后的 SKIP。 |
| 跨受访者主题聚合、新维度与证据归因 | **已读范围未发现** | S9 是统计计数，不是文本聚类；没有在已读实体与 AI 流程见带来源类别的 theme_evidence 或人工主题复核链。 |
| README AI 宣称 | **部分已源码佐证** | README 的 AI 辅助创建、OpenAI 兼容和流式生成有 S10/S11 佐证；不能外推为上述核心创新。 |

### 1.4 与知研 AI 的差距及许可证

后端框架方向相近，但 Java8/Boot2/旧 MP Starter 版本不能直接替换本项目已锁定的 Java17+/Boot3 对应依赖；React 业务前端违反老师栈且此快照缺可读原始组件。知研必须独立补齐固定发布版本、匿名会话权限、持久幂等、AI自愿参与、追问独立表、语义动作/理由/全局预算、真实证据主题审核、有效分母与四组实验。不能把该系统已有考试/工作流/微信功能扩张为本项目当前阶段任务。

**LICENSE 已验证为 MIT（S17）**：允许使用、修改与分发，包括商业使用；若以后复用实质部分，应随复制保留原版权与许可文本。MIT 无担保，不等于第三方依赖、商标、图片或外部 API 皆无限制。当前只借鉴设计，不引入源码；本报告不为缺失前端源文件或商业产品额外授予权利。

### 1.5 M0–M6 参考建议（建议不构成实施授权）

| 阶段 | 建议 |
|---|---|
| M0 | 参考 api/shared/rdbms 的职责拆分与真实 Mapper 链；保持单体最小实现，使用本项目 MySQL8 与锁定版本，不引入 H2 或 React；不需照搬多模块。 |
| M1 | 借鉴 schema/项目/答卷解耦、暂存/完成状态与公共提交服务；新增明确冻结版本、会话 token 隔离和数据库唯一幂等约束。 |
| M2 | 参考可配置 OpenAI 兼容 Provider 与流式输出；独立改为严格 JSON Schema、校验后草稿入库、人工审核发布，不复用标记文本 prompt 当合格协议。 |
| M3 | 自研四动作决策、同意/跳过/隐私硬约束与事务预算；不能将通用聊天历史长度或超时当全局追问预算。 |
| M4 | 自研匿名证据定位、来源四分类、跨人去重与审核流水；S9 只作为基础统计参照。 |
| M5 | 借鉴服务端统计层，新增版本/完成状态/缺失/有效分母字段；Vue3 ECharts 读取确定性接口，报告解释与事实分开。 |
| M6 | 以其可说明的固定问卷闭环作为能力对照背景；不宣称运行实验或优于竞品。自建同预算 A/B/C/D、种子/模型/成本与独立标注记录。 |

### 1.6 固定 commit 证据目录

| ID | 源码证据（仓库相对路径及行） | 阅读所得 |
|---|---|---|
| S1 | [`server/pom.xml:6–28`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/pom.xml#L6-L28) | 模块与 Spring Boot 2.7.7、Java 8；MyBatis-Plus 依赖版本见 89–93 |
| S2 | [`server/rdbms/pom.xml:38–48`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/rdbms/pom.xml#L38-L48) | MyBatis-Plus Starter 和 MySQL Connector 8.0.26 |
| S3 | [`server/rdbms/src/main/java/cn/surveyking/server/domain/model/Project.java:21–45`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/rdbms/src/main/java/cn/surveyking/server/domain/model/Project.java#L21-L45) | t_project、survey JSON、setting JSON、发布 status |
| S4 | [`server/rdbms/src/main/java/cn/surveyking/server/domain/model/Answer.java:21–68`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/rdbms/src/main/java/cn/surveyking/server/domain/model/Answer.java#L21-L68) | t_answer、projectId、tempAnswer、answer、survey、tempSave |
| S5 | [`server/shared/src/main/java/cn/surveyking/server/domain/dto/SurveySchema.java:21–45`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/shared/src/main/java/cn/surveyking/server/domain/dto/SurveySchema.java#L21-L45) | 递归题目 schema；条件规则见 237–277 |
| S6 | [`server/rdbms/src/main/java/cn/surveyking/server/impl/ProjectServiceImpl.java:90–145`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/rdbms/src/main/java/cn/surveyking/server/impl/ProjectServiceImpl.java#L90-L145) | 创建所有者、项目更新与状态更新 |
| S7 | [`server/rdbms/src/main/java/cn/surveyking/server/impl/SurveyServiceImpl.java:253–307`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/rdbms/src/main/java/cn/surveyking/server/impl/SurveyServiceImpl.java#L253-L307) | 事务性公开答卷保存；全卷收集门禁见 591–636 |
| S8 | [`server/rdbms/src/main/java/cn/surveyking/server/impl/AnswerServiceImpl.java:216–233`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/rdbms/src/main/java/cn/surveyking/server/impl/AnswerServiceImpl.java#L216-L233) | 按已有 ID 更新，否则 Mapper Service 保存新答卷 |
| S9 | [`server/rdbms/src/main/java/cn/surveyking/server/impl/ReportServiceImpl.java:33–96`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/rdbms/src/main/java/cn/surveyking/server/impl/ReportServiceImpl.java#L33-L96) | 按项目读真实答卷，递归计数/数值统计/每日回收 |
| S10 | [`server/ai/src/main/java/cn/surveyking/server/ai/service/impl/OpenAiCompatibleChatServiceImpl.java:127–241`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/ai/src/main/java/cn/surveyking/server/ai/service/impl/OpenAiCompatibleChatServiceImpl.java#L127-L241) | 可配置模型、建卷提示、最后 10 条历史、流式调用、超时与错误事件 |
| S11 | [`server/ai/src/main/resources/prompt/openai-compatible.md:1–26`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/ai/src/main/resources/prompt/openai-compatible.md#L1-L26) | 问卷/考试生成格式提示，而非受访者追问决策 |
| S12 | [`server/ai/src/main/java/cn/surveyking/server/ai/service/ConversationCacheService.java:17–80`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/ai/src/main/java/cn/surveyking/server/ai/service/ConversationCacheService.java#L17-L80) | 内存对话缓存，10 分钟过期 |
| S13 | [`server/shared/src/main/java/cn/surveyking/server/core/uitls/DatabaseInitHelper.java:55–70`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/shared/src/main/java/cn/surveyking/server/core/uitls/DatabaseInitHelper.java#L55-L70) | 实际 MySQL/H2 选择分支 |
| S14 | [`client/README.md:1–4`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/client/README.md#L1-L4) | client 只有 todo，缺业务前端依赖清单与可读源码 |
| S15 | [`README.zh-CN.md:156–162`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/README.zh-CN.md#L156-L162) | React/Ant Design 等技术栈声明（README 证据） |
| S16 | [`server/api/src/main/resources/static/umi.cc68a383.js:1–1`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/api/src/main/resources/static/umi.cc68a383.js#L1-L1) | 编译 bundle 可见 React/React hooks/Umi 路由；不能代替前端原始源码 |
| S17 | [`LICENSE:1–21`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/LICENSE#L1-L21) | MIT 原文、版权与许可保留条件 |

## 2. tduck-platform

- 指定仓库：[tduckboot/tduck-platform](https://github.com/tduckboot/tduck-platform)；不是自行替换为 README 所链接 TDuckCloud 的最新仓库。
- 分支：`master`；commit：`e397d519b39de53b40104e9288ba88f8182e9912`。
- 本地 git clone/ls-remote 直连 GitHub:443 失败；改用已连接的 GitHub 工具只读获取仓库元数据、branch/master、完整 recursive tree（`truncated=false`），并按上面固定 SHA 获取关键文件。**未创建可运行本地 clone，未运行其代码**。
- SHA 与分支证据：[分支 API](https://api.github.com/repos/tduckboot/tduck-platform/branches/master)；完整文件清单可复查：[固定树 API](https://api.github.com/repos/tduckboot/tduck-platform/git/trees/e397d519b39de53b40104e9288ba88f8182e9912?recursive=1)。分支端点会变化，报告正文以 SHA 为准。
- 本报告实际阅读根及 common/project 的 POM、核心实体、项目/答卷/条件控制器、结果/设置/统计服务、去重拦截器、SQL、配置与 LICENSE。未把整个 tree 路径清单当作全源码逐文件审计。

### 2.1 技术栈与核心目录

| 层 | 实际观察与验证状态 |
|---|---|
| 服务端 | **源码已验证** Java8、Spring Boot2.3.5.RELEASE、MyBatis-Plus3.4.3；业务服务实际继承 MP ServiceImpl，用 Wrapper 查询与 save 入库（T1/T2/T12）。 |
| 数据库与缓存 | **源码已验证** MySQL JDBC、MySQL JSON列/处理器、Redis 依赖与连接配置（T2/T3/T17）；保存答卷需 Redis 递增流水号（T12）。MySQL5.7+ 是 README 最低要求，不能据此声称 MySQL8 已运行通过。 |
| 前端 | **仅 README 声称** Vue2、ElementUI、ECharts、Axios（T18）。指定仓库完整树无 package.json/.vue，README 指向另一个前端仓库；本次没有扩大到该独立仓库，故 Vue2/ECharts 具体版本及实际页面执行**未验证**，不能报成 Vue3 项目。 |
| 辅助组件 | POM 验证 Hutool/Guava/Lombok、微信与对象存储模块；本项目当前最小工程无需引入这些外部依赖（T1）。 |

目录职责：`tduck-api` 承载公开/发起者接口；`tduck-project` 包含项目、题目、条件、答卷、设置、统计；`tduck-account` 账号；`tduck-common` 提供通用校验/工具/Mapper支持；`tduck-storage` 文件存储；`tduck-wx-mp` 微信；`doc/` 有 SQL。关键文件见证据表 T1–T19。

### 2.2 可参考业务模型和算法机制

**源码已验证**：项目以公开 key、发起者 userId、status 表达生命周期（T4）；题目独立记录 formItemId/type/label/required/sort，题型扩展配置为 JSON expand（T5）。结果分 originalData/processData，并带完成时间与提交元数据（T6）。可借鉴“稳定题目标识 + 类型化扩展 + 原始结果和展示结果区分”。但是 processData 不能代替知研追问独立记录与证据片段定位；IP、地区、微信信息也不应默认照搬到匿名研究中。

条件逻辑包含目标 formItemId、条件列表、ALL/ANY 组合，接口可保存和查询，服务是常规 CRUD（T7/T8/T9）。**这证明预先配置的条件规则存储，不证明运行时 LLM 追问，更不能因名称 Logic 就认定实现自适应语义决策**；前端执行器位于未调研的独立仓库，因此条件规则最终渲染行为未运行验证。

发布方法只检查有题目后更新 RELEASE，停止更新 STOP；题目更新按项目/题ID就地写入（T10）。已读数据模型没有独立 survey_version 关联，发布方法没有建不可变快照操作；知研不能把此发布控制直接当固定版本保证。

结果创建先检查收集设置，再保存并异步通知（T11/T12）；T13 有开始/结束时间、总量、IP/微信限次。去重拦截器用请求体指纹与2秒 Redis 键（T16），是短时重复请求控制，**不是持久会话提交幂等**，不能满足刷新重试永不重复计数或预算永不重复扣减。

统计服务枚举单选、多选、下拉，将选项初始化为0，遍历 processData 逐项累加，返回题名和统计数组（T14）。这是跨答卷确定性选项计数，并非跨受访者语义主题发现；统计方法未提供知研要求的分母/缺失/版本元信息。基于标签/逗号切分的显示值统计也不能代替稳定 optionId 的可靠聚合。

### 2.3 创新能力逐项核验

| 需求 | 判定 | 可核查边界 |
|---|---|---|
| 开放回答语义动态追问 | **已读范围未发现；未验证支持** | T7–T9 是人工配置条件 CRUD；T11/T12 是答卷保存；已读核心路径没有 LLM 调用与 CLARIFY/DEEPEN/EXPLORE 追问决策。 |
| 全问卷预算 | **已读范围未发现** | T13 的数量是全调查回收数，T16 是2秒请求重复控制，均不是受访者全卷追问次数预算。 |
| 停止策略 | **问卷收集停止已验证；信息价值停止未验证** | T10/T13 支持 STOP、日期/总回收数和填答限次；未见信息充分、受访者拒绝 AI、信息增益等停止判据。 |
| 跨受访者主题聚合 | **选项计数已验证；开放题主题机制未验证** | T14 只处理选项频数；T15 的 ProjectTheme 是颜色/头图/样式模板，不能把 theme 命名当语义主题证据。 |
| 其他版/付费版能力 | **尚未验证** | 不推断同组织其他仓库、在线 SaaS 或商业产品能力，也不把未知写成没有。 |

### 2.4 与知研 AI 的差距、风险与许可

它可作为传统问卷生命周期/可配置表单的设计参考，后端技术类型接近，但依赖时代较旧，前端声明为 Vue2，Redis 为实际保存链依赖。不能通过改用 Vue2 或额外 Node 服务来适配本项目，更没有必要在 M0 为参考项目引入 Redis/微信/OSS。

知研仍需冻结版本、匿名会话级权限与幂等、后端答案 schema 校验、AI同意与降级、预算事务化、独立追问证据、新维度审核、统计分母和实验事件。已读部分控制器与服务的权限边界仍需完整全链路验证；带 @Login 并不证明所有权校验充分，不在此报告把静态疑点宣称为已复现漏洞。T12 的动态查询条件构造及 T16 的请求体日志也不适合未经参数化/脱敏复核就移植。本研究未对任何远端部署做漏洞测试。

**LICENSE 原文已验证为 Apache License2.0（T19）**，不是仅依据 README 或项目品牌判断。将来若复用代码再分发，应附许可、保留相关版权/归属、标明修改，若上游分发包含 NOTICE 须依条款保留归属；许可证有专利授予及其终止条件，不授予商标使用权，无担保。该许可结论仅针对指定 SHA 中所见 LICENSE，不能自动覆盖外部前端仓库、依赖、图片和商业扩展。本次不复制/集成。

### 2.5 M0–M6 参考建议（建议不构成实施授权）

| 阶段 | 建议 |
|---|---|
| M0 | 参考 MP Starter/Service/数据库配置分工；保持知研锁定 Java17+/Boot3/MP Boot3 Starter/MySQL8，使用真实集成测试；不引入它的 Redis 依赖。 |
| M1 | 借鉴稳定 formItemId、题型扩展、创建/发布/关闭/提交的业务界面；独立实现所有权、不可变版本、匿名会话与持久幂等。 |
| M2 | 该快照已读路径未提供 AI草稿可复用设计；自研 Provider+严格结构校验，发布前人工审查。 |
| M3 | 把预配条件规则仅当基础分支设计参考；自研语义决策/停止理由/同意与跳过/跨题预算，禁止拿总回收量替代追问次数。 |
| M4 | 不复用 ProjectTheme 作为语义主题；自研语义单元、跨人去重、原文证据与审核审计。 |
| M5 | 借鉴后端计数/趋势接口形式，但独立以稳定 optionId 统计，明确有效分母、缺失、版本；Vue3 ECharts 消费接口，不能搬 Vue2 页面。 |
| M6 | 参考其定时停止/限次情形设计回归案例；用持久幂等、并发预算、权限隔离、模型超时及数据来源核验补齐研究测试。 |

### 2.6 固定 commit 证据目录

| ID | 源码证据（仓库相对路径及行） | 阅读所得 |
|---|---|---|
| T1 | [`pom.xml:12–45`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/pom.xml#L12-L45) | Java8、SpringBoot2.3.5.RELEASE、MP3.4.3 与六个模块 |
| T2 | [`tduck-common/pom.xml:24–42`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-common/pom.xml#L24-L42) | Redis、MySQL Connector、MyBatis-Plus Starter |
| T3 | [`tduck-api/src/main/resources/application-dev.yml:1–19`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-api/src/main/resources/application-dev.yml#L1-L19) | MySQL JDBC 和 Redis 连接；凭据不在报告重现 |
| T4 | [`tduck-project/src/main/java/com/tduck/cloud/project/entity/UserProjectEntity.java:22–72`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-project/src/main/java/com/tduck/cloud/project/entity/UserProjectEntity.java#L22-L72) | 项目 key、userId、发布状态 |
| T5 | [`tduck-project/src/main/java/com/tduck/cloud/project/entity/UserProjectItemEntity.java:25–96`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-project/src/main/java/com/tduck/cloud/project/entity/UserProjectItemEntity.java#L25-L96) | 独立题目、formItemId、type、required、sort、expand |
| T6 | [`tduck-project/src/main/java/com/tduck/cloud/project/entity/UserProjectResultEntity.java:23–98`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-project/src/main/java/com/tduck/cloud/project/entity/UserProjectResultEntity.java#L23-L98) | 原始/处理答案 JSON 与客户端元数据 |
| T7 | [`tduck-project/src/main/java/com/tduck/cloud/project/entity/UserProjectLogicEntity.java:20–63`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-project/src/main/java/com/tduck/cloud/project/entity/UserProjectLogicEntity.java#L20-L63) | 预设条件集合与目标题目结构 |
| T8 | [`tduck-project/src/main/java/com/tduck/cloud/project/entity/enums/ProjectLogicExpressionEnum.java:17–28`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-project/src/main/java/com/tduck/cloud/project/entity/enums/ProjectLogicExpressionEnum.java#L17-L28) | ALL/ANY 条件组合 |
| T9 | [`tduck-api/src/main/java/com/tduck/cloud/api/web/controller/UserProjectLogicController.java:27–44`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-api/src/main/java/com/tduck/cloud/api/web/controller/UserProjectLogicController.java#L27-L44) | 条件规则持久化与读取；不是语义决策器 |
| T10 | [`tduck-api/src/main/java/com/tduck/cloud/api/web/controller/UserProjectController.java:179–204`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-api/src/main/java/com/tduck/cloud/api/web/controller/UserProjectController.java#L179-L204) | 发布/停止状态切换；题目就地更新见 328–335 |
| T11 | [`tduck-api/src/main/java/com/tduck/cloud/api/web/controller/UserProjectResultController.java:80–94`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-api/src/main/java/com/tduck/cloud/api/web/controller/UserProjectResultController.java#L80-L94) | 结果提交、设置门禁、保存与通知 |
| T12 | [`tduck-project/src/main/java/com/tduck/cloud/project/service/impl/UserProjectResultServiceImpl.java:63–89`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-project/src/main/java/com/tduck/cloud/project/service/impl/UserProjectResultServiceImpl.java#L63-L89) | Redis 序号、保存；条件构造需独立安全复核 |
| T13 | [`tduck-project/src/main/java/com/tduck/cloud/project/service/impl/UserProjectSettingServiceImpl.java:42–99`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-project/src/main/java/com/tduck/cloud/project/service/impl/UserProjectSettingServiceImpl.java#L42-L99) | 发布/时间/数量/单 IP 与微信限次等收集门禁 |
| T14 | [`tduck-project/src/main/java/com/tduck/cloud/project/service/impl/ProjectDashboardServiceImpl.java:77–133`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-project/src/main/java/com/tduck/cloud/project/service/impl/ProjectDashboardServiceImpl.java#L77-L133) | 单选、多选、下拉统计：遍历结果、按选项累计 |
| T15 | [`tduck-project/src/main/java/com/tduck/cloud/project/entity/ProjectThemeEntity.java:13–48`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-project/src/main/java/com/tduck/cloud/project/entity/ProjectThemeEntity.java#L13-L48) | theme 是外观模板、颜色与图片，不是文本主题聚类 |
| T16 | [`tduck-api/src/main/java/com/tduck/cloud/api/web/interceptor/NoRepeatSubmitInterceptor.java:45–55`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-api/src/main/java/com/tduck/cloud/api/web/interceptor/NoRepeatSubmitInterceptor.java#L45-L55) | 请求体指纹 + 2 秒 Redis 去重；不等同持久幂等 |
| T17 | [`doc/tduck.sql:143–257`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/doc/tduck.sql#L143-L257) | 项目/题目/逻辑/结果/设置表 SQL |
| T18 | [`README.md:70–97`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/README.md#L70-L97) | 前端独立仓库及 Vue2/ElementUI/ECharts 声明 |
| T19 | [`LICENSE:1–141`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/LICENSE#L1-L141) | Apache2.0，第4条再分发及第6条商标边界 |

## 3. 两库共同结论

两库主要提供结构化问卷/表单的业务设计参考；已验证的计数、条件逻辑、通用 AI 建卷聊天，不能作为知研核心创新已经被上游端到端实现的证明。当前证据不足以证明任一库实现“开放题有界主动追问 + 原子全局预算 + 可审计停止 + 跨受访者新维度证据审核”整条研究链，亦不足以宣称该链在所有开源项目中不存在。阶段建议须在当前阶段验收后再实施；本研究文件本身不推进开发阶段。
