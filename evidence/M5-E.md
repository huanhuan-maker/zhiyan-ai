# M5-E｜问卷知识库与有来源的 LLM 分析

本轮源码提交：`9f28a3b`（`feat(tduck): add survey knowledge retrieval and grounded AI answers`）。本地现有 5180 / 8997 入口已更新，数据库迁移已执行；本轮完成后等待用户验收。

## 实际交付

- 侧栏增加“问卷知识库”，资料集、同步状态、资料数量、发布版本切换、检索预览和“带着问题去问助手”。
- MySQL 表 `fm_survey_knowledge` 持久化账号/问卷/版本隔离的资料快照、数据指纹和同步时间，经 MyBatis-Plus 访问。查询前检测变化，更新资料。
- 助手新增 MCP `survey_knowledge`：先同步和检索，再将相关片段与真实后端统计发送给当前 LLM；输出分析段落、有效来源及覆盖范围，保存为可重新加载的历史。
- 修复总结问题被当成读取草稿/审核报告的问题，保留已有图表、管理预览、确认与其他查询工具。
- MCP 已验证身份绑定到统一模型配置调用的请求上下文，结束后恢复，不留在线程里。
- 模型上下文按实际配置预算分配，选择完整资料而非截断原文；展示实际提供多少题统计。来源、数值与不同答卷计数有校验；模型输出首次不合格时最多重试一次。
- 当前用户账号四份问卷已同步，各 35 份答卷，总计 355 个背景/开放回答片段。AI Agent 问卷是 V2、229 个片段；社团 V1、39 个；电子设备 V1、44 个；外卖原因 V1、43 个。包含模拟测试答卷，页面和模型回复均有标注。

完整源码文件见 [文件清单](tduck-full/knowledge/file-manifest.txt)，范围与启动方式见 [本轮说明](../docs/SURVEY_KNOWLEDGE_STAGE.md)。另外更新了开发计划和验收指南；其他已有截图改动未加入本轮提交。

## 实际验证

| 验证 | 成功 | 失败 | 说明 |
|---|---:|---:|---|
| Java 单元与回归 | 123 | 0 | Assistant、Analysis、AiSettings、知识库和 MCP 请求身份 |
| 前端 Vitest | 67 | 0 | 包含总结意图保留、版本与引用编号显示 |
| HTTP / MySQL / MCP | 9 | 0 | 落库、检索、脱敏、越权、真实模型、历史、数据更新、版本和归档 |
| 浏览器完整流程 | 8 | 0 | 当前账号四份问卷、来源预览、传递上下文、真实模型总结、来源弹窗、刷新、390px |
| 最终视觉回放 | 4 | 0 | 复用已有真实回答，校验完成后不再显示等待、来源弹窗深色对比、动画稳定后截图和移动宽度；不再调用模型 |
| 前端生产构建 | 通过 | — | 保留已有 Sass 弃用和大包提示 |
| 产物一致性 | 通过 | — | 已安装 JAR 与测试构建一致，4 个关键 class 与实际测试 class 一致 |

真实模型标识：供应商“本机推理网关”，配置模型 `group/group`，`OPENAI_CHAT`。没有保存或展示 API Key。小问卷通过完整聊天/MCP流程生成真实分析，见 [真实模型结果](tduck-full/knowledge/model-answer.json)。当前用户 54 题 AI Agent 问卷也已通过真实浏览器分析，本次实际提供 36 / 54 道题统计、12 条资料，页面明确展示覆盖范围。

本轮曾真实遇到并修复的失败：

