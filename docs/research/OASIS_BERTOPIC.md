# OASIS / BERTopic 源码调研分报告

调研日期：2026-10-23（Asia/Shanghai）。本报告是 `OPEN_SOURCE_RESEARCH.md` 的事实来源之一，只描述机制，不复制或集成第三方实现，不改变知研 AI 的 Vue 3 + ECharts、Spring Boot + MyBatis-Plus、MySQL 8.x 技术栈。

## 取证范围与状态

| 仓库 | 已核对分支 | 固定 commit SHA | 取得方式 |
|---|---|---|---|
| https://github.com/oasis-surveys/oasis-platform | `main` | `057305dd04d9d5c42b9f3387b393dcc0a34ee214` | GitHub 只读连接器：仓库元数据、commit、递归源码树、固定 SHA 的文件内容 |
| https://github.com/MaartenGr/BERTopic | `master` | `9036123c97aaa9a6cc4bec4a6db1a7caf9209df6` | 同上 |

本机原有 `.local/research/oasis-platform-clone.log` 与 `BERTopic-clone.log` 均记录 GitHub 443 连接失败；本次各重试一次 `git clone --depth 1`，仍返回 `curl 28` / `expected flush after ref listing`，退出码 1。随后通过 GitHub 连接器成功读取真实源码，不能将 clone 失败误写为没有源码证据。未安装、构建、运行这两个仓库，未执行其测试；下文“已验证”仅指静态源码已读，不代表真实模型或运行质量通过测试。这里没有引用不存在的本地 clone 文件作为取证完成证明。

状态口径：**源码已验证**＝所列固定版本实现或测试内容已读取；**仅 README 声称**＝本次未沿对应实现核查；**尚未验证**＝未运行/未检查到完整路径，不能据此断言全仓库绝无该能力。尤其“不足以证明知研 AI 要求”不等于“项目完全没有相近功能”。

## 1. OASIS：访谈协议与追问边界

### 1.1 实际技术栈、目录、数据结构

**源码已验证**：前端 React 18.3、TypeScript、Vite 5、Tailwind；服务端 Python FastAPI 0.115.6、SQLAlchemy 2 异步 ORM、Alembic；数据库 PostgreSQL 16 + pgvector，Redis 5.2 客户端；访谈用 Pipecat、OpenAI / LiteLLM，并有语音 STT/TTS、Twilio 相关依赖。不是 Vue / Spring Boot / MyBatis-Plus / MySQL 项目，不可作为知研 AI 直接工程底座。

主要目录：`frontend/src/pages/` 管理页与访谈页；`backend/app/api/` HTTP/WebSocket 入口；`models/`、`schemas/` 持久化及校验；`pipeline/` 访谈协议与语音处理；`engagement/` 参与度与自适应规则；`knowledge/` 研究背景资料 RAG；`backend/alembic/versions/` 迁移；`backend/tests/` 测试。

