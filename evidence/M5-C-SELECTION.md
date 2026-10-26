# M5-C｜“查询这份”按钮缺陷复验（2026-10-25）

按用户截图完整复现“我现在有多少份问卷 → 查询这份”，并检查连点、未发布问卷和新对话切换。入口仍为`http://localhost:5180/home/assistant`，5180→8997→隔离MySQL。只修本轮缺陷，交付后等待用户复验。

## 原因与修复

1. 原`selectSurvey`只要看到原问题含“多少”，就原样重发。因此选中一份后仍问“我现在有多少份问卷”，后端正确地再次列清单，表现为循环。现在点击会转成“查一下这份问卷的回收统计”，并传递被点击的真实formKey。可识别的均值、报告、关键词和版本意图有独立转换，避免再搜索名称。
2. 连点时第二次处理会在busy检查之前重写输入框和上下文，留下未发送的重复问题。现先检查busy/连接状态，再修改任何内容。
3. 未发布问卷没有发布版本，原来直接抛查询失败。现区分“没有任何发布版本”和“显式版本不存在”：站内聊天对前者保存正常UNPUBLISHED说明，不伪造0份答卷，也不显示Vundefined或统计跳转。刷新保留问卷上下文；权限检查不放宽，缺失指定版本仍拒绝。
4. 复验还暴露新对话异步创建期间可以发送，导致新消息仍携带旧问卷和旧会话。现创建/切换对话期间锁定发送，初始化也在历史恢复完成后才标记可用。用浏览器暂时挂起创建POST的方式验证，释放后才允许发送，新消息携带新ID及空问卷范围。

## 修改文件及Git

基线`625e2c9`。源文件为前端`assistant/selection.js`、`views/assistant/index.vue`和新增8项单元测试；后端`AssistantTools`、`AssistantChatService`及新增4项Java回归；`assistant-selection-ui.mjs`浏览器脚本、验收说明和本记录。完整提交清单见[M5-C-SELECTION-FILES.txt](M5-C-SELECTION-FILES.txt)。无SQL迁移，不更改模型配置、不自动发布或删除问卷。

本轮本地提交可用`git log -1 --format="%h %s" -- evidence/M5-C-SELECTION.md`查询，最终答复给出实际号。既有其他未提交文件保留，未推送/公网部署。增量源码继续由构建脚本复制到私有目录，上游工程未改。35份增量Java与构建副本一致，安装JAR与构建JAR哈希一致，见`assistant-selection-fix/build-artifacts.json`。

## 实际执行结果

| 本轮执行项 | 成功 | 失败 |
| --- | ---: | ---: |
| Java：新选择回归4 + 原助手/对话/设置/建卷/分析100 | 104 | 0 |
| 前端Vitest：新意图转换8 + 原31 | 39 | 0 |
| 真实浏览器：截图原路径、连点、未发布、切回已发布、390px、新对话竞态、控制台 | 7 | 0 |
| 原MCP HTTP、权限/版本/幂等/原文/真实模型规划 | 19 | 0 |
| 原简单聊天HTTP及真实模型、两步查询、版本/原文/权限 | 11 | 0 |
| 真正后端重启后的聊天及非空统计恢复 | 1 | 0 |
| 合计 | 181 | 0 |

前后端构建成功，JUnit无失败/错误/跳过；Sass及包体积旧警告仍在。以上为检查/用例数，不等于穷尽所有组合。截图、初始失败、结构化结果和日志都在`tduck-full/assistant-selection-fix/`。用独立Synthetic账号和问卷验证，不修改用户真实问卷，未发送真实回答给模型。原MCP回归在自己的输出目录及私有run文件中执行，没有覆盖原fixture指针。

真实配置Provider仍是本机推理网关、标识`group/group`；目录查询/普通聊天实际使用已配置模型，已选问卷统计和说明由后端提供。该别名不证明底层供应商或版本。新对话竞态测试只挂起一条真实创建请求，未替换响应或虚构持久化结果。

