# M5-A｜侧栏问卷助手交付（2026-10-25）

本轮按用户“这个问卷助手增加到这里吧”的要求，接续前文 MCP 查询对话方案，将可使用的问卷助手放到“我的问卷”之后。普通用户两项菜单，管理员另保留用户管理、系统配置；不恢复已经停用的动态追问。入口为 <http://localhost:5180/home/assistant>，隔离后端8997、MySQL8 `tduck_vue3_dev`。当前交付后等待用户验收。

## 交付行为

- 选择自己的问卷和发布版本，通过本地规则或真实 AI 理解自然语言提问；问卷搜索、版本统计、开放回答关键词检索、已审核报告读取共四个只读工具。未选问卷时可先搜索。
- 浏览器作为真实 MCP 客户端，经 HTTP 执行 initialize、notifications/initialized、tools/list、tools/call。后端固定支持协议2025-06-18及无会话 JSON 响应模式，未把普通 REST 接口冒称 MCP。
- AI 仅将提问转换为白名单工具和参数。所有统计、有效分母、缺失、均值、匹配计数和原文由后端生成；不让模型编写数值或引文。真实模式需要明确确认传输提问、所选编号及版本，规划模型输入不包含答卷原文。无配置、超时、异常格式均有明确降级提示。
- 每条结果保留问卷、版本、查询时间及可打开的来源。引用可定位到答卷/题目；统计链接带版本参数，V1不会误开默认最新V2。开放回答以文本渲染，合成恶意HTML探针没有执行。
- MyBatis-Plus持久化会话、消息、计划和工具结果；UUID幂等及状态更新防止重试重复。刷新/后端重启可恢复历史；丢失响应后可读取已保存结果，执行前断网可继续同一READY计划。新提问读取当前数据，历史保留查询时快照。
- 服务端再次检查所有权，管理员也不能用助手查看他人问卷。归档或失去权限后不再展示历史原文。JWT及数据库有效token校验、Origin校验、限流、大小/深度/参数白名单在服务端执行；不接受查询字符串凭据，无业务写工具、无自由SQL。

## 文件与提交

主要文件：`backend-extensions/assistant/`十二份Java源码及说明；`db/tduck/007_assistant.sql`；构建及迁移脚本；前端助手API、MCP客户端、对话页、侧栏和路由；统计页版本链接；`assistant-api.mjs`、`assistant-ui.mjs`及菜单回归；当前范围/启动/验收文档和本轮证据。完整清单见 [M5-A-FILES.txt](M5-A-FILES.txt)。

基线提交 `57a2b15`。本轮提交可用 `git log -1 --format="%h %s" -- evidence/M5-A.md` 查询，最终答复给出实际提交号。只提交本轮代码与新增证据；既有未提交的其他历史证据、根目录包文件保持原状。未推送、未公网部署。

构建来源可核查：[build-artifacts.json](tduck-full/assistant/build-artifacts.json) 记录分析11份和助手12份Java源码与私有构建副本的逐文件SHA256一致，构建JAR与实际安装JAR一致。不会将`.local`私有配置、token、Key或完整含环境参数的JUnit XML提交。

## 实际执行结果

| 本轮执行项 | 成功 | 失败 |
| --- | ---: | ---: |
| JUnit：助手24、原分析19、AI草稿18 | 61 | 0 |
| 前端Vitest | 31 | 0 |
| 独立HTTP MCP/真实MySQL/权限/版本/真实模型规划 | 19 | 0 |
| 真实浏览器/MCP网络/来源/刷新/两种断网/390px/版本跳转 | 15 | 0 |
| 实际后端重启后的API及浏览器所建会话恢复、MCP重初始化 | 3 | 0 |
| 工作台菜单、退役路由及普通用户管理权限 | 10 | 0 |
| AI建卷界面及真实保存/发布/匿名提交/统计闭环 | 10 | 0 |
| 首页回归 | 11 | 0 |
| 追问保持停用 | 6 | 0 |
| 合计 | 166 | 0 |

计数是执行的检查/用例，不等于所有行为均穷尽。前后端构建成功；Java无失败/错误/跳过。证据在 [assistant目录](tduck-full/assistant/)，原功能本轮回归复制在`regression/`，没有把历史成功数当成本轮结果。未运行整个旧版`test:e2e`，没有声称进行全量负载或第三方安全审计。管理员菜单截图使用页面层合成角色，不是新增/修改管理员账号，也不作为管理接口全量验收。

真实AI：本机推理网关，配置模型标识`group/group`。确实调用已配置模型完成工具规划，随后从真实数据库查得统计。配置名称不证明网关后面的实际供应商或具体模型版本。[real-planner.json](tduck-full/assistant/real-planner.json) 记录非敏感元数据；浏览器另实际调用真实规划。所有演示数据均为Synthetic。原AI建卷回归的模型响应为合成fixture，保存、发布、答题和统计是真实链路。

实际重启前PID16636、重启后6304，见`restart-process.json`；`restart-results.json`核对先前API及浏览器创建的会话和引用。HTTP测试另独立计算原答卷行指纹，核对只读操作未修改答卷。

