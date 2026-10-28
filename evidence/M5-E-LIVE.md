# M5-E-LIVE：模型生成时实时吐字与近义问卷定位

2026-10-28。本轮同时处理两个用户反馈：回答需要在模型生成时逐步出现；“大学生点外卖那份”不能因不等于完整标题就被判定没找到。旧 [M5-E-STREAM](M5-E-STREAM.md) 仅校验后拆块，本轮取代它的生成路径。

源码提交：`6736e1f`。本轮只提交模型流、近义定位和草稿显示的改动；同一组件里并行添加的其它 UI 组件/动效保留在工作区，没有混入这次提交。

## 实现

上游请求启用 `stream:true`，边读供应商 SSE 边提取公开回答文字，再经当前客户端 SSE 推送；没有延时打字动画，也不等待上游完成再拆字。支持 OpenAI Chat、Responses、Anthropic Messages 的正文增量事件；忽略 reasoning/thinking 和工具规划 JSON。协议依据 [OpenAI Docs](https://developers.openai.com/api/docs/guides/streaming-responses) 和 [Anthropic 文档](https://platform.claude.com/docs/en/build-with-claude/streaming)。当前真实模型实测是配置中的 `group/group`，另外两种协议做了解析夹具测试，未声称真实供应商连通。

页面先显示明确标注的“模型正在生成 · 草稿尚未核对”。完整输出仍需通过原有来源、数字和表达检查；纠正/精简后，用正式回答替换草稿。草稿不是已审核结论，不存为正式历史；失败或刷新时只恢复已保存结果。请求线程 finally 清除流上下文，离开页面中止客户端读取；同步推理不保证同时取消。推理模型开始输出正文之前仍可能等待，输出节奏取决于上游，并不强制每帧恰好一个汉字。

标题精确搜索为空后，查询当前用户未删除的问卷标题，按字符词片段的区分度排名，再由模型在受限候选内判断目标。不是硬编码“点外卖”的替换规则，也不冒充向量检索。最多扫描1000份自身问卷、提供30个候选；超范围要求缩小条件。候选和最终执行均核对所有权。带明确状态/日期过滤的查询不会被无条件放宽；真正重名/主题不明仍需澄清，不随机选第一份。

## 源码清单

- `backend-extensions/ai-config/tduck-form/src/main/java/com/tduck/cloud/form/aiconfig/AiTransport.java`
- 同目录 `LiveAnswer.java`
- `backend-extensions/ai-config/tduck-form/src/main/java/com/tduck/cloud/form/ai/OpenAiCompatibleProvider.java`
- `backend-extensions/assistant/tduck-api/src/main/java/com/tduck/cloud/api/web/controller/AssistantController.java`
- `backend-extensions/assistant/tduck-form/src/main/java/com/tduck/cloud/form/assistant/AssistantPlanner.java`
- 同目录 `AssistantChatService.java`、`AssistantTools.java`、`SurveyKnowledgeService.java`
- `backend-extensions/assistant/tduck-api/src/test/java/com/tduck/cloud/api/ai/AiSettingsStreamingTest.java`、`AssistantSemanticFallbackTest.java`
- `tduck-vue3/src/td/views/assistant/index.vue`
- `scripts/tduck/assistant-token-live-ui.mjs`

没有新增 SQL 或依赖；没有改问卷题目、答卷和模型配置。已有其它页面改动未撤销、不纳入本轮提交。

## 真实验证

首次测试夹具复用了不同 Mapper 的命名空间而出错（初次全量152项，151成功/1错误），先修正夹具。用修复前的 ChatService 在隔离构建执行近义回归，2项中1成功/1失败，证实精确检索为空即停下；新实现通过。上游流测试用管道与闩锁证明“源尚未关闭时已触发文字回调”，并覆盖 Unicode/转义、三协议正文解析、忽略思考、截断不算完成。

最终 Java **154 成功 / 0 失败 / 0 错误**；前端 **75 成功 / 0 失败**；生产构建成功，仍有既有 Sass/包体积提示。真实页面 **6 成功 / 0 失败**，无页面脚本错误，已打开截图检查。普通聊天和问卷分析均断言：草稿文字增长时发送按钮仍在处理中，draft事件早于正式answer事件，最终结果被保存，刷新无残留草稿。

实测首次普通聊天：3743ms出现正文、6430ms正式回答、498条draft增量；问卷：5499ms出现正文、6999ms正式回答、302条增量，原始记录见 [first-run.json](tduck-full/token-live/first-run.json)。这是该次实测，不是固定性能承诺。输入“帮我查看大学生点外卖那份问卷的情况”最终定位 `dUJev0eA`，35份答卷，真实模型 `group/group`。

复验脚本曾错误读取对话“最后一条”，也曾用浏览器全局事件缓存/等待完整 SSE response.body 取样，产生1成功/1失败、3成功/1失败和等待挂起。已经按本次请求ID对齐结果，直接检查原生草稿文字在请求未结束时增长，并检查 SSE 响应类型、最终数据与刷新；没有以打字动画代替验收。相关失败取样保留在同目录，最终结果为6项通过。后端上游事件未结束即回调的闩锁测试和首次真实网络事件记录均保留。

- [普通聊天生成中](tduck-full/token-live/chat-generating.png)
- [问卷生成中](tduck-full/token-live/knowledge_answer-generating.png)
- [外卖问卷正式分析](tduck-full/token-live/final-answer.png)
- [最终页面、正文首显和完成耗时](tduck-full/token-live/results.json)
- [最终构建/安装一致性](tduck-full/token-live/build-consistency.json) / [单元测试计数](tduck-full/token-live/unit-tests.json) / [密钥扫描](tduck-full/token-live/secret-scan.json)

## PowerShell 与验收

在现有隔离构建复制最新 `assistant`、`ai-config` Java 扩展后，实际执行：

```powershell
Set-Location D:\LcProject
$env:JAVA_HOME='D:\jdk\jdk17'
& 'D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd' -q -f .local/tduck-knowledge-build/pom.xml '-Dtest=Assistant*Test,SurveyKnowledgeTest,KnowledgeMcpContextTest,Analysis*Test,AiSettings*Test' '-Dsurefire.failIfNoSpecifiedTests=false' clean package
.\scripts\tduck\Install-AnalysisBackend.ps1 -BuildName tduck-knowledge-build
npm run test --prefix tduck-vue3 -- --reporter=dot
npm run build --prefix tduck-vue3
node scripts/tduck/assistant-token-live-ui.mjs
```

全新隔离构建先执行 `Build-FullBackend.ps1 -BuildName tduck-knowledge-build`。后端已安装在8997；独立启动用 `Start-FullBackend.ps1 -Background`（端口空闲时）。前端在 `D:\LcProject\tduck-vue3` 执行 `npm run dev -- --host 127.0.0.1 --port 5180`。刷新后新建对话问一段普通问题，再发送截图中的外卖问题，应在模型结束前看到文字增长，完成后显示来源。本轮结束等待 PASS/FAIL。
