# M5-E-NATURAL：助手先总结分析，隐藏检索中间结果

2026-10-28。本轮修复用户反馈的“换个问题仍弹出统计模板”，并按后续要求取消聊天中的问卷选择卡片和逐题统计表。本阶段结束后等待 PASS/FAIL。

## 行为与实现

- 普通回收、评分、分布、原因、需求等问题走知识库检索，再由真实 LLM 根据问题生成回答；后台统计仍是数字的唯一来源。只有明确要求图表才显示 ECharts。
- 多轮追问保留上一问题的指代上下文，重新检索事实；不会因为上一轮画过图而把“那为什么呢”再次变成图表。
- 搜索问卷在后台完成：唯一目标直接分析；多个候选可按明确名称或由模型匹配主题。选择结果必须属于本次当前用户候选集，执行前再核对所有权。无法定位时只用一句话确认名称/主题，不展示选择卡片，不随意选第一份。
- 问“有多少份问卷”只简短回答问卷数量，不把问卷目录误当成答卷统计。问卷列表、逐题表和选项明细由详情页查看；历史选择卡片也不再展示。
- 分析以文字为主，来源与覆盖范围默认折叠，保留来源核对和统计页入口。明确要求图表、原文、导出、题目时仍可使用相应功能。
- 没有修改问卷、答卷或 AI 配置；没有数据库结构变更，本轮不需要新 SQL 迁移。现有来源和数字校验、冻结发布版本、所有权隔离保持执行。

## 文件范围与提交

源码提交：`c94828d`（自然回答路由与回归）、`8b0865c`（后台定位、精简分析与展示调整）。完整路径清单见 [modified-files.txt](tduck-full/natural-reply/modified-files.txt)。

- `backend-extensions/assistant/tduck-form/.../AssistantPlanner.java`：自然回答路由、否定图表、追问上下文、候选内自动定位。
- 同目录 `AssistantChatService.java`：已保存 AUTO 计划的分派保护、后台搜索接续分析、简短澄清。
- 同目录 `SurveyKnowledgeService.java`：按当前问题决定回答长短，避免固定报告模板。
- `backend-extensions/assistant/tduck-api/.../AssistantNaturalReplyTest.java`、`AssistantAutomaticSearchTest.java`、`AssistantSimpleTest.java`：路由、候选边界、澄清、历史版本回归。
- `tduck-vue3/src/td/assistant/{knowledge,selection}.js`、`views/assistant/index.vue`：保留问题意图、图表判定、折叠依据、去除卡片及逐题表。
- `tduck-vue3/tests/unit/assistant-{natural-reply,selection,workspace}.test.js`：显示和选中目标后的意图回归。
- `scripts/tduck/assistant-natural-reply-ui.mjs`、`assistant-auto-search-ui.mjs`：真实本地应用和真实模型端到端验证。
- `docs/{DEVELOPMENT_PLAN,ACCEPTANCE_GUIDE}.md` 与本记录、`evidence/tduck-full/natural-reply/`：本轮验收资料。

## 真实执行与失败修复

补充单元文件 `backend-extensions/assistant/tduck-api/src/test/java/com/tduck/cloud/api/ai/SurveyKnowledgeTest.java` 覆盖来源选择、选项计数、简短要求和正文数字密度。

