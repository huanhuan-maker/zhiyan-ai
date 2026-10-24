# 知研 AI：六个开源仓库源码级技术调研

调研日期：2026-10-23（Asia/Shanghai）。研究对象为用户指定的六个仓库，结论固定到下列分支与 commit。本文件完整承载每库的技术栈、关键目录、数据/算法机制、能力核验、需求差距、许可限制和 M0–M6 参考建议，不要求读者另开专项报告才能理解结论。

本次只读研究，不执行上游程序、不安装上游依赖、不调用上游真实模型，也不复制、集成上游代码、prompt 原文或素材。**“源码已验证”表示实现或控制流已被静态阅读，不表示运行、Windows 兼容性、模型质量或上游测试通过。** 测试文件存在与测试执行成功严格区分。关键证据采用固定 commit 的 GitHub blob 链接；证据 ID 前缀分别为 SK/TD/SJ/DS/OA/BT，不跨库混用。

知研 AI 技术栈保持 **Vue 3 + TypeScript + Vite + Apache ECharts；Spring Boot + MyBatis-Plus；MySQL 8.x**。参考其他语言机制不构成采用该语言服务的授权，尤其 BERTopic 仅作算法机制研究，本次不安装 Python 服务或 Plotly。当前协作中 M1 已获用户授权；M2–M6 建议仅为研究结论，不能绕过每阶段人工验收，也不表示后续阶段已经实施。

## 0. 版本、方法与总体判断

