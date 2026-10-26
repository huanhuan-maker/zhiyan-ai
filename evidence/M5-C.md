# M5-C｜简单对话：聊天与问卷查询（2026-10-25）

用户反馈发送“你好”无反应，截图中的AI确认复选框未勾选。旧页面虽然显示发送按钮，但前端disabled与send早退会阻止发送，没有明确解释。用户进一步要求“就一个简单的对话，既可以聊天，也可以查问卷”。本轮按这个明确范围调整；不开发向量数据库或问卷写操作，完成后等待验收。

入口：<http://localhost:5180/home/assistant>。页面现在只保留聊天消息、输入与发送，以及历史/新对话；已去掉前置模式、问卷、版本和勾选面板。发送消息使用所配置模型，底部以一句话提示。用户不需要理解工具或选择AI模式。

## 完成的行为

- “你好”立即得到本地欢迎语，不需要调用模型或先选问卷。普通闲聊由实际Provider生成回复，并可用配置轮数内的普通聊天上下文继续回答。
- 在同一对话里说“列出我的问卷”或“查询××问卷回收多少份”，自动选择真实只读MCP工具。唯一匹配在同一条消息中继续查询，不要求再点击；多个候选在回复里给“查询这份”按钮。
- 问卷被选中后，继续问“那均值呢”沿用范围。可以用V1/版本2/最新版本自然表达版本，不需要下拉框。只保留可清除的当前问卷提示。
- 问卷统计由后端计算，均值、有效分母、缺失、原文坐标及来源继续保留。查询仍检查所有权，管理员也不能读他人问卷；写操作拒绝，不会回答“已删除”冒充执行。
- 浏览器仍是真实MCP客户端。唯一搜索结果将同一消息更新为READY的下一阶段计划，浏览器继续tools/call；最终结果保存为查询时快照，最多三步。无模型自填SQL/数字/引文替代真实查询。
- 普通聊天输入历史按完整对话轮数限制：最近用户提问加纯聊天回复；不发送问卷工具结果或答卷原文。模型故障有明确本地降级；不假装完成普通模型回答。
- 原助手表继续持久化，无新增SQL。旧REAL/LOCAL接口保留兼容，原确认校验不作为站内AUTO聊天发送的前置步骤。新AUTO每用户每分钟20次，旧只读工具与权限约束继续存在。

## 修改文件和提交

主要改动：`backend-extensions/assistant/`中的Controller、规划、会话推进和新增14项Java回归；`tduck-vue3/src/td/views/assistant/index.vue`简单聊天界面；AI设置组件的历史说明；专项HTTP/浏览器脚本、独立测试fixture准备；范围、README和本轮证据。完整清单见[M5-C-FILES.txt](M5-C-FILES.txt)。

本轮接续`847a466`之后的助手功能；工作期间同仓库的其他任务提交了深色主题，当前提交前父版本可由Git记录核对，不把那些改动混入本轮。实际本轮提交用`git log -1 --format="%h %s" -- evidence/M5-C.md`查询，最终回复给出实际号。未推送或公开部署。

提交前全仓凭据扫描发现`docs/TDUCK_HANDOFF.md`新出现的账号/密码明文命中；仅将这两个值替换为本机私有配置指引，不修改实际账号或密码。扫描随后3项通过，本轮文件0新增命中；旧`M1_VERSIONS.md:116`登记的遗留项保持原状。

构建源码来自跟踪的增量目录，上游工程不改。34份Java增量与私有构建副本逐文件哈希一致，安装JAR与构建JAR一致，见`assistant-simple/build-artifacts.json`。既有私有配置及真实用户账号未重置、未清空数据。测试单独生成Synthetic账号和问卷，不覆盖原`.local/tduck-dev/acceptance.json`。

## 实际验证

| 本轮执行项 | 成功 | 失败 |
| --- | ---: | ---: |
| JUnit：新简单对话14 + 原助手24 + AI配置25 + 建卷18 + 分析19 | 100 | 0 |
| 前端Vitest | 31 | 0 |
| 真实HTTP MCP/数据库/权限/版本/幂等/原文回归，独立fixture | 19 | 0 |
| 简单聊天HTTP：实际闲聊、追问、两步自动查询、版本、原文、权限、持久化 | 11 | 0 |
| 真实浏览器：无需前置配置、你好、实际聊天、内联选问卷、均值、刷新、390px | 9 | 0 |
| 真正后端重启后的聊天与带来源统计恢复 | 1 | 0 |
| 合计 | 171 | 0 |

前后端构建成功，Java无失败/错误/跳过。汇总与日志在`tduck-full/assistant-simple/`，测试用例/检查数不代表穷尽所有组合。旧`assistant-ui.mjs`针对被取消的面板，不当作当前界面验收，也没有把早先通过数带进本轮。

真实模型仍是本机推理网关配置标识`group/group`；普通聊天实际回答了蓝天原因并完成缩短回复，问卷意图与查询也真实执行。欢迎语是本地固定回复，明确不计为大模型测试。网关别名不证明其底层供应商/模型版本。所有测试内容及答卷均为Synthetic，不上传Key或真实健康信息。