- 首次 Java 回归 5 项，1 成功 / 4 失败；前端首次 3 项全失败，复现普通统计绕过 LLM、选择问卷后丢掉原问题。
- 改造后旧用例中 4 项仍断言 AUTO 必须选择 `survey_stats`，同步为 `survey_knowledge`，保留版本和不编造数字断言。另将“查 V1 的评分”不再强改为均值，相应旧前端断言更新。
- 取消问卷选择卡片前，新增 Java 回归 2 项全失败；前端新增回归 1 失败 / 4 成功。首次新增 Java 测试因遗漏实体和 Mapper 导入编译失败，补全导入后才执行并确认这两项行为失败。
- 两次真实回收查询因模型输出未通过来源/数值校验而明确降级，没有展示未验证分析；记录在 `validation-rejection*.json`。新增回归实测 21 项中 19 成功 / 2 失败，确认数量查询携带不相关资料，以及模型改写丢失“简短一些”。随后将纯数量问题聚焦到总数来源，并保留原始用户要求；没有放松引用或数字校验。
- 实际多轮复验又触发一个合法选项数量的误拒绝：模型引用题目中的10个用途选项，但校验只认选项人数。新增回归 14 项中 13 成功 / 1 错误；补充服务端计算的选项数并随模型资料提供，未知数值仍拒绝。来源错误反馈现在会指出待修正的数值。简短请求还增加段数和长度校验，不合规会要求模型压缩后再显示。
- 人工核对真实答案发现，历史上下文中的答卷总数可能让“优先改进什么”误用数量专用检索。新增回归 16 项中 15 成功 / 1 失败，修正为只按当前用户问题判断是否仅需要总数；改进追问必须拿到题目统计和回答证据，浏览器验证也增加了这项断言。
- 视觉复核发现“把数表写成长段落”仍不符合用户要求。增加正文数字密度和长度检查：普通分析聚焦发现与建议，不逐项报数；明确要求详细统计时允许更多数值。新增回归 17 项中 16 成功 / 1 失败后修正；浏览器也检查正文数字数量。
- 完整浏览器回归还记录过“简短一些”仍过长的失败（3 项完成后失败，见 `before-editor-pass.json`）。改为先核对分析事实，再将已核对稿件交给 LLM 精简表达；精简结果重新验证来源、数字与长度。最多一次事实纠正及一次表达精简，不绕过校验或用固定话术冒充分析。
- 最终 Java **140 成功 / 0 失败 / 0 错误**；前端 **72 成功 / 0 失败**；生产构建成功，仍有原有 Sass 弃用及包体积警告。
- 最终浏览器：自然回答流程 **8 成功 / 0 失败**，自动定位与分析流程 **5 成功 / 0 失败**，两组均无页面脚本异常；已人工打开最终截图核对。真实 LLM 标识为 `group/group`。
- 使用实际用户的 AI Agent 问卷 V2（35 份模拟答卷），真实模型 `group/group`。截图问句、具体用途、原因追问、显式柱状图、否定图表、来源、刷新、390px 布局，以及不手动选问卷的定位与分析，分别记录在下列 JSON。测试只新建演示对话，不新增或修改答卷。

## 验证产物

- [截图问句的自然回答](tduck-full/natural-reply/01-recovery-answer.png)
- [具体问题与追问](tduck-full/natural-reply/02-focused-followup.png)
- [仅显式要求时出图](tduck-full/natural-reply/03-explicit-chart.png)
- [移动端文字回答](tduck-full/natural-reply/04-mobile.png)
- [自动定位后分析](tduck-full/natural-reply/05-automatic-analysis.png)
- [自然回答实测](tduck-full/natural-reply/results.json) / [后台定位实测](tduck-full/natural-reply/auto-search.json)
- [测试、封装 class 与安装 JAR 一致性](tduck-full/natural-reply/build-consistency.json) / [密钥扫描](tduck-full/natural-reply/secret-scan.json)

## PowerShell 复现与启动

```powershell
Set-Location D:\LcProject
.\scripts\tduck\Build-FullBackend.ps1 -BuildName tduck-knowledge-build
$env:JAVA_HOME='D:\jdk\jdk17'
& 'D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd' -q -f .local/tduck-knowledge-build/pom.xml '-Dtest=Assistant*Test,SurveyKnowledgeTest,KnowledgeMcpContextTest,Analysis*Test,AiSettings*Test' '-Dsurefire.failIfNoSpecifiedTests=false' clean package
.\scripts\tduck\Install-AnalysisBackend.ps1 -BuildName tduck-knowledge-build
npm run test --prefix tduck-vue3 -- --reporter=dot
npm run build --prefix tduck-vue3
node scripts/tduck/assistant-natural-reply-ui.mjs
node scripts/tduck/assistant-auto-search-ui.mjs
```

本轮在先前完整独立构建上复制最新扩展 Java 源码，然后实际执行以上 `clean package` 和安装；封装类与测试目标类逐一比较。后台已安装并运行于 `127.0.0.1:8997`。未来独立启动用 `Start-FullBackend.ps1 -Background`（8997 空闲时）；前端用 `Set-Location D:\LcProject\tduck-vue3` 后 `npm run dev -- --host 127.0.0.1 --port 5180`。

## 边界

知识库仍是第一版词片段检索，资料/上下文上限见 [M5-E](M5-E.md)。当前不是跨所有问卷自动合并分析：主题明确才选择目标，不清楚时简短确认；不会把不同版本混为同一个分母。模型不可用或校验失败明确提示，不能冒充真实模型结论。模拟答卷只用于功能测试，引用和数字检查不等于证明所有解释都正确。

复杂回答可能额外调用一次模型纠正事实格式、一次模型精简表达，比单纯查数耗时更长；这些处理不阻塞公开问卷正常答题。旧消息仍是当时快照，刷新后新的提问使用本轮流程。
