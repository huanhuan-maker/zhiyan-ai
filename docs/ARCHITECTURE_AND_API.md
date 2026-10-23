# 知研 AI｜技术架构与接口约束 V2.0（老师技术栈）

## 1. 强制选型（不得替换）

- **前端**：Vue 3、ECharts；推荐 TypeScript、Vite、Vue Router、Pinia（辅助工具可选）。
- **后端**：Spring Boot、MyBatis-Plus；推荐 Java 17+、Maven Wrapper、Bean Validation、Spring Security。
- **数据库**：MySQL 8.x。初始化与版本变更可用 SQL migration/Flyway，ORM/Mapper 层仍必须用 MyBatis-Plus。
- **前后端通信**：REST API + JSON。AI 通过后端 Provider 调用；前端不直接暴露模型密钥。
- **不允许**：把主服务端换成 Express/NestJS/FastAPI，把数据层换成 JPA/Hibernate 或浏览器 IndexedDB 持久化核心答卷。
- Spring Boot 大版本与 MyBatis-Plus Starter 的具体兼容组合必须事先核对官方文档并在项目锁定；MyBatis-Plus 官方安装页：https://baomidou.com/getting-started/install/ 。

## 2. 推荐仓库目录

```text
zhiyan-ai/
├─ frontend/                # Vue3 + ECharts
│  ├─ src/pages/            # 调查者工作台、建卷、答题、结果、主题复核
│  ├─ src/components/       # 题目编辑器、题型渲染、图表、追问交互
│  ├─ src/api/              # 类型化 REST 请求
│  ├─ src/stores/           # 登录/问卷状态（Pinia）
│  └─ package.json
├─ backend/                 # Spring Boot + MyBatis-Plus
│  ├─ src/main/java/.../
│  │  ├─ controller/        # API
│  │  ├─ service/           # 业务逻辑
│  │  ├─ mapper/            # MP BaseMapper + 自定义参数化查询
│  │  ├─ entity/            # 数据库实体
│  │  ├─ dto/               # 输入/输出 DTO，不直接暴露数据库实体
│  │  ├─ ai/                # 问卷草稿、追问、主题和报告 Provider
│  │  └─ security/          # 身份鉴权、访问隔离
│  ├─ src/main/resources/db/migration/
│  ├─ src/test/
│  ├─ mvnw.cmd
│  └─ pom.xml
├─ db/                      # 数据库样例/开发脚本
├─ fixtures/                # 合成测试数据
├─ docs/                    # 需求、API、验收、研究评估
├─ evidence/                # 每阶段真实执行记录
├─ README.md
└─ .env.example
```

## 3. 最小领域表（数据库名与字段可调整，语义必须保留）

| 表/实体 | 关键属性/关系 | 首次阶段 |
|---|---|---|
| `users` | 发起者账户、密码哈希、权限 | M0/M1 |
| `surveys` | 发起者 ID、目标、草稿、关闭状态、追问预算 | M1 |
| `survey_versions` | 版本号、发布时间、不可变版本快照、公开随机 token 的哈希 | M1 |
| `questions` | 版本、稳定题 ID、题型、文本、选项、顺序、追问许可 | M1 |
| `response_sessions` | 公开调查版本、匿名会话 token 哈希、同意标记、开始/提交状态 | M1 |
| `answers` | 核心题 ID、会话、原始答案 JSON、时间；提交后不被追问覆盖 | M1 |
| `followup_decisions` | 核心回答、动作、理由、Provider/版本、预算/耗时、状态 | M3 |
| `followup_turns` | 决策、追问题文、回答/跳过、来源、时间 | M3 |
| `theme_candidates` | 调查版本、主题标签、状态、审核信息 | M4 |
| `theme_evidence` | 主题、真实回答或追问 ID、原文范围、来源类型 | M4 |
| `analysis_snapshots` | 筛选条件、问卷版本、分子分母、统计 JSON、时间 | M5 |
| `ai_jobs` | 主题归并/报告的异步任务状态、重试信息 | M4/M5 |
| `audit_events` | 审核/发布/权限操作，敏感原文不写入应用日志 | M1 起 |

**强制数据库原则**：至少保证问卷版本不可篡改、幂等提交、发起者所有权校验、公开 token 不能被简单枚举、跨表更改处于事务中。答案与主题引用都应保留准确版本关联。MyBatis-Plus 可使用 Wrapper 构造动态条件，禁止把用户原始查询字符串拼接进 SQL。

## 4. 建议的后端 API（Agent 可调整路由，但必须写明映射）

