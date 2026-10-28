# M5-E-NAMED：完整问卷名称已给出却仍要求确认

2026-10-28。用户原话：`看一下大学生社团参与意愿调查的情况`。本轮只修复命名查询接续知识库的问题，结束等待 PASS/FAIL。

## 根因与修改

实际检查用户历史发现，规划器已经正确搜索 `大学生社团参与意愿调查`，后台也只找到当前账号的 `Kd12jgkg` 一份问卷，状态收集中。错误发生在搜索之后：服务还要求问题命中特定数据关键词，而“看一下……的情况”不在其中，因此明明已找到目标仍返回“不能确定”。见 [原始诊断](tduck-full/named-overview/inspection.json)。

- `AssistantChatService.java`：搜索工具已确定查询意图时，非目录查询的唯一目标直接继续执行；多个候选仍按原有定位规则处理。执行前核对所有权，不取第一份猜测。
- `AssistantPlanner.java`：识别“看看某调查的情况”等概况问题，禁止用无依据的聊天答复替代查询；同时避免新命名的“调查”误用上一份问卷。
- 新命名目标使用它自己的发布版本；上一份问卷的历史版本不会被带到新目标。用户明确指定 V1/V2 时仍按指定版本读取。知识库保留完整原问题。
- 没有修改前端、问卷题目、答卷、模型配置或数据库结构；不需要新增 SQL 迁移。当前工作区其他页面/动效改动完整保留。

完整源码路径：

1. `backend-extensions/assistant/tduck-form/src/main/java/com/tduck/cloud/form/assistant/AssistantPlanner.java`
2. `backend-extensions/assistant/tduck-form/src/main/java/com/tduck/cloud/form/assistant/AssistantChatService.java`
3. `backend-extensions/assistant/tduck-api/src/test/java/com/tduck/cloud/api/ai/AssistantNamedOverviewTest.java`
4. `scripts/tduck/assistant-named-overview-ui.mjs`

文档为本文件及 `docs/ACCEPTANCE_GUIDE.md`、`docs/DEVELOPMENT_PLAN.md`；验证产物均在 `evidence/tduck-full/named-overview/`。源码提交：`56b98f2`。

## 回归与实际执行

- 修复前新增 Java 回归 **7 项：2 成功 / 5 失败 / 0 错误**，覆盖截图原话、遗漏关键词、模型聊天编造、上下文切换和旧版本串用。
- 修复前浏览器重发截图原话：**0 成功 / 1 失败**，确实再次收到要求确认名称的回复。[失败记录](tduck-full/named-overview/before.json) / [失败截图](tduck-full/named-overview/before.png)。
- 修复后 Java 回归 **147 成功 / 0 失败 / 0 错误**。包含问卷查询、知识库、分析报告和模型配置相关用例；本轮没有前端代码改动，未重新构建其他会话正在修改的前端。
- 真实浏览器验证不手动选择问卷，使用当前账号的社团问卷 V1、AI Agent 问卷 V2，各有35份模拟答卷，模型标识 `group/group`。最终结果、模型回答、版本与来源见 [results.json](tduck-full/named-overview/results.json)。
- 最终页面验证 **5 成功 / 0 失败**，无页面脚本错误；已实际打开 [截图原话的修复效果](tduck-full/named-overview/01-exact-question.png) 检查。场景包括原话、追问、指定另一份 V2、切回 V1、刷新保持。
- 封装的 Planner、ChatService 和知识库类与测试产物逐个比较，安装 JAR 的 SHA256 与测试构建一致：[build-consistency.json](tduck-full/named-overview/build-consistency.json)。
- [单元回归计数](tduck-full/named-overview/unit-tests.json)；本轮源码、文档和全部验证产物的实际密钥匹配检查为0：[secret-scan.json](tduck-full/named-overview/secret-scan.json)。

## 执行命令与启动

在上一阶段完整隔离构建上复制本轮最新扩展 Java 源码后实际执行：

```powershell
Set-Location D:\LcProject
$env:JAVA_HOME='D:\jdk\jdk17'
& 'D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd' -q -f .local/tduck-knowledge-build/pom.xml '-Dtest=Assistant*Test,SurveyKnowledgeTest,KnowledgeMcpContextTest,Analysis*Test,AiSettings*Test' '-Dsurefire.failIfNoSpecifiedTests=false' clean package
.\scripts\tduck\Install-AnalysisBackend.ps1 -BuildName tduck-knowledge-build
node scripts/tduck/assistant-named-overview-ui.mjs
```

修复前实际执行过 `node scripts/tduck/assistant-named-overview-ui.mjs --baseline` 并记录失败；当前版本无需再执行该基线命令。从上游重建可先运行 `Build-FullBackend.ps1 -BuildName tduck-knowledge-build`，再执行测试与安装。后台已更新至 `127.0.0.1:8997`；独立启动用 `Start-FullBackend.ps1 -Background`（端口空闲时）。前端沿用现有5180服务；需要自行启动时，在 `D:\LcProject\tduck-vue3` 执行 `npm run dev -- --host 127.0.0.1 --port 5180`。

## 验收与边界

刷新后新建对话，原样发送 `看一下大学生社团参与意愿调查的情况`。应直接得到基于35份模拟答卷的分析，有可核对来源，不要求再提供名称或点击问卷卡片。继续追问保持社团问卷；改说 AI Agent 问卷 V2 时切换目标，再说社团问卷时返回它的 V1。

重名且无法定位、名称不匹配、无所有权时仍需澄清或拒绝；不会为消除提示而随意选择。模型不可用或校验失败仍会明确提示，不把模板冒充模型分析。旧消息保留原快照，修复效果通过新提问检验；模拟数据不代表真实研究结论。