| 证据 | 固定版本文件与行号 | 已读结论 |
|---|---|---|
| O1 | [frontend/package.json:7–30](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/frontend/package.json#L7-L30) | React/Vite/TypeScript，未以 Vue/ECharts 为前端底座 |
| O2 | [backend/requirements.txt:1–29](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/requirements.txt#L1-L29)、[docker-compose.yml:31–65](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/docker-compose.yml#L31-L65) | FastAPI/SQLAlchemy、PostgreSQL/pgvector/Redis、Pipecat/LiteLLM |
| O3 | [backend/app/models/agent.py:18–57](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/models/agent.py#L18-L57)、[同文件:167–178](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/models/agent.py#L167-L178) | Agent 归属于 Study；访谈可 free_form / structured，guide 以 JSON 存储 |
| O4 | [backend/app/schemas/agent.py:16–55](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/schemas/agent.py#L16-L55) | 主问题 `text`、预设 `probes[]`、每题 `max_follow_ups`（0–10）、transition、closing、ordered/relevance 选择策略 |
| O5 | [backend/app/models/session.py:40–69](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/models/session.py#L40-L69)、[同文件:118–173](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/models/session.py#L118-L173) | Session 状态/参与者/耗时，TranscriptEntry 按会话、角色、sequence 保存原文及 token 用量；汇总 token 是计量，不是追问预算 |

### 1.2 真正实现了什么

1. **动态追问：已实现有限形式，不能等同于知研 AI 的开放式新线索探索。** `build_structured_prompt` 将预设主问题与 probes 放进上下文。`ordered` 按序，`relevance` 让模型依据当前回答选择最相关、未用过的一条预设 probe；两种模式都明确禁止自行发明额外 probes。因此“回答相关的预设追问选择”有真实实现，但这条结构化路径不是依据受访者自发新线索生成任意 `EXPLORE`。free_form 模式存在，但其新线索发现质量与中立性未实际测试。[O4；[interview_guide.py:308–365](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/pipeline/interview_guide.py#L308-L365)]
2. **每题预算：有计数器和推进提示，严格保证范围有限。** `TextStructuredController` 保存当前题号、题内机器人回合数、待推进标记；`1 + max_follow_ups` 达上限后，在下一次实质回答到达时注入推进/结束指导。澄清/请求重复被正则识别后不扣次数。语音 `InterviewGuideProcessor` 还避免欢迎词、等待中的沉默提示重复扣次数。它们是控制进度的内存状态与提示注入，不能直接称为数据库事务硬拦截所有生成的追问。[interview_guide.py:[689–740](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/pipeline/interview_guide.py#L689-L740)、[788–839](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/pipeline/interview_guide.py#L788-L839)、[930–1040](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/pipeline/interview_guide.py#L930-L1040)]
3. **全问卷全局预算：在已核查 guide schema、controller、Session 与 text loop 中尚未验证到。** 每题上限之和不是跨题可分配、刷新/重试不重复扣费的全局预算；`total_tokens` 也不是追问次数上限。controller 在每个 WebSocket 会话中初始化，已读模型未提供知研 AI 所需的预算扣减台账/幂等键。不能仅据这些文件断言所有分支和未来版本都没有。
4. **单轮输出守卫：有真实代码。** 文本和流式路径对第一句问句之后的额外内容进行截断；文本端同步截断上下文，避免模型以为受访者看到了被删掉的第二个问题。隐藏 `[[Qn]]` 进度标签会剥离，并允许 controller 向前同步。这是文本形式守卫，不能证明无诱导或完整语义正确。[interview_guide.py:[465–584](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/pipeline/interview_guide.py#L465-L584)、[654–685](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/pipeline/interview_guide.py#L654-L685)；[text_chat.py:856–886](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/api/text_chat.py#L856-L886)]
5. **停止策略：协议级收尾、时间停止已读，语义信息增益停止未验证。** controller 在最后一题预算用完后置 `_closed` 并提示模型收尾；已读文本 loop 并未检查 `is_finished` 后直接 break，因此不能把 `_closed` 等同于 WebSocket 强制关闭或模型绝不继续。该 loop 对总时长超限和等待用户超时则明确发送 ended 并 break。每题提前不问的理由主要仍由提示中的“已明确覆盖”交给模型判断，未见知研 AI 所需的 `SKIP / CLARIFY / DEEPEN / EXPLORE` 结构化理由与信息收益判定表。[interview_guide.py:[419–431](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/pipeline/interview_guide.py#L419-L431)、[956–994](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/pipeline/interview_guide.py#L956-L994)；[text_chat.py:757–787](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/api/text_chat.py#L757-L787)、[835–946](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/api/text_chat.py#L835-L946)]
6. **自适应参与度：确有规则引擎，但不是语义新维度算法。** `AdaptivePolicyEngine.evaluate` 将持续脱离、长延迟、very_short_answer 等触发映射到 offer_break、soften_next_probe、encourage_elaboration、调语速等动作，有冷却期、每轮最多一种提示动作/一种语速动作。shadow 只记，live 注入，`AdaptiveAction` 持久化 trigger/action/mode/detail。不能把短回答参与度规则当成“语义判断是否缺信息”。部分默认文案包含肯定、镜像等交流风格，不应未经方法审查照搬到中立问卷。[adaptive.py:[18–111](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/engagement/adaptive.py#L18-L111)、[227–261](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/engagement/adaptive.py#L227-L261)；[text_chat.py:438–489](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/api/text_chat.py#L438-L489)]
7. **跨受访者主题聚合：尚未验证。** 已读 `api/analytics.py` 是按 study/agent 聚合会话数、完成/错误/超时、话语条数、时长，不是跨人语义主题。`knowledge/embeddings.py` 切分上传背景文档，用 pgvector 检索并给访谈提供 RAG，不是从不同受访者答案抽取新主题，更没有来源四分类、按独立人次去重与人工主题复核证据。不能因为有 embedding/analytics 就宣称实现了 M4。[analytics.py:61–88](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/api/analytics.py#L61-L88)；[embeddings.py:165–210](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/knowledge/embeddings.py#L165-L210)、[225–262](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/app/knowledge/embeddings.py#L225-L262)。

**源码测试已读但未运行**：[test_interview_guide.py:750–844](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/backend/tests/test_interview_guide.py#L750-L844) 对题内预算、澄清不扣次数、推进、最后题收尾、标签单向同步有断言。它证明作者编写了这些测试，不证明本次运行通过，更不证明模型持续遵从协议。

**仅 README 声称/未完整核查的范围**：[README.md:64–71](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/README.md#L64-L71) 的多供应商全覆盖、语音到语音、电话 beta、导出等端到端能力，本次未逐条运行；已验证的结构化追问与 adaptive 机制不再归入“仅 README”。

### 1.3 与知研 AI 的差距、许可证

可借鉴的是“研究项目—受访会话—逐轮原文”的分层、模板 guide、单问守卫、澄清不消耗追问、每次干预记日志、shadow 先观察后启用及超时状态。知研 AI 仍需自行实现固定核心问卷与发布版本冻结、四题型常规提交、原答案/追问独立表、按调查所有权授权、拒绝 AI 与跳过、结构化语义决策、全卷持久化幂等预算、无 AI 的完整提交路径，以及主题证据归因和人次口径。这些不是把聊天循环搬到 Vue 后就自然具备。

许可证 **AGPL-3.0** 已核对 [LICENSE](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/LICENSE#L1) 与 [NOTICE:1–20](https://github.com/oasis-surveys/oasis-platform/blob/057305dd04d9d5c42b9f3387b393dcc0a34ee214/NOTICE#L1-L20)。若未来复制/改造分发，需要保留许可/版权并遵守对应源码要求；修改版供网络用户交互涉及第 13 节提供对应源码的义务，学术用途不自动豁免。NOTICE 的通俗说明不替代 LICENSE 法律文本；本次只做机制研究，无第三方代码、prompt 原文或界面素材集成。

## 2. BERTopic：通用主题建模，不等于可信问卷主题系统

### 2.1 实际技术栈和关键目录

**源码已验证**：这是 Python 主题建模库，当前 `pyproject.toml` 版本 `0.17.4`、Python ≥3.10，主要依赖 sentence-transformers、umap-learn、hdbscan、scikit-learn、numpy、pandas、Plotly。不是问卷前后端平台，没有可直接替代 Spring Boot/MyBatis-Plus 的业务后端。`bertopic/backend/` 是 embedding 适配，`dimensionality/`、`cluster/` 是算法接口，`vectorizers/` 负责词袋与 c-TF-IDF，`representation/` 可细化主题表示，`plotting/` 为 Plotly 图表，`tests/` 为算法测试。知研 AI 图表仍必须 ECharts，不引入 Plotly 代替。

| 证据 | 固定版本文件与行号 | 已验证机制 |
|---|---|---|
| B1 | [pyproject.toml:5–49](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/pyproject.toml#L5-L49) | 库版本、Python 与算法依赖；Windows 为包声明支持的平台，但本次未安装验证 |
| B2 | [bertopic/_bertopic.py:250–293](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py#L250-L293) | CountVectorizer/c-TF-IDF；默认 UMAP，导入失败可 PCA；HDBSCAN 或 sklearn HDBSCAN；组件可替换 |
| B3 | [bertopic/_bertopic.py:448–524](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py#L448-L524) | 文档行 ID→embedding→降维→聚类→按频次映射→主题词表示；不是按人次自动识别 |
| B4 | [bertopic/vectorizers/_ctfidf.py:54–113](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/vectorizers/_ctfidf.py#L54-L113) | 主题词频 L1 归一化后乘 IDF；可 BM25 类权重、降低高频词、seed 词加权 |
| B5 | [bertopic/_bertopic.py:4010–4058](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py#L4010-L4058) | zero-shot：预设主题 embedding 与文档余弦相似度达阈值即归类，剩余文档另聚类（衔接见 B3） |
| B6 | [bertopic/_bertopic.py:1734–1824](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py#L1734-L1824) | document info 可附 metadata、主题、代表文档标志、聚类概率；metadata 由调用者提供 |
| B7 | [bertopic/_bertopic.py:4235–4311](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py#L4235-L4311) | 代表文档从主题内固定种子抽样，用 c-TF-IDF 余弦相似度选择，可选 MMR 增加多样性；内部可返回行索引 |
| B8 | [bertopic/_bertopic.py:4455–4462](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py#L4455-L4462)、[同文件:1664–1695](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py#L1664-L1695) | topic size 是 Counter(document.Topic)，Count 是文档条数；代表文档另附 |
| B9 | [bertopic/backend/_utils.py:140–147](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/backend/_utils.py#L140-L147) | 多语言 embedding 模型选择存在；不等于中文短答聚类效果已验证 |

### 2.2 能力核实和研究价值

- **动态追问、全问卷追问预算、受访停止：未在已读库入口/主题建模实现中验证到。** 输入是文档列表和可选 embedding/标签，输出是主题归属与概率；它不是交互式调查状态机。README 的 “Dynamic Topic Modeling” 是按 timestamps 的 `topics_over_time`，不是动态向人追问；“Online” 是批次增量训练，也不是在线访谈停止。
- **跨文档主题聚合：源码已验证。** 不同受访者的语义单元可以作为文档输入，embedding 聚类能归并词面不同的表达，c-TF-IDF 给出主题描述；零样本预设主题+剩余文档聚类可作为“已覆盖维度与候选未覆盖维度”的实验设计参考。但“未匹配预设主题”还可能是离题、噪声或 embedding 偏差，不自动等于有研究价值的新维度（B3、B5）。
- **证据能力：仅通用文档映射的一部分已验证。** B6/B7 保留每文档主题与代表文档，调用者可以加来源 metadata；内部行 ID 是本次列表位置，不是数据库不可变 `answerId`，公共代表文档主要是字符串。`get_representative_docs` 本身说明并未保留主题下全部输入文档（[_bertopic.py:1826–1840](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py#L1826-L1840)）。不能只存前几条代表句就声称全量证据链完成。
- **可信人次/来源治理：未验证到问卷专用实现，已验证默认 Count 的口径不同。** 同一人原回答+两条追问拆成三个文档时，B8 的 Count 可计三条；知研 AI 必须按 `(surveyVersionId, themeId, respondentSessionId)` 去重，再区分自发/中立追问/选项提示/模型未确认，并计算暴露条件下的有效分母。聚类 probability 不能解释为总体持该观点的比例，代表文档也不是频率样本。
- **人工合并可参考算法 API，不可冒充审核系统。** 类中有 `merge_topics`（[入口:2101](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py#L2101)），但本次没有运行其合并/保存与历史迁移；不能据 API 名称就宣称有知研 AI 的接受/驳回/重命名、审核人、审计与刷新后持久化。
- **在线训练有限条件已验证。** `partial_fit` 要求降维器/聚类器支持增量训练，并配合 OnlineCountVectorizer，注释建议批次而非逐文档（[649–678](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/bertopic/_bertopic.py#L649-L678)）；默认组件组合不可未经验证就假定能在线更新。

**源码测试已读但未运行**：[test_ctfidf.py:23–54](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/tests/test_vectorizers/test_ctfidf.py#L23-L54) 验证矩阵形状等；[test_class.py:19–29](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/tests/test_variations/test_class.py#L19-L29) 明确频次和等于文档数量，进一步支持不能直接等同受访人数。没有执行中文合成问卷或 M4 验收用例，因此不能给发现准确率或声称已成功发现“同伴影响”。

**仅 README 声称/本次未沿全部实现验证**：[README.md:265–276](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/README.md#L265-L276) 的所有主题变体、层次主题、模型合并与可视化完整行为。核心 embedding/聚类/c-TF-IDF、zero-shot、文档映射、增量接口条件已有上述源码证据；不应一概降为 README 证据。

### 2.3 差距和许可证

BERTopic 适合作为 M4/M6 的**算法机制参照或未来另行授权的离线基线**，不是本次新增 Python 生产服务的授权。知研 AI 仍须在 Spring Boot 业务层治理证据 ID、原文范围、问卷版本、同意状态、来源类别、独立人次、人工审核、失败恢复与参数版本。中文分词、短文本稀疏性、小样本（如 8 份）与默认聚类规模、离题/异常值、随机性、模型下载和 Windows 依赖均需专门实验；本次没有验证其效果，也未下载权重。

许可证 **MIT** 已核对 [LICENSE:1–21](https://github.com/MaartenGr/BERTopic/blob/9036123c97aaa9a6cc4bec4a6db1a7caf9209df6/LICENSE#L1-L21)：允许使用、修改、分发等，复制或实质部分需保留版权及许可声明，无保证。MIT 不覆盖第三方 embedding 模型权重、数据集、外部服务的独立许可证/使用条款。本次未复制或集成实现，未下载数据集或模型。

## 3. 按 M0–M6 的参考建议（只提建议，不提前实现）

| 阶段 | OASIS 可借鉴与边界 | BERTopic 可借鉴与边界 |
|---|---|---|
| M0 | 借鉴配置与健康、迁移、会话状态分层思想；保持 Windows / MySQL 真联通，不引入其 React/FastAPI/PostgreSQL/Redis 依赖 | 仅登记算法候选和许可，不安装、不接生产服务，不影响无 AI 工程启动 |
| M1 | 借鉴 Study→Session→Transcript 分层和匿名识别；自主完成四题型、冻结版本、所有权及幂等提交，聊天协议不能代替问卷闭环 | 预留不可变 answer/session/version/source 关联，不需要主题算法 |
| M2 | 借鉴配置校验和 Provider 统一入口概念；问卷生成要 Schema 校验、人工编辑，禁止直接发布 | 预设维度可以结构化保存，供将来比较，不将预设主题强塞给受访者 |
| M3 | 参考每题上限、澄清不扣、单问守卫、shadow 审计；另写语义决策和全卷事务预算，跳过/拒绝 AI/超时不能阻塞普通问卷；不复制提示词与实现 | 不用于追问决策或停止，聚类相似度不是下一次追问的信息增益 |
| M4 | 以逐轮原文定位思想建证据链；其 RAG 与会话 analytics 不能当成新维度发现 | 参考 embedding 聚类、c-TF-IDF、预设匹配后剩余聚类；另做来源四分类、证据合法性、人次去重、离题过滤、人工复核；小样本先评估 |
| M5 | 参考后端明确计算状态分布；注意其 study 平均时长是各 agent 均值再平均（analytics.py:133–141），多组样本数不同时不能直接照用 | 展示文档数/受访人数不同口径；代表句可导航但不代替全量证据。数值由 Java/SQL 算，Vue/ECharts 渲染，不以 Plotly 替代 |
| M6 | 可参考协议遵从计数、shadow/live 实验及干预记录；真正对照仍需相同全局预算、独立盲评与退出/诱导指标，不能用参与度规则自证创新 | 可讨论作为另行批准的离线主题基线；记录输入单元、embedding、分词、聚类参数、seed、离群策略和版本，与人工主题/证据支持率比较，不把主题数更多当更好 |

复用结论：OASIS 对 M3 的协议边界、轮次保护、可审计自适应有直接机制参考；BERTopic 对 M4 的通用语义归并和主题表示有直接算法参考。两者都不能证明已完成知研 AI 的“固定核心问卷 + 全卷幂等预算 + 来源可靠的人次级新维度发现”组合；本项目研究价值应通过 M6 对照验证，不宣称“其他项目从未实现”。