HTTP自动查询实测同一消息经过`search_surveys → survey_stats`两次真实MCP调用，V1为4份、均值3.67；最新V2为1份、均值5。“排队”原文匹配3条，带答卷/题目坐标。聊天、来源及原文结果可同存一个会话。实际停止/启动后端前后PID记录在`restart-process.json`，复核保存的非空聊天与统计对象完整一致。

### 过程失败与修复

- 先建立浏览器回归，旧面板不满足简单聊天，0成功/1失败（`.assistant-controls`仍存在），见`baseline-ui.json`。
- 原公共验收fixture对应的测试账号在当前数据库已不存在，早期HTTP/浏览器预条件失败，记录在`invalid-fixture-*.json`。未重置任何已有账号；为本轮创建独立Synthetic fixture，并新增可指定私有输出路径的准备脚本。
- 初次Java95项有1失败，发现中文紧邻V1时原版本识别边界不匹配；增加回归并修复。
- 首次新聊天HTTP9成功/2失败：唯一命中后原问题又被当成搜索，追问还可能丢失指定版本。搜索成功后改为确定的只读查询计划，并保留版本，增加回归后11项全通过。原记录为`initial-query-api.json`。
- 确定范围后的统计无需模型，正确标为LOCAL。后续99项Java中1项仍期望DEGRADED，修正这条不符合新路由的断言，记录在`initial-local-label-java.txt`。最终100项全部通过，并验证历史限制按完整轮数计数。

## 执行命令及启动

本机已经安装，无需重复升级。PowerShell从`D:\LcProject`执行；沿用已有分析/助手/AI配置迁移，无本轮SQL。

```powershell
.\scripts\tduck\Build-FullBackend.ps1 -BuildName tduck-simple-chat-build
$env:JAVA_HOME='D:\jdk\jdk17'
& 'D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd' -q -f .local/tduck-simple-chat-build/pom.xml -pl tduck-api -am test '-Dtest=AssistantSimpleTest,AssistantQueryTest,AiSettingsTest,AiDraftServiceTest,AnalysisReportTest' '-Dsurefire.failIfNoSpecifiedTests=false' '-DfailIfNoTests=false'
.\scripts\tduck\Install-AnalysisBackend.ps1 -BuildName tduck-simple-chat-build
.\scripts\tduck\New-SimpleChatFixture.ps1
node scripts/tduck/assistant-simple-api.mjs
node scripts/tduck/assistant-simple-ui.mjs
# 真正重启后核对保存的对话；只执行replay不等于已经重启：
.\scripts\tduck\Install-AnalysisBackend.ps1 -BuildName tduck-simple-chat-build
node scripts/tduck/assistant-simple-api.mjs --replay
Set-Location .\tduck-vue3
npm.cmd run build
npm.cmd test
```

最终一次历史轮数修正后，实际将改动Java复制到同一私有构建树，重新运行上述五套JUnit，再执行`mvn.cmd -q -f .local/tduck-simple-chat-build/pom.xml -pl tduck-api -am package -DskipTests`生成最终包并安装。完整构建脚本也会从跟踪源复制相同文件，哈希已核对。未直接修改上游源码。

fixture脚本只新建Synthetic测试账号/问卷，凭据保存在忽略目录`.local/assistant-simple`，不会重置真实账号或修改原公共fixture。19项旧MCP测试通过环境变量选择本轮私有fixture、输出目录和run文件，默认行为不变。

日常启动仍为根目录`.\scripts\tduck\Start-FullBackend.ps1`与前端目录`npm.cmd run dev`；5180→8997，已运行时只刷新页面。仍有原Sass/包体积警告，无构建失败。

## 截图和人工验收

- [直接发送你好](tduck-full/assistant-simple/01-hello-desktop.png)
- [聊天中查询统计与继续追问](tduck-full/assistant-simple/03-query-desktop.png)
- [390px输入和发送](tduck-full/assistant-simple/02-chat-mobile.png)

以上均为实际浏览器采集并查看，非设计图。测试不修改模型供应商配置。

1. 刷新助手，直接发“你好”，无需勾选或选择。
2. 发一个普通聊天问题，再说“再简单一点”，验证上下文。
3. 说“查询××问卷的回收数”。唯一匹配应继续查；多份候选点回复中的“查询这份”。
4. 接着问“那均值呢”“查找提到‘某词’的回答”，核对来源与统计；可说V1或最新版本。
5. 刷新、打开历史，在手机试输入和发送。反馈PASS/FAIL后再推进其他功能。

## 已知限制

问卷范围不明确时仍需要在回复中确认候选。自动识别可能不准确，可以重述名称或清除当前问卷上下文。当前不自动合并多问卷或跨版本推断，仍为关键词检索而非向量语义RAG；最多5000份/版本、6个关键词、10条返回原文等原边界保持。

普通聊天是模型生成文本，不能当作数据库中的问卷事实。问卷查询依赖只读工具和可定位来源；助手不会直接修改、发布或删除。没有开启流式逐字回复，暂不支持中途取消；网络/模型失败可重发或继续准备好的查询。历史显示最近20个对话/40条消息。未执行全旧UI套件、全负载或第三方安全审计。旧凭据扫描登记项保持原状，本轮新增文件不应含凭据。