首次HTTP检查18成功/0失败后扩展版本与协议边界，最终19成功/0失败。首次浏览器14成功/1失败：脚本把“排队”的期望匹配数写为2，而HTTP测试已新增第三条匹配回答；修正为真实数据的3后复测15成功/0失败。保留`first-api-results.json`、`initial-ui-results.json`。最终另移除消息区平滑滚动，避免结果尚在滚动时截图截断，浏览器15项复测及前端重建成功。

## PowerShell复现与启动

下列命令从`D:\LcProject`执行，使用本机已有的隔离库及私有配置。原上游工程不改动，原JAR私下备份，旧数据不清空。

```powershell
.\scripts\tduck\Build-FullBackend.ps1 -BuildName tduck-assistant-build
.\scripts\tduck\Apply-AssistantMigration.ps1
.\scripts\tduck\Install-AnalysisBackend.ps1 -BuildName tduck-assistant-build

$env:JAVA_HOME='D:\jdk\jdk17'
& 'D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd' -q -f .local/tduck-assistant-build/pom.xml -pl tduck-api -am test '-Dtest=AiDraftServiceTest,AnalysisReportTest,AssistantQueryTest' '-Dsurefire.failIfNoSpecifiedTests=false' '-DfailIfNoTests=false'

node scripts/tduck/assistant-api.mjs --real
node scripts/tduck/assistant-ui.mjs
# 真正重启后再核对本地保存的会话ID，单独执行replay不等于已重启：
.\scripts\tduck\Install-AnalysisBackend.ps1 -BuildName tduck-assistant-build
node scripts/tduck/assistant-api.mjs --replay

node scripts/tduck/workspace-menu.mjs
node scripts/tduck/m2-usability.mjs
node scripts/tduck/review-ui-refresh.mjs
node scripts/tduck/verify-followup-retired.mjs
Set-Location .\tduck-vue3
npm.cmd test
npm.cmd run build
```

SQL为可重复新增两表，迁移脚本实测确认2张助手表。已有分析库为前置条件，新环境先按迁移版README完成原迁移。构建在独立`.local/tduck-assistant-build`运行，不覆盖正在执行的标准运行包；安装脚本验证隔离路径及8997进程。日常无需重新构建/迁移：根目录`.\scripts\tduck\Start-FullBackend.ps1`，前端目录`npm.cmd run dev`，服务已运行时不重复启动。相关本轮日志复制为`regression/*.txt`；Sass旧API及包体积警告仍在，无构建失败。

## 截图

- [桌面统计查询](tduck-full/assistant/01-chat-desktop.png)
- [原文与可定位来源](tduck-full/assistant/02-answer-source-desktop.png)
- [390px对话及输入区](tduck-full/assistant/03-chat-mobile.png)
- [390px来源弹窗](tduck-full/assistant/04-source-mobile.png)
- [管理员四项菜单（合成页面状态）](tduck-full/assistant/05-admin-menu-synthetic-state.png)

均由本轮实际浏览器采集并查看，不是设计图。含恶意HTML字样的文本为专用Synthetic XSS探针。

## 人工验收步骤

1. 登录自己的账号，打开助手，确认它在“我的问卷”下，搜索并选中自己的问卷及版本。普通账号不显示管理菜单。
2. 问“这份问卷回收了多少答卷”，对照统计页的版本、有效/缺失及均值；展开选项人数；点来源及“打开该版本统计”。
3. 问“查找提到‘排队’的回答”（换成你答卷中的实际词），检查原文和答卷/题目坐标；不存在关键词应显示无匹配，不会补造回答。
4. 问“查看已审核报告”。无报告、未通过或数据变化时应给出提示；已有新鲜已审核报告时显示其编号与引用。
5. 切换“AI理解问题”，未勾选确认时不能发送；确认后提问，检查真实模式标识。切回本地规则显示非模型。刷新应恢复会话及来源，切版本查询不能混入其他版数据。
6. 手机390px打开，确认输入框、发送按钮及来源弹窗可用；不修改/发布/删除问卷。反馈PASS/FAIL后再安排后续工作。

供当前本机合成owner复核的问卷编号`eFdpUktP`：V1共4份、评分有效3/缺失1、均值3.67，“排队”匹配3条；V2共1份、均值5、“排队”无匹配。此前历史API对话仍保存3份快照，带当时查询时间，这是预期持久化行为。测试账号凭据仅保存在忽略配置，不写报告。

## 已知限制

当前为单问卷/版本的只读查询，字面关键词OR检索；尚无向量语义RAG、多问卷自动对比、任意SQL、写操作或自动生成问卷。关键词匹配不能推断总体观点比例。最多5000份答卷、6个关键词、10条返回原文；超过4000字的匹配原文计入匹配但不展开，界面说明。问卷搜索每次最多10项，支持继续输入关键词；显示最近20个对话及40条消息。

认证面向本地站内和手动配置本应用凭据的客户端，未做公网OAuth发现或所有MCP SDK互操作验收；无SSE。站内规划模型不接收答卷，但外接MCP客户端如何向自己的模型传输工具结果由该客户端控制。进程中断在PLANNING/RUNNING的任务不会自动再次请求模型，需要刷新查看状态或发起新问题；READY任务可继续。历史消息不自动实时重算；新查询读取当前数据。

本轮不清理此前工作区已有未提交文件，也未处理先前证据文档的已登记凭据扫描遗留项。新增文件凭据扫描结果随本轮证据记录；旧命中不会被宣称修复。