实际重启前PID20228、后18756，`restart-process.json`记录；重启后核对已保存聊天和带来源统计完整一致。草稿说明另在浏览器实际刷新后恢复。

### 过程失败

- 先写复现脚本，旧实现1成功/3失败：重发全局数量问题、连点留下重复输入、未发布直接报错。记录在`before.json`，与用户描述一致。
- 第一次修复后5成功/1失败，发现创建新对话还没完成就能发送旧问卷范围；见`initial-after.json`。增加忙状态保护及真实请求挂起回归后7项全部通过。
- Java首次104项有1个测试环境错误：新Mapper服务单元测试缺少MyBatis-Plus Lambda元数据初始化，不是业务运行失败。补齐测试初始化后104项全通过，保留`initial-java.txt`。

## PowerShell复现与启动

本机已安装。已有完整环境升级从`D:\LcProject`执行，无新增SQL：

```powershell
.\scripts\tduck\Build-FullBackend.ps1 -BuildName tduck-selection-fix-build
$env:JAVA_HOME='D:\jdk\jdk17'
& 'D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd' -q -f .local/tduck-selection-fix-build/pom.xml -pl tduck-api -am test '-Dtest=AssistantSelectionTest,AssistantSimpleTest,AssistantQueryTest,AiSettingsTest,AiDraftServiceTest,AnalysisReportTest' '-Dsurefire.failIfNoSpecifiedTests=false' '-DfailIfNoTests=false'
.\scripts\tduck\Install-AnalysisBackend.ps1 -BuildName tduck-selection-fix-build
node scripts/tduck/assistant-selection-ui.mjs
node scripts/tduck/assistant-simple-api.mjs
Set-Location .\tduck-vue3
npm.cmd test
npm.cmd run build
```

沿用上一轮`.local/assistant-simple`的私有Synthetic fixture；新环境先按M5-C报告运行`New-SimpleChatFixture.ps1`。本轮MCP19项实际设置`TDUCK_ASSISTANT_FIXTURE=.local/assistant-simple/acceptance.json`、`TDUCK_ASSISTANT_OUTPUT=evidence/tduck-full/assistant-selection-fix/mcp-regression`、`TDUCK_ASSISTANT_RUN=.local/selection-fix/mcp-run.json`后运行`node scripts/tduck/assistant-api.mjs --real`。后端真正重启后再执行`node scripts/tduck/assistant-simple-api.mjs --replay`核对，结果复制归档；原阶段结果文件恢复，不混写旧证据。

日常仍是根目录`Start-FullBackend.ps1`、前端目录`npm.cmd run dev`，已运行时只需刷新。测试没有点击发布/删除，业务权限及只读边界不变。未运行整个旧test:e2e，不宣称完成负载或全安全审计。

## 截图与用户复验

- [修复前：选中后再次列清单](tduck-full/assistant-selection-fix/before-count-click.png)
- [修复后：直接给出选中问卷统计](tduck-full/assistant-selection-fix/after-count-click.png)
- [修复后：未发布问卷正常说明](tduck-full/assistant-selection-fix/after-draft-click.png)
- [390px查询后仍可输入/发送](tduck-full/assistant-selection-fix/after-mobile.png)

均为实际浏览器截图并已查看，未虚构。用户可按截图原问题复验：点“查询这份”应出现所选问卷的统计；连点后输入框仍为空；选未发布问卷不应报连接/执行失败，刷新仍能看见说明。新建对话期间应暂时不可发送，完成后不沿用旧问卷。

复杂多条件问题仍可能需要重述。点击默认查询所选问卷的统计，能识别的评分/报告/关键词会保留对应意图；当前检索仍是关键词，不是向量RAG。历史查询是当时快照，问卷后来发布后需要重新查询。旧凭据扫描遗留项继续如实保留，不在本轮处理。