| 仓库 URL | 检查分支 | 固定完整 commit SHA | 取证方式 |
|---|---|---|---|
| [javahuang/SurveyKing](https://github.com/javahuang/SurveyKing) | main | 5de0d05b682ee34244c0b6c07be24eb6358cd8a5 | 本地浅克隆，Git 元数据、清单及核心源码 |
| [tduckboot/tduck-platform](https://github.com/tduckboot/tduck-platform) | master | e397d519b39de53b40104e9288ba88f8182e9912 | GitHub 只读连接器：元数据、分支、完整树及固定 SHA 文件 |
| [surveyjs/surveyjs_vue3_quickstart](https://github.com/surveyjs/surveyjs_vue3_quickstart) | main | 73b58d86bcefac29ed17cef31de5da1b8f1cc116 | 本地浅克隆，Git 元数据、全部业务组件/数据定义 |
| [boyingliu01/dialog-survey](https://github.com/boyingliu01/dialog-survey) | master | 909f0db9cc9263ed6e2ffbb9ba469722de56cb5e | 本地浅克隆，追问/状态/持久化/聚合调用点 |
| [oasis-surveys/oasis-platform](https://github.com/oasis-surveys/oasis-platform) | main | 057305dd04d9d5c42b9f3387b393dcc0a34ee214 | GitHub 只读连接器：元数据、commit、完整树及固定 SHA 文件 |
| [MaartenGr/BERTopic](https://github.com/MaartenGr/BERTopic) | master | 9036123c97aaa9a6cc4bec4a6db1a7caf9209df6 | 同上，主题建模入口、算法实现与测试源码 |

三个本地检出副本读取时工作树干净，分支/SHA/remote 经 Git 核对，位于 D:/LcProject/.local/research/。另外三库直连 GitHub:443 克隆失败后，使用已连接的 GitHub 只读工具取得真实源码，不把网络失败写成“没有代码”，不虚构本地 clone 或运行日志。分支名称说明取证时状态；未来变化不影响固定 SHA 证据定位。

**状态口径：**“源码已验证”对应实现；“仅 README/文档声称”尚未沿实现确认；“尚未验证/已读范围未发现”表示证据边界。未找到调用点不证明其他分支、独立前端库、插件、商业版或部署环境绝无该能力。未对远端部署做漏洞验证或线上业务操作。

| 仓库 | 开放题动态追问 | 全问卷幂等预算 | 停止策略 | 跨受访者语义主题 | 最相关参考 |
|---|---|---|---|---|---|
| SurveyKing | 建卷聊天已验证，受访者语义追问未验证（SK7/SK10/SK11） | 已读范围未发现（SK4/SK12） | 暂停/截止/回收数门禁，非语义 SKIP（SK7） | 计数有实现，主题证据链未验证（SK9） | M0/M1/M2 职责分层 |
| tduck-platform | 预设条件 CRUD，语义追问未验证（TD7–TD9） | 回收量/短时去重非追问预算（TD13/TD16） | 收集状态、时段、数量（TD10/TD13） | 选项统计；theme 为外观（TD14/TD15） | M1 题目与结果模型 |
| SurveyJS quickstart | 预置 visibleIf；未发现自有 LLM 追问路径（SJ3/SJ4） | 已读模板未发现 | 有限题页；语义停止未验证 | 仪表盘读两个内置样本（SJ5） | Vue3 声明式渲染 |
| Dialog Survey | 模型 FOLLOWUP/NEXT/END 已接线（DS4/DS5） | 每题计数，NEXT 清零（DS3/DS5） | 上限/末题/END，部分意图仅 prompt（DS5/DS6） | 有 helper，API 仍 PENDING，闭环未验证（DS9–DS11） | M3 动作执行器 |
| OASIS | 回答相关的预设 probe 选择；结构化路径禁额外 probe（OA4/OA6） | 题内计数/提示；全卷持久账本未验证（OA5/OA7） | 收尾指导和时间超时；语义增益未验证（OA8/OA10） | RAG/会话 analytics 非答案聚类（OA12） | M3 单问守卫/审计 |
| BERTopic | 文档建模库，非访谈控制器（BT1/BT3） | 未验证问卷预算模块 | 未验证受访者停止路径 | 通用文档聚类已验证（BT3–BT8），非完整问卷治理 | M4/M6 主题机制 |

**当前证据不支持任何一个仓库已完整实现知研 AI 的“固定核心问卷 + 开放题语义主动探索 + 原子全卷预算 + 可审计停止 + 来源可靠的人次级新维度发现”组合。** 这不证明开源范围不存在相关工作，也不能据此宣称独占创新；仍须用同预算对照、原文证据和人工评估验证。

许可速览：SurveyKing、BERTopic 的 LICENSE 原文为 MIT；tduck 为 Apache-2.0；OASIS 为 AGPL-3.0。Dialog 仅 README 声明 MIT，缺授权正文；SurveyJS quickstart 自身授权未确认，依赖条款各异。公开可读不等于可任意复制，限制见各库章节。

## 1. SurveyKing

- 仓库：[javahuang/SurveyKing](https://github.com/javahuang/SurveyKing)
- 本地静态阅读副本：`D:/LcProject/.local/research/SurveyKing`。
- 分支：`main`；commit：`5de0d05b682ee34244c0b6c07be24eb6358cd8a5`。
- 使用 `git branch --show-current`、`git rev-parse HEAD`、`git remote -v`、`git status --porcelain` 核对；阅读副本工作树干净，为浅克隆。结论仅对应此 commit，不推断历史版本。
- 阅读范围：父/子 Maven 清单、核心实体与 schema、项目/公开填答/答卷/报表服务、全部 AI 模块文件目录与关键实现、数据库初始化器、许可证。Java 源文件内检索 followup/probe/budget/openai/llm/topic/cluster 及中文追问/预算/聚类，逐一阅读有关命中；排除巨大压缩静态资源参与负面结论。

### 1.1 技术栈与核心目录（来源分层）

| 层 | 实际观察与验证状态 |
|---|---|
| 服务端 | **源码已验证** Spring Boot 2.7.7、Java 8、Spring Security、MyBatis-Plus 3.5.0；父 POM 锁定，rdbms 模块实际引 Starter、服务通过 MP ServiceImpl/Wrapper 读写（SK1/SK2/SK6/SK8）。 |
| 数据库 | **源码已验证** MySQL Connector 8.0.26，初始化器提供 MySQL/H2 分支（SK2/SK13）。此处证明代码路径，未连库验证；不能把其 H2 快速启动方案用于知研 AI 的 MySQL 验收。 |
| AI | **源码已验证** Spring WebFlux WebClient 访问 OpenAI 兼容 chat completions，系统配置管理 endpoint/key/models，响应 Flux 流式输出（SK10）；这不是 Python 或 Node 服务端。 |
| 业务前端 | **README 声称** React、Ant Design（SK15）；**编译产物佐证**静态 Umi bundle 包含 React hooks 与业务路由（SK16）。`client/` 在该 commit 仅 README todo（SK14）；因此原始前端 package/组件目录、精确 React/AntD 版本、图表库和重新构建能力**尚未验证**。 |
| 文档站 | `website/` 是单独文档站；其中 React 依赖不能当作业务前端 package 的证据。 |

核心目录：`server/api` 是 HTTP 接口与资源装配；`server/shared` 是 DTO/schema/安全与通用契约；`server/rdbms` 是实体、Mapper、业务服务；`server/ai` 是 AI 建卷聊天适配；`server/flow` 等虽在目录中，父 Maven 模块未启用，不能仅凭目录认定当前运行链已启用（SK1）。

### 1.2 可参考的业务模型与机制

**源码已验证**：`Project` 将问卷 schema 和 setting 通过 JacksonTypeHandler 存储，`SurveySchema` 以稳定 id、题型、递归 children 与 attribute 表示问题树；attribute 有显示、必填、跳转、终止、计算规则字段（SK3/SK5/SK19）。这是“问卷结构与渲染规则”的参考，而非 AI 生成问题的证据。

`Answer` 独立存项目关联、临时与最终答案、问卷 schema 和元信息；公开保存服务有事务边界，答卷服务区分更新与新增（SK4/SK7/SK8）。可借鉴“原始业务对象与答卷生命周期分开”，但已有 schema 字段不自动证明每次发布都创建不可变版本。项目更新实现仍可更新原项目与状态（SK6）；**没有在已读链路验证知研要求的 survey_version 冻结协议**。

`ReportServiceImpl` 实际从 AnswerMapper 按项目查询答卷，然后在服务端解析答案做计数、数值最小/最大/均值、每日回收统计（SK9）。可参考后端确定性统计的分层；该方法未呈现问卷版本过滤、逐题有效分母/缺失排除契约，查询本身也未见 tempSave 完成状态过滤，不能未经测试直接作为知研统计口径。

AI 方面，默认 prompt 要求生成问卷/考试及题型标记文本（SK11），不是严格 JSON Schema 草稿；聊天历史仅取最后10条、缓存会话10分钟（SK10/SK12）。可参考 Provider 的系统配置、流式用户反馈与错误事件；知研仍须独立实现结构校验、人工确认、模型身份记录和失败降级。响应明文日志见 SK10:201/225，故隐私记录设计不能照搬。

### 1.3 创新能力逐项核验

| 需求 | 判定 | 可核查的边界 |
|---|---|---|
| 基于当前开放回答动态生成澄清/深化/探索追问 | **已读范围未发现对应实现；不可认定已支持** | SK10/SK11 的 AI 主链是创建者建卷/考试聊天；SK7/SK8 的受访答卷保存未看到调用 AI 决策。通用聊天接口不是受访者追问状态机。 |
| 全问卷追问预算与幂等扣减 | **已读范围未发现** | SK10 的“最后10条历史”是上下文截断；SK12 的10分钟是缓存失效。两者均不是每题/全卷追问额度，更未证明并发重试不重复扣。 |
| 停止策略 | **收集门禁已验证；语义停止尚未验证** | SK20 的 validateProject（591–636）检查暂停、总回收数、截止时间及填答限制；SK5 有 finishRule 字段；SK10 有网络超时/错误终止。均不等于信息充足/诱导风险/负担评估后的 SKIP。 |
| 跨受访者主题聚合、新维度与证据归因 | **已读范围未发现** | SK9 是统计计数，不是文本聚类；没有在已读实体与 AI 流程见带来源类别的 theme_evidence 或人工主题复核链。 |
| README AI 宣称 | **部分已源码佐证** | README 的 AI 辅助创建、OpenAI 兼容和流式生成有 SK10/SK11 佐证；不能外推为上述核心创新。 |

### 1.4 与知研 AI 的差距及许可证

后端框架方向相近，但 Java8/Boot2/旧 MP Starter 版本不能直接替换本项目已锁定的 Java17+/Boot3 对应依赖；React 业务前端违反老师栈且此快照缺可读原始组件。知研必须独立补齐固定发布版本、匿名会话权限、持久幂等、AI自愿参与、追问独立表、语义动作/理由/全局预算、真实证据主题审核、有效分母与四组实验。不能把该系统已有考试/工作流/微信功能扩张为本项目当前阶段任务。

**LICENSE 已验证为 MIT（SK17）**：允许使用、修改与分发，包括商业使用；若以后复用实质部分，应随复制保留原版权与许可文本。MIT 无担保，不等于第三方依赖、商标、图片或外部 API 皆无限制。当前只借鉴设计，不引入源码；本报告不为缺失前端源文件或商业产品额外授予权利。

### 1.5 M0–M6 参考建议（建议不构成实施授权）

| 阶段 | 建议 |
|---|---|
| M0 | 参考 api/shared/rdbms 的职责拆分与真实 Mapper 链；保持单体最小实现，使用本项目 MySQL8 与锁定版本，不引入 H2 或 React；不需照搬多模块。 |
| M1 | 借鉴 schema/项目/答卷解耦、暂存/完成状态与公共提交服务；新增明确冻结版本、会话 token 隔离和数据库唯一幂等约束。 |
| M2 | 参考可配置 OpenAI 兼容 Provider 与流式输出；独立改为严格 JSON Schema、校验后草稿入库、人工审核发布，不复用标记文本 prompt 当合格协议。 |
| M3 | 自研四动作决策、同意/跳过/隐私硬约束与事务预算；不能将通用聊天历史长度或超时当全局追问预算。 |
| M4 | 自研匿名证据定位、来源四分类、跨人去重与审核流水；SK9 只作为基础统计参照。 |
| M5 | 借鉴服务端统计层，新增版本/完成状态/缺失/有效分母字段；Vue3 ECharts 读取确定性接口，报告解释与事实分开。 |
| M6 | 以其可说明的固定问卷闭环作为能力对照背景；不宣称运行实验或优于竞品。自建同预算 A/B/C/D、种子/模型/成本与独立标注记录。 |

### 1.6 固定 commit 证据目录

| ID | 源码证据（仓库相对路径及行） | 阅读所得 |
|---|---|---|
| SK1 | [`server/pom.xml:6–28`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/pom.xml#L6-L28) | 模块与 Spring Boot 2.7.7、Java 8；MyBatis-Plus 依赖版本见 89–93 |
| SK2 | [`server/rdbms/pom.xml:38–48`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/rdbms/pom.xml#L38-L48) | MyBatis-Plus Starter 和 MySQL Connector 8.0.26 |
| SK3 | [`server/rdbms/src/main/java/cn/surveyking/server/domain/model/Project.java:21–45`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/rdbms/src/main/java/cn/surveyking/server/domain/model/Project.java#L21-L45) | t_project、survey JSON、setting JSON、发布 status |
| SK4 | [`server/rdbms/src/main/java/cn/surveyking/server/domain/model/Answer.java:21–68`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/rdbms/src/main/java/cn/surveyking/server/domain/model/Answer.java#L21-L68) | t_answer、projectId、tempAnswer、answer、survey、tempSave |
| SK5 | [`server/shared/src/main/java/cn/surveyking/server/domain/dto/SurveySchema.java:21–45`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/shared/src/main/java/cn/surveyking/server/domain/dto/SurveySchema.java#L21-L45) | 递归题目 schema；条件规则见 237–277 |
| SK6 | [`server/rdbms/src/main/java/cn/surveyking/server/impl/ProjectServiceImpl.java:90–145`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/rdbms/src/main/java/cn/surveyking/server/impl/ProjectServiceImpl.java#L90-L145) | 创建所有者、项目更新与状态更新 |
| SK7 | [`server/rdbms/src/main/java/cn/surveyking/server/impl/SurveyServiceImpl.java:253–307`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/rdbms/src/main/java/cn/surveyking/server/impl/SurveyServiceImpl.java#L253-L307) | 事务性公开答卷保存；全卷收集门禁见 591–636 |
| SK8 | [`server/rdbms/src/main/java/cn/surveyking/server/impl/AnswerServiceImpl.java:216–233`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/rdbms/src/main/java/cn/surveyking/server/impl/AnswerServiceImpl.java#L216-L233) | 按已有 ID 更新，否则 Mapper Service 保存新答卷 |
| SK9 | [`server/rdbms/src/main/java/cn/surveyking/server/impl/ReportServiceImpl.java:33–96`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/rdbms/src/main/java/cn/surveyking/server/impl/ReportServiceImpl.java#L33-L96) | 按项目读真实答卷，递归计数/数值统计/每日回收 |
| SK10 | [`server/ai/src/main/java/cn/surveyking/server/ai/service/impl/OpenAiCompatibleChatServiceImpl.java:127–241`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/ai/src/main/java/cn/surveyking/server/ai/service/impl/OpenAiCompatibleChatServiceImpl.java#L127-L241) | 可配置模型、建卷提示、最后 10 条历史、流式调用、超时与错误事件 |
| SK11 | [`server/ai/src/main/resources/prompt/openai-compatible.md:1–26`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/ai/src/main/resources/prompt/openai-compatible.md#L1-L26) | 问卷/考试生成格式提示，而非受访者追问决策 |
| SK12 | [`server/ai/src/main/java/cn/surveyking/server/ai/service/ConversationCacheService.java:17–80`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/ai/src/main/java/cn/surveyking/server/ai/service/ConversationCacheService.java#L17-L80) | 内存对话缓存，10 分钟过期 |
| SK13 | [`server/shared/src/main/java/cn/surveyking/server/core/uitls/DatabaseInitHelper.java:55–70`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/shared/src/main/java/cn/surveyking/server/core/uitls/DatabaseInitHelper.java#L55-L70) | 实际 MySQL/H2 选择分支 |
| SK14 | [`client/README.md:1–4`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/client/README.md#L1-L4) | client 只有 todo，缺业务前端依赖清单与可读源码 |
| SK15 | [`README.zh-CN.md:156–162`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/README.zh-CN.md#L156-L162) | React/Ant Design 等技术栈声明（README 证据） |
| SK16 | [`server/api/src/main/resources/static/umi.cc68a383.js:1–1`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/api/src/main/resources/static/umi.cc68a383.js#L1-L1) | 编译 bundle 可见 React/React hooks/Umi 路由；不能代替前端原始源码 |
| SK17 | [`LICENSE:1–21`](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/LICENSE#L1-L21) | MIT 原文、版权与许可保留条件 |
| SK18 | [server/pom.xml:89–93](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/pom.xml#L89-L93) | MyBatis-Plus 3.5.0 直接依赖版本证据 |
| SK19 | [server/shared/src/main/java/cn/surveyking/server/domain/dto/SurveySchema.java:237–277](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/shared/src/main/java/cn/surveyking/server/domain/dto/SurveySchema.java#L237-L277) | finish/visible/required/jump 等预设规则字段 |
| SK20 | [server/rdbms/src/main/java/cn/surveyking/server/impl/SurveyServiceImpl.java:591–636](https://github.com/javahuang/SurveyKing/blob/5de0d05b682ee34244c0b6c07be24eb6358cd8a5/server/rdbms/src/main/java/cn/surveyking/server/impl/SurveyServiceImpl.java#L591-L636) | 收集暂停、最大答卷数、截止和填答门禁 |

## 2. tduck-platform

- 指定仓库：[tduckboot/tduck-platform](https://github.com/tduckboot/tduck-platform)；不是自行替换为 README 所链接 TDuckCloud 的最新仓库。
- 分支：`master`；commit：`e397d519b39de53b40104e9288ba88f8182e9912`。
- 本地 git clone/ls-remote 直连 GitHub:443 失败；改用已连接的 GitHub 工具只读获取仓库元数据、branch/master、完整 recursive tree（`truncated=false`），并按上面固定 SHA 获取关键文件。**未创建可运行本地 clone，未运行其代码**。
- SHA 与分支证据：[分支 API](https://api.github.com/repos/tduckboot/tduck-platform/branches/master)；完整文件清单可复查：[固定树 API](https://api.github.com/repos/tduckboot/tduck-platform/git/trees/e397d519b39de53b40104e9288ba88f8182e9912?recursive=1)。分支端点会变化，报告正文以 SHA 为准。
- 本报告实际阅读根及 common/project 的 POM、核心实体、项目/答卷/条件控制器、结果/设置/统计服务、去重拦截器、SQL、配置与 LICENSE。未把整个 tree 路径清单当作全源码逐文件审计。

### 2.1 技术栈与核心目录

| 层 | 实际观察与验证状态 |
|---|---|
| 服务端 | **源码已验证** Java8、Spring Boot2.3.5.RELEASE、MyBatis-Plus3.4.3；业务服务实际继承 MP ServiceImpl，用 Wrapper 查询与 save 入库（TD1/TD2/TD12）。 |
| 数据库与缓存 | **源码已验证** MySQL JDBC、MySQL JSON列/处理器、Redis 依赖与连接配置（TD2/TD3/TD17）；保存答卷需 Redis 递增流水号（TD12）。MySQL5.7+ 是 README 最低要求，不能据此声称 MySQL8 已运行通过。 |
| 前端 | **仅 README 声称** Vue2、ElementUI、ECharts、Axios（TD18）。指定仓库完整树无 package.json/.vue，README 指向另一个前端仓库；本次没有扩大到该独立仓库，故 Vue2/ECharts 具体版本及实际页面执行**未验证**，不能报成 Vue3 项目。 |
| 辅助组件 | POM 验证 Hutool/Guava/Lombok、微信与对象存储模块；本项目当前最小工程无需引入这些外部依赖（TD1）。 |

目录职责：`tduck-api` 承载公开/发起者接口；`tduck-project` 包含项目、题目、条件、答卷、设置、统计；`tduck-account` 账号；`tduck-common` 提供通用校验/工具/Mapper支持；`tduck-storage` 文件存储；`tduck-wx-mp` 微信；`doc/` 有 SQL。关键文件见证据表 TD1–TD19。

### 2.2 可参考业务模型和算法机制

**源码已验证**：项目以公开 key、发起者 userId、status 表达生命周期（TD4）；题目独立记录 formItemId/type/label/required/sort，题型扩展配置为 JSON expand（TD5）。结果分 originalData/processData，并带完成时间与提交元数据（TD6）。可借鉴“稳定题目标识 + 类型化扩展 + 原始结果和展示结果区分”。但是 processData 不能代替知研追问独立记录与证据片段定位；IP、地区、微信信息也不应默认照搬到匿名研究中。

条件逻辑包含目标 formItemId、条件列表、ALL/ANY 组合，接口可保存和查询，服务是常规 CRUD（TD7/TD8/TD9）。**这证明预先配置的条件规则存储，不证明运行时 LLM 追问，更不能因名称 Logic 就认定实现自适应语义决策**；前端执行器位于未调研的独立仓库，因此条件规则最终渲染行为未运行验证。

发布方法只检查有题目后更新 RELEASE，停止更新 STOP；题目更新按项目/题ID就地写入（TD10）。已读数据模型没有独立 survey_version 关联，发布方法没有建不可变快照操作；知研不能把此发布控制直接当固定版本保证。

结果创建先检查收集设置，再保存并异步通知（TD11/TD12）；TD13 有开始/结束时间、总量、IP/微信限次。去重拦截器用请求体指纹与2秒 Redis 键（TD16），是短时重复请求控制，**不是持久会话提交幂等**，不能满足刷新重试永不重复计数或预算永不重复扣减。

统计服务枚举单选、多选、下拉，将选项初始化为0，遍历 processData 逐项累加，返回题名和统计数组（TD14）。这是跨答卷确定性选项计数，并非跨受访者语义主题发现；统计方法未提供知研要求的分母/缺失/版本元信息。基于标签/逗号切分的显示值统计也不能代替稳定 optionId 的可靠聚合。

### 2.3 创新能力逐项核验

| 需求 | 判定 | 可核查边界 |
|---|---|---|
| 开放回答语义动态追问 | **已读范围未发现；未验证支持** | TD7–TD9 是人工配置条件 CRUD；TD11/TD12 是答卷保存；已读核心路径没有 LLM 调用与 CLARIFY/DEEPEN/EXPLORE 追问决策。 |
| 全问卷预算 | **已读范围未发现** | TD13 的数量是全调查回收数，TD16 是2秒请求重复控制，均不是受访者全卷追问次数预算。 |
| 停止策略 | **问卷收集停止已验证；信息价值停止未验证** | TD10/TD13 支持 STOP、日期/总回收数和填答限次；未见信息充分、受访者拒绝 AI、信息增益等停止判据。 |
| 跨受访者主题聚合 | **选项计数已验证；开放题主题机制未验证** | TD14 只处理选项频数；TD15 的 ProjectTheme 是颜色/头图/样式模板，不能把 theme 命名当语义主题证据。 |
| 其他版/付费版能力 | **尚未验证** | 不推断同组织其他仓库、在线 SaaS 或商业产品能力，也不把未知写成没有。 |

### 2.4 与知研 AI 的差距、风险与许可

它可作为传统问卷生命周期/可配置表单的设计参考，后端技术类型接近，但依赖时代较旧，前端声明为 Vue2，Redis 为实际保存链依赖。不能通过改用 Vue2 或额外 Node 服务来适配本项目，更没有必要在 M0 为参考项目引入 Redis/微信/OSS。

知研仍需冻结版本、匿名会话级权限与幂等、后端答案 schema 校验、AI同意与降级、预算事务化、独立追问证据、新维度审核、统计分母和实验事件。已读部分控制器与服务的权限边界仍需完整全链路验证；带 @Login 并不证明所有权校验充分，不在此报告把静态疑点宣称为已复现漏洞。TD12 的动态查询条件构造及 TD16 的请求体日志也不适合未经参数化/脱敏复核就移植。本研究未对任何远端部署做漏洞测试。

**LICENSE 原文已验证为 Apache License2.0（TD19）**，不是仅依据 README 或项目品牌判断。将来若复用代码再分发，应附许可、保留相关版权/归属、标明修改，若上游分发包含 NOTICE 须依条款保留归属；许可证有专利授予及其终止条件，不授予商标使用权，无担保。该许可结论仅针对指定 SHA 中所见 LICENSE，不能自动覆盖外部前端仓库、依赖、图片和商业扩展。本次不复制/集成。

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
| TD1 | [`pom.xml:12–45`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/pom.xml#L12-L45) | Java8、SpringBoot2.3.5.RELEASE、MP3.4.3 与六个模块 |
| TD2 | [`tduck-common/pom.xml:24–42`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-common/pom.xml#L24-L42) | Redis、MySQL Connector、MyBatis-Plus Starter |
| TD3 | [`tduck-api/src/main/resources/application-dev.yml:1–19`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-api/src/main/resources/application-dev.yml#L1-L19) | MySQL JDBC 和 Redis 连接；凭据不在报告重现 |
| TD4 | [`tduck-project/src/main/java/com/tduck/cloud/project/entity/UserProjectEntity.java:22–72`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-project/src/main/java/com/tduck/cloud/project/entity/UserProjectEntity.java#L22-L72) | 项目 key、userId、发布状态 |
| TD5 | [`tduck-project/src/main/java/com/tduck/cloud/project/entity/UserProjectItemEntity.java:25–96`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-project/src/main/java/com/tduck/cloud/project/entity/UserProjectItemEntity.java#L25-L96) | 独立题目、formItemId、type、required、sort、expand |
| TD6 | [`tduck-project/src/main/java/com/tduck/cloud/project/entity/UserProjectResultEntity.java:23–98`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-project/src/main/java/com/tduck/cloud/project/entity/UserProjectResultEntity.java#L23-L98) | 原始/处理答案 JSON 与客户端元数据 |
| TD7 | [`tduck-project/src/main/java/com/tduck/cloud/project/entity/UserProjectLogicEntity.java:20–63`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-project/src/main/java/com/tduck/cloud/project/entity/UserProjectLogicEntity.java#L20-L63) | 预设条件集合与目标题目结构 |
| TD8 | [`tduck-project/src/main/java/com/tduck/cloud/project/entity/enums/ProjectLogicExpressionEnum.java:17–28`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-project/src/main/java/com/tduck/cloud/project/entity/enums/ProjectLogicExpressionEnum.java#L17-L28) | ALL/ANY 条件组合 |
| TD9 | [`tduck-api/src/main/java/com/tduck/cloud/api/web/controller/UserProjectLogicController.java:27–44`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-api/src/main/java/com/tduck/cloud/api/web/controller/UserProjectLogicController.java#L27-L44) | 条件规则持久化与读取；不是语义决策器 |
| TD10 | [`tduck-api/src/main/java/com/tduck/cloud/api/web/controller/UserProjectController.java:179–204`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-api/src/main/java/com/tduck/cloud/api/web/controller/UserProjectController.java#L179-L204) | 发布/停止状态切换；题目就地更新见 328–335 |
| TD11 | [`tduck-api/src/main/java/com/tduck/cloud/api/web/controller/UserProjectResultController.java:80–94`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-api/src/main/java/com/tduck/cloud/api/web/controller/UserProjectResultController.java#L80-L94) | 结果提交、设置门禁、保存与通知 |
| TD12 | [`tduck-project/src/main/java/com/tduck/cloud/project/service/impl/UserProjectResultServiceImpl.java:63–89`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-project/src/main/java/com/tduck/cloud/project/service/impl/UserProjectResultServiceImpl.java#L63-L89) | Redis 序号、保存；条件构造需独立安全复核 |
| TD13 | [`tduck-project/src/main/java/com/tduck/cloud/project/service/impl/UserProjectSettingServiceImpl.java:42–99`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-project/src/main/java/com/tduck/cloud/project/service/impl/UserProjectSettingServiceImpl.java#L42-L99) | 发布/时间/数量/单 IP 与微信限次等收集门禁 |
| TD14 | [`tduck-project/src/main/java/com/tduck/cloud/project/service/impl/ProjectDashboardServiceImpl.java:77–133`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-project/src/main/java/com/tduck/cloud/project/service/impl/ProjectDashboardServiceImpl.java#L77-L133) | 单选、多选、下拉统计：遍历结果、按选项累计 |
| TD15 | [`tduck-project/src/main/java/com/tduck/cloud/project/entity/ProjectThemeEntity.java:13–48`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-project/src/main/java/com/tduck/cloud/project/entity/ProjectThemeEntity.java#L13-L48) | theme 是外观模板、颜色与图片，不是文本主题聚类 |
| TD16 | [`tduck-api/src/main/java/com/tduck/cloud/api/web/interceptor/NoRepeatSubmitInterceptor.java:45–55`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-api/src/main/java/com/tduck/cloud/api/web/interceptor/NoRepeatSubmitInterceptor.java#L45-L55) | 请求体指纹 + 2 秒 Redis 去重；不等同持久幂等 |
| TD17 | [`doc/tduck.sql:143–257`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/doc/tduck.sql#L143-L257) | 项目/题目/逻辑/结果/设置表 SQL |
| TD18 | [`README.md:70–97`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/README.md#L70-L97) | 前端独立仓库及 Vue2/ElementUI/ECharts 声明 |
| TD19 | [`LICENSE:1–141`](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/LICENSE#L1-L141) | Apache2.0，第4条再分发及第6条商标边界 |
| TD20 | [tduck-api/src/main/java/com/tduck/cloud/api/web/controller/UserProjectController.java:328–335](https://github.com/tduckboot/tduck-platform/blob/e397d519b39de53b40104e9288ba88f8182e9912/tduck-api/src/main/java/com/tduck/cloud/api/web/controller/UserProjectController.java#L328-L335) | 题目更新写当前项目/题目，不是创建发布快照 |

## 3. SurveyJS Vue 3 Quickstart

仓库：[surveyjs/surveyjs_vue3_quickstart](https://github.com/surveyjs/surveyjs_vue3_quickstart)；分支 main；commit 73b58d86bcefac29ed17cef31de5da1b8f1cc116。本地 D:/LcProject/.local/research/surveyjs_vue3_quickstart；Git 分支/SHA/remote 已核对，工作树干净。

### 3.1 实际技术栈、目录和职责

**已验证（源码）**：Vue 3 + Vue Router 4 + TypeScript + Vite；`package.json` 声明 Vue `^3.3.4`、Vite `^4.4.11`、TypeScript `~5.0.4`，SurveyJS 六个包声明 `latest`。锁文件的 SurveyJS 包为 `2.0.0`，因此须区分依赖声明范围与锁定解析值，不能写成固定使用“当前最新版”。组件包含 Survey Form、Creator、Analytics、PDF；没有采用 ECharts（SJ1、SJ6）。

- `src/main.ts`：注册 SurveyJS 表单和 Creator Vue 插件。
- `src/router/index.ts`：主页、表单、建卷器、PDF、图表和表格演示路由。
- `src/components/Survey.vue` / `Creator.vue`：用同一个本地 JSON 分别构造 `Model` 和 `SurveyCreatorModel`。
- `data/survey_json.js`：声明式问卷；`data/dashboard_data.js`：另一份问卷定义及两个内置答卷。
- `Dashboard.vue` / `DashboardTabulator.vue`：SurveyJS Analytics 图表/表格；不是 ECharts，不是 MySQL 统计链。
- `PDFGenerator.vue`：客户端 PDF 保存示例。

完整仓库文件清单及对 `src`、`data` 的 `fetch|axios|localStorage|onComplete|saveSurvey|budget|followup|openai` 检索，加上所有业务组件直接阅读，未找到该 quickstart 自有的 REST 服务、数据库 Mapper、完成后保存回调、LLM Provider 或预算模块。此结论限定为该固定提交的模板自身，不外推 SurveyJS 整个产品或扩展库。

### 3.2 可参考的业务与数据结构

**已验证（源码）**：`pages → elements` 的声明式题目组织，将稳定 `name` 与显示 `title` 分离；`choices` 可区分 `value/text`；已有 `radiogroup`、`checkbox`、`rating`、`comment`、`matrix` 等题型示例。`visibleIf` 例如 `{satisfaction} > 3` 为预置条件显隐，供知研 AI 理解“固定问卷条件逻辑”的边界（SJ4）。底层表达式求值实现位于外部 `survey-core`，本次没有审计其内部算法。

可借鉴“定义与答卷分离”“题目稳定标识”“编辑/预览使用相同定义”的产品设计。知研 AI 仍应自行定义受控的四题型 DTO、发布版本与答案表，由 Spring Boot 校验并通过 MyBatis-Plus 持久化。不要直接引入这一模板作为真实数据库交付。

### 3.3 四项核心机制核验

| 核心问题 | 结论及边界 |
|---|---|
| 动态追问 | **已验证的是预置条件题显隐**，不是对开放回答进行语义分析并新生成追问。该模板内没有发现自有生成式追问路径；不能把 SurveyJS 的“动态面板/条件题”等产品概念等同于知研 AI 的 CLARIFY/DEEPEN/EXPLORE。 |
| 追问预算 | 检查全部模板业务组件与数据定义后，未见追问计数、全卷剩余额度、幂等扣减或预算事件。外部库是否有其他配额能力尚未验证。 |
| 停止策略 | JSON 为有限页和题，普通完成流程由外部库负责；没有证据证明模板实现语义停止、拒绝 AI、低信息增益停止或故障降级。 |
| 跨受访者主题聚合 | 实际仪表盘输入为两个本地常量答卷（SJ5）。没有发现本模板主题抽取/嵌入/聚类/证据表；SurveyJS Analytics 的整体功能范围未做外部源码审计。 |

### 3.4 与知研 AI 的差距和许可证

README L3 说 SurveyJS 组件允许把问卷存数据库，是组件用途概述；**该 quickstart 已实现真实数据库提交**不能由此推出。源码目前是展示集成方式的前端样例，缺少知研 AI 必须的 Spring Boot/MyBatis-Plus/MySQL、所有权、不可变发布版本、提交幂等、全局预算、主题来源分类、引用校验及 ECharts 真实统计。它适合参考渲染器与 JSON 定义的分工，不是后端基础工程或核心创新实现。

许可证必须分层：

1. **模板自身**：固定提交 `git ls-tree -r --name-only HEAD` 未见 `LICENSE/COPYING/NOTICE` 文件；README 未声明授权条款、`package.json` 无 license 字段。当前不能确认模板代码获得 MIT 复用授权，公开可读不等于任意复用。
2. **依赖元数据已验证**（SJ6）：`survey-core`、`survey-vue3-ui` 的锁文件 license 为 `MIT`；Creator 两个包指向 `https://surveyjs.io/Licenses#SurveyCreator`；Analytics、PDF 为 `SEE LICENSE IN LICENSE`。不能把整个 SurveyJS 套件写为 MIT。
3. **完整许可条款尚未验证**：本次没有取得各依赖发行包的完整许可证、商业/教育授权范围和再分发条款。尝试 `git ls-remote` 读取外部 SurveyJS 仓库失败（GitHub 443 连接失败），没有将失败写成查证成功。若未来考虑复用，应先固定发行版本、审阅其 LICENSE 与官方授权；本次只做设计研究，无代码复制。

### 3.5 M0–M6参考建议

| 阶段 | 参考建议与知研 AI 边界 |
|---|---|
| M0 工程 | 参考 Vue/Router 组件分工；不要照搬 latest 依赖或演示数据当真实链；本阶段仍需：固定兼容版本，Spring Boot + MyBatis-Plus 真 MySQL 集成测试、ECharts 联通及 Windows PowerShell 命令 |
| M1 固定问卷 | 参考 stable name/value 与展示 title/text、定义/答卷分离；四题型先行；本阶段仍需：数据库发布快照、真实匿名会话、提交幂等、所有权与 SQL 统计；核心题原文冻结 |
| M2 AI 设计 | JSON 问卷结构可作为设计对比对象，不复制 Creator 或引入未知许可证组件；本阶段仍需：Java 服务端 JSON Schema/题型/重复/诱导校验，人工审核，明确 Mock/model，无 Key 所有入口可用 |
| M3 单人探索 | `visibleIf` 作为固定条件分支对照，不当作语义追问；本阶段仍需：实现 CLARIFY/DEEPEN/EXPLORE/SKIP；全卷预算与唯一扣减；明确拒绝/跳过、隐私/诱导硬门槛、决策证据日志 |
| M4 跨人新维度 | 本模板无可确认的语义聚合实现；本阶段仍需：批处理闭环、四类来源、存在性和偏移校验、按受访者去重、人工复核、发布题不回写 |
| M5 可信统计 | 参考问卷/表格展示分工；不使用 SurveyJS Analytics 替换 ECharts；本阶段仍需：Spring Boot/MyBatis-Plus 计算有效分母、缺失和版本；ECharts 接真实 API；数字/AI 解释/假设分层 |
| M6 实验 | 可作固定条件问卷产品设计对照，不能称 AI 基线；本阶段仍需：用本项目实现 A–D 策略、同预算、盲评、来源准确率/新增语义单元/退出负担/成本；记录模型种子版本与真实运行日志 |

### 3.6 固定 commit 证据目录

| 编号 | 固定提交证据文件及行号 | 所证明的内容 |
|---|---|---|
| SJ1 | [package.json L6–41](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/package.json#L6-L41) | Vite/Vue/TS、SurveyJS 依赖和 `latest` 声明 |
| SJ2 | [src/main.ts L1–13](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/src/main.ts#L1-L13)、[src/router/index.ts L3–19](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/src/router/index.ts#L3-L19) | Vue 插件、六个演示路由 |
| SJ3 | [src/components/Survey.vue L1–10](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/src/components/Survey.vue#L1-L10)、[Creator.vue L1–14](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/src/components/Creator.vue#L1-L14) | 本地 JSON 初始化渲染器/编辑器 |
| SJ4 | [data/survey_json.js L1–95](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/data/survey_json.js#L1-L95) | pages/elements 结构、题型及 `visibleIf` 条件 |
| SJ5 | [Dashboard.vue L9–26](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/src/components/Dashboard.vue#L9-L26)、[DashboardTabulator.vue L9–29](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/src/components/DashboardTabulator.vue#L9-L29)、[data/dashboard_data.js L228–269](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/data/dashboard_data.js#L228-L269) | 仪表盘直接使用两个内置样本，非后端统计 |
| SJ6 | [package-lock.json L3045–3118](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/package-lock.json#L3045-L3118) | 锁文件中各 SurveyJS 组件为 2.0.0，许可证元数据不同 |
| SJ7 | [README.md L1–8](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/README.md#L1-L8)、[PDFGenerator.vue L13–22](https://github.com/surveyjs/surveyjs_vue3_quickstart/blob/73b58d86bcefac29ed17cef31de5da1b8f1cc116/src/components/PDFGenerator.vue#L13-L22) | README 的数据库概述与客户端 PDF 示例范围 |

## 4. Dialog Survey

仓库：[boyingliu01/dialog-survey](https://github.com/boyingliu01/dialog-survey)；分支 master；commit 909f0db9cc9263ed6e2ffbb9ba469722de56cb5e。本地 D:/LcProject/.local/research/dialog-survey；Git 分支/SHA/remote 已核对，工作树干净。

### 4.1 实际技术栈、目录和职责

**已验证（源码）**：TypeScript/ESM + Node.js `>=20.19.0`、Fastify 5、Prisma 7.10.0 + PostgreSQL、Zod、Nunjucks 服务端模板、HTMX/Alpine 静态脚本、钉钉 Stream/消息接口、OpenAI 兼容 LLM。测试依赖为 Vitest/PGlite，另有 Stryker、Playwright（DS1、DS2；前端脚本可从仓库 `public/js/` 和 `src/views/` 查证）。不能使用其 Node/Prisma/PostgreSQL 直接替换知研 AI 的规定栈。

`src/core/graph.ts` 名称虽然含 graph，实际是手写顺序/分支流程：首次走 planning、非活动态短路、后续走 interviewing、结束时异步调度单人分析（DS12）。`package.json` 没有 LangGraph SDK 依赖；README 英文也明确是 “LangGraph-inspired workflow (not StateGraph API)”。不要写成已接入 LangGraph StateGraph。

关键目录：`src/api/` 为模板/计划/分析/健康接口；`src/core/nodes/` 为开场及访谈路由；`src/services/` 为追问/提示词/报告/维度/聚合 helper；`src/repositories/` 为事务与 Prisma 访问；`src/integrations/llm/` 为模型边界、`dingtalk/` 为触达渠道；`prisma/` 为 schema/migrations；`src/views/` 为管理台和报告；`tests/` 为单元及集成测试源码。

### 4.2 数据结构与可参考机制

- **访谈状态**（DS2、DS3）：`currentQuestion`、`followupCount`、`maxFollowups`、状态枚举及乐观锁 `version/originalVersion`；待写 `pendingMessages/pendingResponses`。
- **原答与追问分开标识**（DS2、DS5）：Response 含 `questionId/content/isFollowup/followupDepth`，消息另表保留对话。方向可参考；知研 AI 还需要明确 followup ID、决策 ID、提问原文、源回答 ID、来源类别和字符偏移，不能只存深度。
- **模型动作与执行器分离**（DS4、DS5）：LLM JSON 解析为 `NEXT/FOLLOWUP/END`，控制层二次限制 FOLLOWUP 次数并更新状态；失败转 NEXT。知研 AI 可独立设计 Java Provider + 决策校验器 + 状态机，使用 CLARIFY/DEEPEN/EXPLORE/SKIP。
- **并发持久化**（DS7）：消息、回答与状态在事务中写入，并用版本条件更新。只说明其源码有此保护，不把它视为知研 AI 所需的“全卷预算唯一扣减”已经解决。
- **单人维度标注**（DS8）：模板维度输入模型，得到 `dimensionTags/emergentTags` 并保存，引用做 PII 脱敏。适合作为“分析失败不影响主访谈”的职责划分参考。

### 4.3 动态追问、预算和停止的实际控制流

**动态追问已验证到源码接线层**：`interviewingNode` 接受当前回答、题目、下一题，调用 `generateSmartResponse`；提示词包含最近 6 条历史、当前回答和每题追问计数（DS4、DS5）。模型可以决定 FOLLOWUP 而不移动题号。真实模型能否稳定识别模糊性、产生中立高质量追问，**尚未运行验证**；本次不能声称 AI 效果达标。

**预算是每题上限，不是全问卷预算**：`routeAction` 在 FOLLOWUP 时 `followupCount + 1`，NEXT 时清零（DS5 L100–118）；状态中只有该计数和 `maxFollowups`（DS3）。因此 5 题各追问多次仍符合这套实现；没有证明全卷最多 N 次，也没有全卷预算账本、唯一决策扣减约束或跨题机会成本分配。不能把 `Interview.maxFollowups` 字段所在实体层级误判为“全局预算”。

**停止已验证的硬控制**：FOLLOWUP 到达每题上限强制 NEXT；NEXT 在末题完成；模型 END/shouldEndInterview 可提前完成；异常分支可推进下一题（DS5）。**仅提示词控制**：回答充分时 NEXT、拒答时 NEXT、要求结束时 END（DS6）；这些自然语言意图依赖模型，不等于确定性“跳过/拒绝 AI”交互和不可撤销状态保护。源码没有证明信息增益阈值、诱导风险评分、跨题预算最优分配。

值得谨慎参考的边界：

- `resultFromParsed` 对 FOLLOWUP 原文不调用 `stripExtraQuestions`（DS4 L123–133），尽管 prompt 和注释声称每次只能一问；所以“每轮严格一问”没有被所有输出路径硬保证。相关单测也明确保留 FOLLOWUP 原文（DS14；`tests/interview-dialog-determinism.test.ts` L106–116）。
- `STAY` 是节点执行器接受的内部动作，超上限也允许重复；正常 `parseLLMResponse` 不接受 STAY，会降级 NEXT（DS4 L81–88、DS5 L30–43）。不能把仅测试 mock 可注入 STAY 写成正常模型必然可以绕过上限，也不能照搬该隐式动作集。
- 追问 Provider 的 `fromEnv()` 在函数 try 块外；缺 Key 可由外层 interviewing 捕获并前进，但首题 `polishFirstQuestion` 同样在 try 前构造客户端，planning 未见本地捕获（DS15、DS13）。因此不能宣称所有入口无 Key 都可靠降级，需运行验证并在知研 AI 中统一处理。
- 首题会调用模型润色，后续 NEXT 的题干由模型生成过渡文本（DS13、DS6）。这与知研 AI“发布核心题文本冻结”的测量一致性要求不同，应保持固定题干原文，追问单独显示与存储。

### 4.4 跨受访者聚合：有 helper，不等于闭环

**已验证（源码）**：

1. 单人分析真实调用维度抽取并保存 `dimensionTags/emergentTags`（DS8），但 `batchAnalyze` 只是循环做单人报告（DS16；`analysis.service.ts` L168–188），本身不是跨人聚类。
2. `clusterDimensionQuotes` 将引文列表交给 LLM 分为 3–8 类；`discoverEmergentIssues` 对多人的 emergent tags 要求至多 5 个议题；`mentionCount` 由模型提供，新议题 prompt 明说 estimated count（DS9）。这不是 BERTopic/embedding/HDBSCAN 实现。
3. `computeDimensionStats` 在每份 tags 内用 Set 去重维度，然后用出现次数/调用方给定 `totalInterviews` 计算提及率（DS9 L47–118）。它假设输入一份数组代表一个人/一份访谈，未携带受访者身份自行去重，因此不能保证来自多份重复报告的人不被重复计数。
4. `BatchAnalysisReport` 有 metrics/topics/emergents/checkpoint 字段；聚合 POST 实际仅创建内容空的 PENDING 报告（DS2、DS10），GET 读取它。
5. 在固定提交的全 `src/` 搜索 `clusterDimensionQuotes|discoverEmergentIssues|computeDimensionStats|createCheckpoint|runWithTimeout|executeWithConcurrencyLimit`，这些 helper 仅见定义，未见生产调用点；`src/server.ts` 未接入聚合执行 worker。因此**已检查主应用中未验证到从聚合请求→执行聚类→保存 COMPLETED 的闭环**。不排除仓库外部署工具，但本仓库不能据此声称该功能完整。

**主题可信差距**：当前引用是自由字符串，解析主要判断数组，不按回答 ID、原文偏移或存在性校验（DS8、DS9）。没有在已检查路径证明四类来源标签、人工接受/合并/驳回审核、排除模型推测后的有效人数分母。新主题的 model-estimated mentionCount 更不能直接作为可信统计。知研 AI 必须将模型主题候选与数据库确认的证据、独立受访者计数分开。

### 4.5 许可证及验证等级

**仅 README 声称 MIT**：README badge 与 L311–313 写 MIT；该提交根 `package.json` 无 license 字段，完整树未见 LICENSE/COPYING/NOTICE 正文。结论应写为“作者声明 MIT，授权正文/版权归属仍需确认”，不能假装已逐条审阅完整 MIT 授权。若后续获完整 MIT 授权，通常须保留版权及许可通知；依赖仍需分别清点。本次没有复制代码。

测试源码是证据，不是执行报告：DS11 的追问路由与聚类测试使用 mock；聚合 API 测试期望 PENDING。README 的大量测试数、钉钉生产运行与质量宣传属于文档描述，本次未复跑。没有真实模型、钉钉、数据库、Windows 部署和实际主题精度验证，不能写为已通过。

### 4.6 四项核心机制核验表

| 核心需求 | 静态核验结论 | 证据与限制 |
|---|---|---|
| 动态追问 | LLM→FOLLOWUP/NEXT/END→状态转移接线已验证 | DS4/DS5；模型中立性和新增信息未运行验证 |
| 全问卷追问预算 | 已验证为每题计数，不能认定全卷上限/唯一扣减 | DS3/DS5；NEXT 清零；DS7 的事务版本锁非预算账本 |
| 停止策略 | 每题上限、末题、模型 END、异常 NEXT 有实现 | DS5/DS6；拒答/充分性部分依赖 prompt；所有入口缺 Key 降级未验证（DS13） |
| 跨人主题聚合 | 有 helper 和单人分析，生产聚合闭环未验证 | DS8–DS11；API 建 PENDING；模型估计 mentionCount 不作可信人次 |

### 4.7 M0–M6参考建议

| 阶段 | 参考建议与知研 AI 边界 |
|---|---|
| M0 工程 | 参考 Provider 与业务分层、健康检查边界；不引入 Node/Prisma/PostgreSQL；本阶段仍需：固定兼容版本，Spring Boot + MyBatis-Plus 真 MySQL 集成测试、ECharts 联通及 Windows PowerShell 命令 |
| M1 固定问卷 | 参考消息/回答分表和版本冲突处理思想；本阶段仍需：数据库发布快照、真实匿名会话、提交幂等、所有权与 SQL 统计；核心题原文冻结 |
| M2 AI 设计 | 参考 OpenAI 兼容 Provider 与结构化返回分离；本阶段仍需：Java 服务端 JSON Schema/题型/重复/诱导校验，人工审核，明确 Mock/model，无 Key 所有入口可用 |
| M3 单人探索 | 重点参考动作执行器、每题上限、历史上下文、异常前进；识别模型提示和硬规则的区别；本阶段仍需：实现 CLARIFY/DEEPEN/EXPLORE/SKIP；全卷预算与唯一扣减；明确拒绝/跳过、隐私/诱导硬门槛、决策证据日志 |
| M4 跨人新维度 | 借鉴单人抽取→跨人归并的职责划分、每份报告内去重；不可把未接线 helper 当成完整 pipeline；本阶段仍需：批处理闭环、四类来源、存在性和偏移校验、按受访者去重、人工复核、发布题不回写 |
| M5 可信统计 | 确定性 mentionRate 的分母思想可参考；模型估计次数不可当事实；本阶段仍需：Spring Boot/MyBatis-Plus 计算有效分母、缺失和版本；ECharts 接真实 API；数字/AI 解释/假设分层 |
| M6 实验 | 可设计普通 LLM 自由追问的概念基线；未跑源码、未证明效果、许可证未清不得直接集成；本阶段仍需：用本项目实现 A–D 策略、同预算、盲评、来源准确率/新增语义单元/退出负担/成本；记录模型种子版本与真实运行日志 |

### 4.8 固定 commit 证据目录

| 编号 | 固定提交证据文件及行号 | 所证明的内容 |
|---|---|---|
| DS1 | [package.json L25–102](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/package.json#L25-L102)、[src/server.ts L1–58](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/server.ts#L1-L58) | Node/TS、Fastify、Nunjucks、Prisma、钉钉接入；非 Spring/Vue 栈 |
| DS2 | [prisma/schema.prisma L7–104](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/prisma/schema.prisma#L7-L104)、[L139–215](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/prisma/schema.prisma#L139-L215) | PostgreSQL、访谈/消息/回答/模板/分析及批报告实体 |
| DS3 | [src/core/types/index.ts L14–71](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/core/types/index.ts#L14-L71)、[L89–108](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/core/types/index.ts#L89-L108) | 完整状态、每题计数、字符串题目列表、pending 消息/回答 |
| DS4 | [src/services/followup.service.ts L72–137](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/services/followup.service.ts#L72-L137)、[L153–193](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/services/followup.service.ts#L153-L193)、[L220–277](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/services/followup.service.ts#L220-L277) | 上下文、结构化动作解析、限制及失败分支 |
| DS5 | [src/core/nodes/interviewing.ts L30–145](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/core/nodes/interviewing.ts#L30-L145)、[L149–226](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/core/nodes/interviewing.ts#L149-L226) | FOLLOWUP/NEXT/END 状态转移、NEXT 清零、回答深度与异常回退 |
| DS6 | [src/services/prompt.service.ts L78–137](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/services/prompt.service.ts#L78-L137) | 模型策略提示与拒绝/结束识别的语义指导 |
| DS7 | [src/repositories/interview-state.repository.ts L167–220](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/repositories/interview-state.repository.ts#L167-L220) | 事务写消息/回答/状态与版本条件更新 |
| DS8 | [src/services/analysis.service.ts L52–164](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/services/analysis.service.ts#L52-L164)、[src/services/report.service.ts L220–285](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/services/report.service.ts#L220-L285) | 单人维度分析实际接入与宽松解析，引用脱敏但无逐条原文定位校验 |
| DS9 | [src/services/llm-clustering.ts L1–114](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/services/llm-clustering.ts#L1-L114)、[src/services/batch-aggregation.service.ts L40–118](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/services/batch-aggregation.service.ts#L40-L118) | 跨人主题 helper、模型估计数、按一份报告内维度去重的确定性统计 |
| DS10 | [src/api/analysis.ts L74–118](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/api/analysis.ts#L74-L118)、[src/services/analysis.service.ts L302–345](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/services/analysis.service.ts#L302-L345) | 聚合接口实际仅建 PENDING 空报告并读取 |
| DS11 | [tests/interviewing-routing.test.ts L90–169](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/tests/interviewing-routing.test.ts#L90-L169)、[tests/llm-clustering.test.ts L6–118](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/tests/llm-clustering.test.ts#L6-L118)、[tests/batch-aggregate-api.test.ts L29–58](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/tests/batch-aggregate-api.test.ts#L29-L58) | 有 Mock 动作/聚类单测，聚合 API 测试只断言 PENDING，不能证明端到端聚合完成 |
| DS12 | [README.md L69–74](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/README.md#L69-L74)、[L311–313](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/README.md#L311-L313)、[src/core/graph.ts L49–103](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/core/graph.ts#L49-L103) | 自定义流程而非 LangGraph SDK；MIT 仅 README 声明 |
| DS13 | [src/integrations/llm/openai-compatible.ts L90–115](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/integrations/llm/openai-compatible.ts#L90-L115)、[L147–171](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/integrations/llm/openai-compatible.ts#L147-L171)、[src/core/nodes/planning.ts L10–26](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/core/nodes/planning.ts#L10-L26) | AbortController 超时、缺 Key 抛错、首题经模型润色 |
| DS14 | [tests/interview-dialog-determinism.test.ts:106–116](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/tests/interview-dialog-determinism.test.ts#L106-L116) | 测试明确 FOLLOWUP 原文不截断，本次已补读未运行 |
| DS15 | [src/services/followup.service.ts:48–68](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/services/followup.service.ts#L48-L68) | Provider 在内部 try 之前构造，异常须结合外层节点分析 |
| DS16 | [src/services/analysis.service.ts:168–188](https://github.com/boyingliu01/dialog-survey/blob/909f0db9cc9263ed6e2ffbb9ba469722de56cb5e/src/services/analysis.service.ts#L168-L188) | batchAnalyze 循环做单人分析，并非跨人主题聚类 |

## 5. OASIS：访谈协议与追问边界

仓库：[oasis-surveys/oasis-platform](https://github.com/oasis-surveys/oasis-platform)；分支 main；commit 057305dd04d9d5c42b9f3387b393dcc0a34ee214。克隆失败后以 GitHub 只读连接器读取固定源码；未安装、运行或执行测试。

### 5.1 实际技术栈、目录、数据结构

**源码已验证**：前端 React 18.3、TypeScript、Vite 5、Tailwind；服务端 Python FastAPI 0.115.6、SQLAlchemy 2 异步 ORM、Alembic；数据库 PostgreSQL 16 + pgvector，Redis 5.2 客户端；访谈用 Pipecat、OpenAI / LiteLLM，并有语音 STT/TTS、Twilio 相关依赖。不是 Vue / Spring Boot / MyBatis-Plus / MySQL 项目，不可作为知研 AI 直接工程底座。

主要目录：`frontend/src/pages/` 管理页与访谈页；`backend/app/api/` HTTP/WebSocket 入口；`models/`、`schemas/` 持久化及校验；`pipeline/` 访谈协议与语音处理；`engagement/` 参与度与自适应规则；`knowledge/` 研究背景资料 RAG；`backend/alembic/versions/` 迁移；`backend/tests/` 测试。

| 证据 | 固定版本文件与行号 | 已读结论 |
|---|---|---|
| OA1 | [frontend/package.json:7–30](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/frontend/package.json#L7-L30) | React/Vite/TypeScript，未以 Vue/ECharts 为前端底座 |
| OA2 | [backend/requirements.txt:1–29](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/requirements.txt#L1-L29)、[docker-compose.yml:31–65](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/docker-compose.yml#L31-L65) | FastAPI/SQLAlchemy、PostgreSQL/pgvector/Redis、Pipecat/LiteLLM |
| OA3 | [backend/app/models/agent.py:18–57](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/models/agent.py#L18-L57)、[同文件:167–178](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/models/agent.py#L167-L178) | Agent 归属于 Study；访谈可 free_form / structured，guide 以 JSON 存储 |
| OA4 | [backend/app/schemas/agent.py:16–55](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/schemas/agent.py#L16-L55) | 主问题 `text`、预设 `probes[]`、每题 `max_follow_ups`（0–10）、transition、closing、ordered/relevance 选择策略 |
| OA5 | [backend/app/models/session.py:40–69](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/models/session.py#L40-L69)、[同文件:118–173](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/models/session.py#L118-L173) | Session 状态/参与者/耗时，TranscriptEntry 按会话、角色、sequence 保存原文及 token 用量；汇总 token 是计量，不是追问预算 |

### 5.2 真正实现了什么

1. **动态追问：已实现有限形式，不能等同于知研 AI 的开放式新线索探索。** `build_structured_prompt` 将预设主问题与 probes 放进上下文。`ordered` 按序，`relevance` 让模型依据当前回答选择最相关、未用过的一条预设 probe；两种模式都明确禁止自行发明额外 probes。因此“回答相关的预设追问选择”有真实实现，但这条结构化路径不是依据受访者自发新线索生成任意 `EXPLORE`。free_form 模式存在，但其新线索发现质量与中立性未实际测试。[OA4；[interview_guide.py:308–365](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/pipeline/interview_guide.py#L308-L365)]
2. **每题预算：有计数器和推进提示，严格保证范围有限。** `TextStructuredController` 保存当前题号、题内机器人回合数、待推进标记；`1 + max_follow_ups` 达上限后，在下一次实质回答到达时注入推进/结束指导。澄清/请求重复被正则识别后不扣次数。语音 `InterviewGuideProcessor` 还避免欢迎词、等待中的沉默提示重复扣次数。它们是控制进度的内存状态与提示注入，不能直接称为数据库事务硬拦截所有生成的追问。[interview_guide.py:[689–740](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/pipeline/interview_guide.py#L689-L740)、[788–839](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/pipeline/interview_guide.py#L788-L839)、[930–1040](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/pipeline/interview_guide.py#L930-L1040)]
3. **全问卷全局预算：在已核查 guide schema、controller、Session 与 text loop 中尚未验证到。** 每题上限之和不是跨题可分配、刷新/重试不重复扣费的全局预算；`total_tokens` 也不是追问次数上限。controller 在每个 WebSocket 会话中初始化，已读模型未提供知研 AI 所需的预算扣减台账/幂等键。不能仅据这些文件断言所有分支和未来版本都没有。
4. **单轮输出守卫：有真实代码。** 文本和流式路径对第一句问句之后的额外内容进行截断；文本端同步截断上下文，避免模型以为受访者看到了被删掉的第二个问题。隐藏 `[[Qn]]` 进度标签会剥离，并允许 controller 向前同步。这是文本形式守卫，不能证明无诱导或完整语义正确。[interview_guide.py:[465–584](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/pipeline/interview_guide.py#L465-L584)、[654–685](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/pipeline/interview_guide.py#L654-L685)；[text_chat.py:856–886](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/api/text_chat.py#L856-L886)]
5. **停止策略：协议级收尾、时间停止已读，语义信息增益停止未验证。** controller 在最后一题预算用完后置 `_closed` 并提示模型收尾；已读文本 loop 并未检查 `is_finished` 后直接 break，因此不能把 `_closed` 等同于 WebSocket 强制关闭或模型绝不继续。该 loop 对总时长超限和等待用户超时则明确发送 ended 并 break。每题提前不问的理由主要仍由提示中的“已明确覆盖”交给模型判断，未见知研 AI 所需的 `SKIP / CLARIFY / DEEPEN / EXPLORE` 结构化理由与信息收益判定表。[interview_guide.py:[419–431](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/pipeline/interview_guide.py#L419-L431)、[956–994](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/pipeline/interview_guide.py#L956-L994)；[text_chat.py:757–787](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/api/text_chat.py#L757-L787)、[835–946](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/api/text_chat.py#L835-L946)]
6. **自适应参与度：确有规则引擎，但不是语义新维度算法。** `AdaptivePolicyEngine.evaluate` 将持续脱离、长延迟、very_short_answer 等触发映射到 offer_break、soften_next_probe、encourage_elaboration、调语速等动作，有冷却期、每轮最多一种提示动作/一种语速动作。shadow 只记，live 注入，`AdaptiveAction` 持久化 trigger/action/mode/detail。不能把短回答参与度规则当成“语义判断是否缺信息”。部分默认文案包含肯定、镜像等交流风格，不应未经方法审查照搬到中立问卷。[adaptive.py:[18–111](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/engagement/adaptive.py#L18-L111)、[227–261](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/engagement/adaptive.py#L227-L261)；[text_chat.py:438–489](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/api/text_chat.py#L438-L489)]
7. **跨受访者主题聚合：尚未验证。** 已读 `api/analytics.py` 是按 study/agent 聚合会话数、完成/错误/超时、话语条数、时长，不是跨人语义主题。`knowledge/embeddings.py` 切分上传背景文档，用 pgvector 检索并给访谈提供 RAG，不是从不同受访者答案抽取新主题，更没有来源四分类、按独立人次去重与人工主题复核证据。不能因为有 embedding/analytics 就宣称实现了 M4。[analytics.py:61–88](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/api/analytics.py#L61-L88)；[embeddings.py:165–210](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/knowledge/embeddings.py#L165-L210)、[225–262](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/knowledge/embeddings.py#L225-L262)。

**源码测试已读但未运行**：[test_interview_guide.py:750–844](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/tests/test_interview_guide.py#L750-L844) 对题内预算、澄清不扣次数、推进、最后题收尾、标签单向同步有断言。它证明作者编写了这些测试，不证明本次运行通过，更不证明模型持续遵从协议。

**仅 README 声称/未完整核查的范围**：[README.md:64–71](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/README.md#L64-L71) 的多供应商全覆盖、语音到语音、电话 beta、导出等端到端能力，本次未逐条运行；已验证的结构化追问与 adaptive 机制不再归入“仅 README”。

### 5.3 与知研 AI 的差距、许可证

可借鉴的是“研究项目—受访会话—逐轮原文”的分层、模板 guide、单问守卫、澄清不消耗追问、每次干预记日志、shadow 先观察后启用及超时状态。知研 AI 仍需自行实现固定核心问卷与发布版本冻结、四题型常规提交、原答案/追问独立表、按调查所有权授权、拒绝 AI 与跳过、结构化语义决策、全卷持久化幂等预算、无 AI 的完整提交路径，以及主题证据归因和人次口径。这些不是把聊天循环搬到 Vue 后就自然具备。

许可证 **AGPL-3.0** 已核对 [LICENSE](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/LICENSE#L1) 与 [NOTICE:1–20](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/NOTICE#L1-L20)。若未来复制/改造分发，需要保留许可/版权并遵守对应源码要求；修改版供网络用户交互涉及第 13 节提供对应源码的义务，学术用途不自动豁免。NOTICE 的通俗说明不替代 LICENSE 法律文本；本次只做机制研究，无第三方代码、prompt 原文或界面素材集成。

### 5.4 四项核心机制核验表

| 核心需求 | 静态核验结论 | 证据与限制 |
|---|---|---|
| 动态追问 | 回答相关的预设 probe 选择已验证 | OA4/OA6；结构化路径禁新增任意 probe，free_form 效果未运行验证 |
| 全问卷追问预算 | 题内回合计数与提示注入已验证；全卷持久幂等预算未验证 | OA5/OA7；token计量非预算，内存controller非数据库扣减台账 |
| 停止策略 | 末题协议收尾、总时长与等待超时有控制 | OA8/OA10；closed标记非文本loop强制退出，不证明语义信息增益停止 |
| 跨人主题聚合 | 已读RAG与analytics不能证明答案主题聚类 | OA12；背景检索和会话指标与M4证据主题不同 |

### 5.5 M0–M6参考建议

| 阶段 | 参考建议与知研 AI 边界 |
|---|---|
| M0 | 借鉴配置与健康、迁移、会话状态分层思想；保持 Windows / MySQL 真联通，不引入其 React/FastAPI/PostgreSQL/Redis 依赖 |
| M1 | 借鉴 Study→Session→Transcript 分层和匿名识别；自主完成四题型、冻结版本、所有权及幂等提交，聊天协议不能代替问卷闭环 |
| M2 | 借鉴配置校验和 Provider 统一入口概念；问卷生成要 Schema 校验、人工编辑，禁止直接发布 |
| M3 | 参考每题上限、澄清不扣、单问守卫、shadow 审计；另写语义决策和全卷事务预算，跳过/拒绝 AI/超时不能阻塞普通问卷；不复制提示词与实现 |
| M4 | 以逐轮原文定位思想建证据链；其 RAG 与会话 analytics 不能当成新维度发现 |
| M5 | 参考后端明确计算状态分布；注意其 study 平均时长是各 agent 均值再平均（analytics.py:133–141），多组样本数不同时不能直接照用 |
| M6 | 可参考协议遵从计数、shadow/live 实验及干预记录；真正对照仍需相同全局预算、独立盲评与退出/诱导指标，不能用参与度规则自证创新 |

### 5.6 追问、分析与许可的补充固定证据

OA1–OA5见5.1基础证据表；以下编号使核验表直接定位实现。

| 证据 ID | 固定源码路径及行 | 实际证明的范围 |
|---|---|---|
| OA6 | [backend/app/pipeline/interview_guide.py:308–365](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/pipeline/interview_guide.py#L308-L365) | ordered/relevance预设probe及禁止发明额外probe |
| OA7 | [backend/app/pipeline/interview_guide.py:930–1040](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/pipeline/interview_guide.py#L930-L1040) | 题内回合、澄清不扣、推进/收尾指导 |
| OA8 | [backend/app/pipeline/interview_guide.py:956–994](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/pipeline/interview_guide.py#L956-L994) | closed与末题收尾，不证明连接关闭 |
| OA9 | [backend/app/pipeline/interview_guide.py:465–584](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/pipeline/interview_guide.py#L465-L584) | 单问形式守卫，不证明语义中立 |
| OA10 | [backend/app/api/text_chat.py:757–787](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/api/text_chat.py#L757-L787) | 总时长、等待超时的ended/break；后续loop见835–946 |
| OA11 | [backend/app/engagement/adaptive.py:18–111](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/engagement/adaptive.py#L18-L111) | 参与度规则、动作、冷却，不是新维度算法 |
| OA12 | [backend/app/api/analytics.py:61–88](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/api/analytics.py#L61-L88) | 会话指标；背景RAG另见下方直接链接 |
| OA13 | [LICENSE:1–1](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/LICENSE#L1-L1) | AGPL-3.0；NOTICE另见正文直接链接 |
| OA14 | [backend/app/api/analytics.py:133–141](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/api/analytics.py#L133-L141) | study对agent均值再平均，整合时额外直接取源码核对 |
| OA15 | [backend/tests/test_interview_guide.py:750–844](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/tests/test_interview_guide.py#L750-L844) | 题内预算/推进测试源码，本次未运行 |

OA12 的背景知识范围补充：[backend/app/knowledge/embeddings.py:165–262](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/knowledge/embeddings.py#L165-L262)。

## 6. BERTopic：通用主题建模，不等于可信问卷主题系统

仓库：[MaartenGr/BERTopic](https://github.com/MaartenGr/BERTopic)；分支 master；commit 9036123c97aaa9a6cc4bec4a6db1a7caf9209df6。克隆失败后以 GitHub 只读连接器读取固定源码；未安装、运行、下载权重或执行测试。

### 6.1 实际技术栈和关键目录

**源码已验证**：这是 Python 主题建模库，当前 `pyproject.toml` 版本 `0.17.4`、Python ≥3.10，主要依赖 sentence-transformers、umap-learn、hdbscan、scikit-learn、numpy、pandas、Plotly。不是问卷前后端平台，没有可直接替代 Spring Boot/MyBatis-Plus 的业务后端。`bertopic/backend/` 是 embedding 适配，`dimensionality/`、`cluster/` 是算法接口，`vectorizers/` 负责词袋与 c-TF-IDF，`representation/` 可细化主题表示，`plotting/` 为 Plotly 图表，`tests/` 为算法测试。知研 AI 图表仍必须 ECharts，不引入 Plotly 代替。

| 证据 | 固定版本文件与行号 | 已验证机制 |
|---|---|---|
| BT1 | [pyproject.toml:5–49](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/pyproject.toml#L5-L49) | 库版本、Python 与算法依赖；Windows 为包声明支持的平台，但本次未安装验证 |
| BT2 | [bertopic/_bertopic.py:250–293](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py#L250-L293) | CountVectorizer/c-TF-IDF；默认 UMAP，导入失败可 PCA；HDBSCAN 或 sklearn HDBSCAN；组件可替换 |
| BT3 | [bertopic/_bertopic.py:448–524](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py#L448-L524) | 文档行 ID→embedding→降维→聚类→按频次映射→主题词表示；不是按人次自动识别 |
| BT4 | [bertopic/vectorizers/_ctfidf.py:54–113](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/vectorizers/_ctfidf.py#L54-L113) | 主题词频 L1 归一化后乘 IDF；可 BM25 类权重、降低高频词、seed 词加权 |
| BT5 | [bertopic/_bertopic.py:4010–4058](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py#L4010-L4058) | zero-shot：预设主题 embedding 与文档余弦相似度达阈值即归类，剩余文档另聚类（衔接见 BT3） |
| BT6 | [bertopic/_bertopic.py:1734–1824](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py#L1734-L1824) | document info 可附 metadata、主题、代表文档标志、聚类概率；metadata 由调用者提供 |
| BT7 | [bertopic/_bertopic.py:4235–4311](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py#L4235-L4311) | 代表文档从主题内固定种子抽样，用 c-TF-IDF 余弦相似度选择，可选 MMR 增加多样性；内部可返回行索引 |
| BT8 | [bertopic/_bertopic.py:4455–4462](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py#L4455-L4462)、[同文件:1664–1695](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py#L1664-L1695) | topic size 是 Counter(document.Topic)，Count 是文档条数；代表文档另附 |
| BT9 | [bertopic/backend/_utils.py:140–147](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/backend/_utils.py#L140-L147) | 多语言 embedding 模型选择存在；不等于中文短答聚类效果已验证 |

### 6.2 能力核实和研究价值

- **动态追问、全问卷追问预算、受访停止：未在已读库入口/主题建模实现中验证到。** 输入是文档列表和可选 embedding/标签，输出是主题归属与概率；它不是交互式调查状态机。README 的 “Dynamic Topic Modeling” 是按 timestamps 的 `topics_over_time`，不是动态向人追问；“Online” 是批次增量训练，也不是在线访谈停止。
- **跨文档主题聚合：源码已验证。** 不同受访者的语义单元可以作为文档输入，embedding 聚类能归并词面不同的表达，c-TF-IDF 给出主题描述；零样本预设主题+剩余文档聚类可作为“已覆盖维度与候选未覆盖维度”的实验设计参考。但“未匹配预设主题”还可能是离题、噪声或 embedding 偏差，不自动等于有研究价值的新维度（BT3、BT5）。
- **证据能力：仅通用文档映射的一部分已验证。** BT6/BT7 保留每文档主题与代表文档，调用者可以加来源 metadata；内部行 ID 是本次列表位置，不是数据库不可变 `answerId`，公共代表文档主要是字符串。`get_representative_docs` 本身说明并未保留主题下全部输入文档（[_bertopic.py:1826–1840](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py#L1826-L1840)）。不能只存前几条代表句就声称全量证据链完成。
- **可信人次/来源治理：未验证到问卷专用实现，已验证默认 Count 的口径不同。** 同一人原回答+两条追问拆成三个文档时，BT8 的 Count 可计三条；知研 AI 必须按 `(surveyVersionId, themeId, respondentSessionId)` 去重，再区分自发/中立追问/选项提示/模型未确认，并计算暴露条件下的有效分母。聚类 probability 不能解释为总体持该观点的比例，代表文档也不是频率样本。
- **人工合并可参考算法 API，不可冒充审核系统。** 类中有 `merge_topics`（[入口:2101](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py#L2101)），但本次没有运行其合并/保存与历史迁移；不能据 API 名称就宣称有知研 AI 的接受/驳回/重命名、审核人、审计与刷新后持久化。
- **在线训练有限条件已验证。** `partial_fit` 要求降维器/聚类器支持增量训练，并配合 OnlineCountVectorizer，注释建议批次而非逐文档（[649–678](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py#L649-L678)）；默认组件组合不可未经验证就假定能在线更新。

**源码测试已读但未运行**：[test_ctfidf.py:23–54](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/tests/test_vectorizers/test_ctfidf.py#L23-L54) 验证矩阵形状等；[test_class.py:19–29](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/tests/test_variations/test_class.py#L19-L29) 明确频次和等于文档数量，进一步支持不能直接等同受访人数。没有执行中文合成问卷或 M4 验收用例，因此不能给发现准确率或声称已成功发现“同伴影响”。

**仅 README 声称/本次未沿全部实现验证**：[README.md:265–276](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/README.md#L265-L276) 的所有主题变体、层次主题、模型合并与可视化完整行为。核心 embedding/聚类/c-TF-IDF、zero-shot、文档映射、增量接口条件已有上述源码证据；不应一概降为 README 证据。

### 6.3 差距和许可证

BERTopic 适合作为 M4/M6 的**算法机制参照或未来另行授权的离线基线**，不是本次新增 Python 生产服务的授权。知研 AI 仍须在 Spring Boot 业务层治理证据 ID、原文范围、问卷版本、同意状态、来源类别、独立人次、人工审核、失败恢复与参数版本。中文分词、短文本稀疏性、小样本（如 8 份）与默认聚类规模、离题/异常值、随机性、模型下载和 Windows 依赖均需专门实验；本次没有验证其效果，也未下载权重。

许可证 **MIT** 已核对 [LICENSE:1–21](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/LICENSE#L1-L21)：允许使用、修改、分发等，复制或实质部分需保留版权及许可声明，无保证。MIT 不覆盖第三方 embedding 模型权重、数据集、外部服务的独立许可证/使用条款。本次未复制或集成实现，未下载数据集或模型。

### 6.4 四项核心机制核验表

| 核心需求 | 静态核验结论 | 证据与限制 |
|---|---|---|
| 动态追问 | 输入文档建模，无已验证访谈追问路径 | BT1/BT3；Dynamic Topic Modeling不指动态向人提问 |
| 全问卷追问预算 | 已读算法入口未验证问卷次数账本 | BT1/BT3；不是调查状态管理库 |
| 受访停止策略 | 已读路径未验证拒答/语义停止控制 | BT3；聚类离群与阈值非访谈停止 |
| 跨人主题聚合 | 跨文档语义归并已验证，可作机制参照 | BT3–BT8；Count按文档，非人次；不自带来源分类/证据存在性/审核 |

### 6.5 M0–M6参考建议

| 阶段 | 参考建议与知研 AI 边界 |
|---|---|
| M0 | 仅登记算法候选和许可，不安装、不接生产服务，不影响无 AI 工程启动 |
| M1 | 预留不可变 answer/session/version/source 关联，不需要主题算法 |
| M2 | 预设维度可以结构化保存，供将来比较，不将预设主题强塞给受访者 |
| M3 | 不用于追问决策或停止，聚类相似度不是下一次追问的信息增益 |
| M4 | 参考 embedding 聚类、c-TF-IDF、预设匹配后剩余聚类；另做来源四分类、证据合法性、人次去重、离题过滤、人工复核；小样本先评估 |
| M5 | 展示文档数/受访人数不同口径；代表句可导航但不代替全量证据。数值由 Java/SQL 算，Vue/ECharts 渲染，不以 Plotly 替代 |
| M6 | 可讨论作为另行批准的离线主题基线；记录输入单元、embedding、分词、聚类参数、seed、离群策略和版本，与人工主题/证据支持率比较，不把主题数更多当更好 |

### 6.6 许可与验证限制补充证据

| 证据 ID | 固定源码路径及行 | 实际证明的范围 |
|---|---|---|
| BT10 | [LICENSE:1–21](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/LICENSE#L1-L21) | MIT原文，不覆盖所有外部模型/数据许可 |
| BT11 | [tests/test_variations/test_class.py:19–29](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/tests/test_variations/test_class.py#L19-L29) | 频次和与文档数对应的测试源码，未运行 |
| BT12 | [bertopic/_bertopic.py:1826–1840](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py#L1826-L1840) | 代表文档非全量；partial_fit条件见正文649–678链接 |

## 7. 参考优先级与创新验证边界

| 目标 | 优先参考 | 必须自主实现与验证 |
|---|---|---|
| 固定问卷真实闭环 | SK3–SK9、TD4–TD14、SJ3/SJ4 | 发布版本冻结、四题型后端校验、匿名会话权限、持久幂等、MySQL真实统计与ECharts API |
| 开放题受控追问 | DS3–DS7、OA4/OA6–OA11 | 原题不改写；四动作/同意/拒绝/跳过硬约束；可重放决策；原子全卷预算 |
| 跨人新维度 | DS8–DS11（区分helper/未闭环）、BT3–BT8 | 完整任务闭环；真实来源ID/原文范围；来源四分类、人次去重、预设维度比较、离题过滤、人工审核 |
| 可信展示与实验 | SK9、TD14、BT8/BT11、OA14 | Java/SQL计算数值；版本/缺失/分母明确；事实/解释分开；同预算A/B/C/D、盲评、模型/seed/耗时/成本记录 |

建议不代表导入第三方工程的指令。M0/M1以真实数据库和无AI问卷闭环为先；M2+等待阶段授权。预算默认值、主题数、模型估计频次、embedding相似度均不能未经实验当作信息增益、总体观点比例或创新效果。

本次验证边界：已审查六库固定版本关键源码与证据，检查最终Markdown结构和证据编号；**未**运行上游应用、真实LLM、上游测试、Windows部署或中文主题实验，不提供虚构通过数、性能或发现准确率。复用前应补核缺失许可和依赖/模型条款。本文件不更改知研业务代码、依赖和技术栈。

本项目依据：AGENTS.md、CODEX_KICKOFF.md、docs/DEVELOPMENT_PLAN.md、PRODUCT_SPEC.md、ARCHITECTURE_AND_API.md、ACCEPTANCE_GUIDE.md、RESEARCH_EVAL.md。本文件汇总本次三路并行静态调研，事实与关键固定证据已自包含，无需专项附件补全六项结论。