**发起者鉴权 API**

| 方法 | 路由 | 首次阶段 |
|---|---|---|
| `POST` | `/api/auth/register`、`/api/auth/login` | M1 |
| `POST` | `/api/surveys` 创建草稿 | M1 |
| `GET` | `/api/surveys` 列表；`/api/surveys/{id}` 详情 | M1 |
| `PUT` | `/api/surveys/{id}` 编辑草稿 | M1 |
| `POST` | `/api/surveys/{id}/publish` 发布并冻结版本 | M1 |
| `POST` | `/api/surveys/{id}/ai-draft` 从意图生成结构化草稿 | M2 |
| `GET` | `/api/surveys/{id}/results` 核心统计 | M1 / M5 |
| `POST` | `/api/surveys/{id}/themes/analyze` 跨人主题任务 | M4 |
| `GET` | `/api/surveys/{id}/themes` 主题/证据列表 | M4 |
| `PATCH` | `/api/themes/{themeId}` 接受/合并/改名/驳回 | M4 |
| `GET` | `/api/surveys/{id}/report` 有依据的分析报告 | M5 |
| `GET` | `/api/surveys/{id}/export` 匿名结果导出 | M5 |

**公开受访者 API**

| 方法 | 路由 | 首次阶段 |
|---|---|---|
| `GET` | `/api/public/surveys/{publicToken}` 获取发布版（无后台数据） | M1 |
| `POST` | `/api/public/surveys/{publicToken}/sessions` 同意并创建会话 | M1 |
| `POST` | `/api/public/sessions/{sessionToken}/answers` 保存核心题答案（幂等） | M1 |
| `POST` | `/api/public/sessions/{sessionToken}/followups/decide` 决策并返回是否追问 | M3 |
| `POST` | `/api/public/sessions/{sessionToken}/followups/{decisionId}/reply` 回答或跳过 | M3 |
| `POST` | `/api/public/sessions/{sessionToken}/complete` 提交（幂等） | M1 |

## 5. AI Provider 与追问决策协议

- `SurveyDraftProvider`：自然语言目标→结构化问卷草稿；输出先 Schema 校验再入草稿。
- `FollowUpDecisionProvider`：综合已有答案、已知维度、追问预算、受访者同意、上下文做结构化选择；最少包括 `RuleProvider` 与 `LlmProvider`；Jev 是后续可选适配器。
- `ThemeDiscoveryProvider`：合成/真实授权答卷→候选主题及来源定位，服务端验证引用必须存在。
- `ReportNarrationProvider`：只允许解释后端已经计算出来的统计块和审核后的主题。
- AI 失败自动降级，允许 SKIP 追问；异常时**不可阻塞问卷提交**。

建议决策 DTO：

```json
{
  "action": "EXPLORE",
  "reasonCode": "RESPONDENT_INTRODUCED_NEW_RELEVANT_FACTOR",
  "targetDimension": "同伴影响",
  "sourceAnswerId": "answer-123",
  "question": "朋友的选择具体怎样影响你去图书馆的决定？",
  "budgetBefore": 2,
  "budgetAfter": 1,
  "modelProvider": "llm-or-rule",
  "modelVersion": "record-actual-version",
  "riskFlags": []
}
```

> 示例展示协议格式，并非真实 Jev 或 LLM 调用结果。`reasonCode` 是可审计的理由类别，不能把未校准概率伪装成收益估计。

## 6. 强制 ECharts 规范

- 图表数据通过 `GET /api/surveys/{id}/results` 等后端接口获取；后端返回 `numerator`、`denominator`、`excluded` 与问卷版本等统计元信息。
- 图表实例需在 Vue 组件挂载并且容器有宽高后初始化；容器变化时 resize；组件卸载 dispose。官方说明：https://echarts.apache.org/handbook/zh/concepts/chart-size/ 。
- 所有图形同时提供数字标签或数据表供核对，避免饼图没有分母或误导性视觉。

## 7. 认证、隐私与 AI 记录

- 发起者 API 必须认证和所有权校验；会话方案（HttpOnly cookie + CSRF，或合理处理存储与续期的 token）由 Agent 记录并解释。
- 公开调查的会话 token 不允许获得其他人的答卷；限流、验证码按需配置，拒绝直接枚举公开 token。
- API 密钥仅在服务端环境变量，前端打包产物不包含密钥；日志不打印完整受访者原始回答。
- 受访者在参与前明确告知数据用途和 AI 处理，可选择拒绝 AI 追问；不要用真实敏感数据作为演示样例。