1. 原路由回归：7 项中 1 项失败，证明“总结问卷”走旧报告/题目路径；增加知识库工具与意图路由后通过。
2. 首次 HTTP 验证 7 成功 / 2 失败：增量重打包保留旧 Planner，改为 clean package 并比较封装 class 后消除；保留 [首次接口失败](tduck-full/knowledge/api-before.json)。
3. MCP 模型调用缺身份：新增回归 1 项失败，绑定已认证请求上下文后通过。
4. 模型数值校验误拒绝真实引用编号，以及等值小数、不同受访者支持数；分别复现 1 项错误、2 项错误，修复后包括重复同一答卷不得算两人的测试均通过。
5. 54 题问卷在当前 32768 上下文/8192 输出配置下超预算，首次完整浏览器流程 4 项完成后失败。加入按预算选择完整来源与覆盖提示后 8 项通过；保留 [失败记录](tduck-full/knowledge/ui-before.json) 和 [当时截图](tduck-full/knowledge/00-context-budget-failure.png)。
6. 视觉复核修正来源弹窗对比度、截图时的入场动画，以及成功回复后仍残留等待提示的问题；最终回放通过。

## 截图与结果

- [知识库桌面](tduck-full/knowledge/01-knowledge-desktop.png)
- [真实分析对话](tduck-full/knowledge/02-grounded-chat.png)
- [知识库移动布局](tduck-full/knowledge/03-knowledge-mobile.png)
- [可点击来源](tduck-full/knowledge/04-source-dialog.png)
- [接口验证](tduck-full/knowledge/api.json) / [浏览器验证](tduck-full/knowledge/ui.json) / [最终视觉回放](tduck-full/knowledge/visual.json)
- [产物一致性](tduck-full/knowledge/build-consistency.json) / [本轮密钥检查](tduck-full/knowledge/secret-scan.json)

## 执行命令

```powershell
Set-Location D:\LcProject
.\scripts\tduck\Apply-AssistantMigration.ps1
.\scripts\tduck\Build-FullBackend.ps1 -BuildName tduck-knowledge-build
# 开发中将最新跟踪的扩展源码复制到独立构建后，最终执行 clean package，避免重复 repackage 保留旧类。
$env:JAVA_HOME='D:\jdk\jdk17'
& 'D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd' -q -f .local/tduck-knowledge-build/pom.xml '-Dtest=SurveyKnowledgeTest,KnowledgeMcpContextTest,Assistant*Test,Analysis*Test,AiSettings*Test' '-Dsurefire.failIfNoSpecifiedTests=false' clean package
.\scripts\tduck\Install-AnalysisBackend.ps1 -BuildName tduck-knowledge-build
.\scripts\tduck\New-AcceptanceFixture.ps1 -FixturePath '.local\knowledge\acceptance.json'
node scripts/tduck/knowledge-api.mjs
node scripts/tduck/knowledge-ui.mjs
node scripts/tduck/knowledge-visual.mjs
npm run test --prefix tduck-vue3 -- --reporter=dot
npm run build --prefix tduck-vue3
```

独立构建不修改上游目录；服务启动仍用 `Start-FullBackend.ps1 -Background`，已通过安装脚本启动。前端启动：`Set-Location D:\LcProject\tduck-vue3` 后 `npm run dev -- --host 127.0.0.1 --port 5180`。测试使用新建的隔离账号，其新增测试问卷最后归档；UI只同步用户已授权的四份资料集并创建演示对话，不修改这些问卷的题目或答卷。

## 已知边界与验收

- 这是第一版字符片段检索 RAG，不声称向量语义检索。没有 Wiki 编纂、跨问卷综合或群体交叉统计。
- 最多 5000 份单版本答卷，入库开放回答上限 200 条、单条 2000 字、总计 60000 字；超限显示未入库数。按当前模型预算选择完整片段和部分统计，不能宣称看过所有原文或所有题目的统计。
- 索引在手动同步/检索/分析前刷新，没有后台持续同步；列表数量是上次索引的快照。明确个人信息题目会排除，常见联系方式会遮蔽，但不能保证自由文本完全匿名化。
- 引用与数字检查不等于证明每条语义推断正确，模型归纳仍需沿来源核对，也不会自动成为已审核报告。模拟数据只能验证功能，不能用于真实研究结论。
- 刷新工作台进入“问卷知识库”，选择 AI Agent 问卷，检索后点击“带着这个问题去问助手”，发送总结请求。检查真实生成标识、引用和覆盖范围。本轮停在此处等待用户 PASS/FAIL。
