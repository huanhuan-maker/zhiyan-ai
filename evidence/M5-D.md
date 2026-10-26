# M5-D｜问卷助手管理与真实对话图表交付

日期：2026-10-26，Windows / Asia-Shanghai。实现提交：`ebde4cdd58ff72afc236fecd65377d17c036e5dd`（本报告及补充浏览器验收脚本在后续交付记录提交）。基础提交为 `ecace54`；保留其他会话的统计页深色主题等改动。本轮没有修改上游 `D:\tduck-survey-form-master`，没有改动真实用户问卷或真实答卷，仅在 `tduck_vue3_dev` 中使用隔离的合成验收账号和问卷。

## 已完成

保留简单聊天窗口。普通聊天使用已配置模型“本机推理网关 / group/group”；问候和明确查询可本地立即处理。问卷助手增加草稿题目、版本、分享、导出、设计及管理预览能力，共 10 个 MCP 工具、12 类需用户确认的管理操作。具体权限和边界见 [阶段范围](../docs/ASSISTANT_WORKSPACE_STAGE.md)。

聊天内的统计现在直接显示 ECharts 面板：真实回收数、题目数、有效/全部题次、开放回答数、每日回收趋势、逐题有效/缺失、选项柱状图或单选环形图、评分均值和数据说明。支持通过提问指定问卷、版本、图形和题干，也可在面板内切换题目。图表可下载 PNG，分析可下载 JSON，答卷可下载 CSV。版本、有效分母、缺失与多选比例说明明确；数值来自后端数据库，未由模型生成。

管理操作在服务端校验所有权、白名单、问卷状态和预览指纹，30 分钟有效；确认事务锁定消息及问卷，审计与修改原子提交，重复点击返回既有结果。取消后不能再确认。收集中问卷不能直接编辑核心题；停收后编辑的是草稿，历史冻结版本保持原样。模型不能调用确认工具、执行 SQL、永久删除、操作其他账号或改系统配置。

## 发现并修复的问题

1. “生成基于这份问卷的数据图”曾被误判为问卷设计；搜索后没有保留图形类型和指定题干。先加入 3 个回归用例，旧代码运行 13 项中 3 项失败，再调整图表意图优先级与参数传递，最终全部通过。
2. 并发确认同一预览曾重复执行并触发审计主键冲突。首次 HTTP 验收 4 项通过、5 项失败（含后续依赖失败），记录在 [修复前结果](tduck-full/assistant-workspace/before-confirm-cache-fix.json)。改为直接读取加锁后的当前行，避免 MyBatis 会话缓存返回旧预览；使用 READ_COMMITTED、行锁和单条审计，增加回归。最终创建/发布的并发确认均只产生一个结果。
3. 完整浏览器复测发现“把标题改为……”偶尔被模型误判为查看题目；修复前浏览器 9 项通过、1 项失败。新增自动规划回归时 15 项中 1 项失败，再补全明确修改指令识别。最终后端及浏览器均通过。见 [修复前结果](tduck-full/assistant-workspace/before-rename-routing-fix.json) 和 [截图](tduck-full/assistant-workspace/before-rename-routing.png)。
4. 早期 Java 测试仍断言只发现 4 个工具，实际已扩展为 10 个，74 项中 1 项失败；更新过期断言，同时保留无确认工具、无越权参数等约束。
5. 增量 Maven package 曾复用旧可执行 JAR，未带入最新依赖类。后续改用 `Build-FullBackend.ps1` 完整 clean 构建再安装，以源构建与安装文件 SHA-256 一致确认本地服务版本。
6. 补充 AI 草稿闭环脚本首次有两个测试实现问题：旧编辑器选择器，以及直接提交没有生成 `字段IDlabel` 的测试数据。修正为实际 `.question-card` 和真实浏览器答题提交；之后又修正 Element Plus 隐藏输入应点击外层标签的定位方式，最终补充 4 项全部通过。原失败结果保留于 [脚本修复前记录](tduck-full/assistant-workspace/before-design-harness-fix.json)，未将测试问题冒充产品问题。第一次错误提交仅影响新增的合成验收问卷；最终按提交前后答卷数和各题有效数均加 1 验证。

## 最终实际验证

| 验证 | 通过 | 失败/错误 | 证据 |
| --- | ---: | ---: | --- |
| Java：Assistant*Test、Analysis*Test | 76 | 0 / 0 | [构建与测试摘要](tduck-full/assistant-workspace/verification.json) |
| Vitest：前端单元验证 | 44 | 0 | 同上 |
| HTTP REST / MCP / MySQL / 实际模型 | 23 | 0 | [api.json](tduck-full/assistant-workspace/api.json) |
| Edge 浏览器：聊天、出图、操作、移动端 | 11 | 0 | [ui.json](tduck-full/assistant-workspace/ui.json) |
| Edge 补充：AI 草稿确认、编辑器、发布、实际答题统计 | 4 | 0 | [design-ui.json](tduck-full/assistant-workspace/design-ui.json) |
| JVM 重启后持久化和审计 | 4 | 0 | [persistence.json](tduck-full/assistant-workspace/persistence.json) |
| 凭据扫描 | 3 | 0 个新增命中 | [credential-scan.json](tduck-full/assistant-workspace/credential-scan.json) |

前端 production build 和后端 clean package 成功。前端有现存 Sass 弃用和大包警告。Java 有现存 Java 17 反射警告，不导致用例失败。凭据扫描保留 1 处旧 M1 文档的已登记问题，本轮新增命中为 0；不在本轮擅自修改旧记录。未执行所有历史 UI 套件、压力测试或第三方安全审计。

HTTP 用例覆盖实际模型设计 4 题、实际模型追加题目、单题编辑/删除/顺序、复制、发布/停收/归档、草稿内容持久化、旧预览拒绝、取消、并发确认、跨账号拒绝、不可伪造确认参数、指定版本真实统计/导出。固定合成统计样本 V1 为 4 份答卷，评分均值 3.67；逐题有效 3、缺失 1；每日回收求和为 4。V2 与 V1 隔离。

重启校验前后对话、图表快照、未确认的真实模型设计预览、问卷和操作审计指纹相同；当时有 14 条不重复操作审计。随后补充浏览器用例确认该设计预览，验证真实保存、发布和提交。

## 可复现命令与启动

在 `D:\LcProject` 的 PowerShell 中执行。先配置本地数据库、JDK、Maven和已有 `.local/tduck-dev/application-local.yml`；密钥与口令不写入仓库。

```powershell
# 幂等迁移：历史表 + 新增 fm_assistant_action 审计表
.\scripts\tduck\Apply-AssistantMigration.ps1

# 私有目录完整构建，上游源码不改
.\scripts\tduck\Build-FullBackend.ps1 -BuildName tduck-workspace-build
$env:JAVA_HOME = 'D:\jdk\jdk17'
& 'D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd' -q `
  -f .local/tduck-workspace-build/pom.xml `
  '-Dtest=Assistant*Test,Analysis*Test' `
  '-Dsurefire.failIfNoSpecifiedTests=false' test

# 备份旧 JAR，仅重启脚本管理的 8997 本地实例
.\scripts\tduck\Install-AnalysisBackend.ps1 -BuildName tduck-workspace-build

# 已有合成验收夹具保存在 .local/assistant-simple/，不会公开口令
node scripts/tduck/assistant-workspace-api.mjs
node scripts/tduck/assistant-workspace-ui.mjs
node scripts/tduck/assistant-workspace-persistence.mjs --capture
.\scripts\tduck\Install-AnalysisBackend.ps1 -BuildName tduck-workspace-build
node scripts/tduck/assistant-workspace-persistence.mjs
node scripts/tduck/assistant-workspace-design-ui.mjs

Set-Location .\tduck-vue3
npm run test -- --reporter=dot
npm run build
# 已在运行时直接使用现有服务；关闭后再启动：
npm run dev -- --host 127.0.0.1 --port 5180
```

迁移实测确认三张助手表存在，不删除问卷/答卷。现有前端 `http://127.0.0.1:5180`、后端 `http://127.0.0.1:8997`；动态追问继续通过 `--followup.enabled=false` 停用。安装 JAR 与源构建 JAR SHA-256 均为 `d2aef091919585ce3c60fc14201cd6e371d381561c3f5ddd2f41be6939a115ef`。

## 截图与用户复验

截图为实际 Edge 采集并逐张查看，均使用合成问卷数据。完整面板截图临时增高浏览器视口以展示整个可滚动面板；390px 常规截图另存，未拼接或生成界面图片。

- [桌面数据分析面板](tduck-full/assistant-workspace/01-analysis-desktop.png)
- [对话指定单选题的环形图](tduck-full/assistant-workspace/02-analysis-donut.png)
- [管理操作确认卡](tduck-full/assistant-workspace/03-action-preview.png)
- [390px 聊天与发送按钮](tduck-full/assistant-workspace/04-analysis-mobile.png)
- [移动端完整分析面板](tduck-full/assistant-workspace/05-analysis-mobile-board.png)
- [AI 生成题目进入编辑器](tduck-full/assistant-workspace/06-designed-editor.png)
- [冻结的公开问卷](tduck-full/assistant-workspace/07-designed-public-form.png)
- [浏览器真实答题成功](tduck-full/assistant-workspace/08-designed-submitted.png)

1. 刷新问卷助手，发一个普通聊天问题，例如“怎样写一道中立的调查题”。
2. 说“基于‘你的问卷名’生成数据图”；有多份匹配时点“查询这份”。应出现统计图而非新建问卷预览。
3. 继续说“把‘某道单选题的题干’画成饼图”，应选中该题并显示环形图。多选/评分题会说明并使用柱状图。核对有效分母、缺失与均值。
4. 下载 PNG/分析 JSON；再说“导出这份问卷的答卷”，下载 CSV。可说“V1”或“最新版本”核对版本差异。
5. 在自己的测试草稿上说“把这份问卷的标题改为‘新标题’”。先取消一次，核对没有变化；重新发起并确认，刷新应保留。也可试设计、新建、单题编辑、复制、发布和停收；归档仅在你确定不再使用的测试问卷上验收。
6. 刷新历史、切换对话，手机窄屏继续输入发送。反馈本轮 PASS/FAIL；本轮交付后等待验收。

## 已知边界

自然语言识别仍可能有误；复杂组合任务须分步，管理前核对预览。当前统计图支持趋势、有效/缺失、选择题及评分分布，没有实现任意统计图、交叉统计或自动跨问卷/版本合并。文本检索仍是字面关键词，不是向量 RAG。对话统计/导出单版本上限 5000 份。现有复杂组件及跳转逻辑请到编辑器配置。数据解读为确定性统计说明；模型不能自动审核研究结论。普通聊天不能当作数据库事实。

## 修改文件清单

实现提交的文件清单如下；另外本次记录提交补充 `scripts/tduck/assistant-workspace-design-ui.mjs`、`docs/ASSISTANT_WORKSPACE_STAGE.md`、`docs/DEVELOPMENT_PLAN.md`、`docs/ACCEPTANCE_GUIDE.md`、本报告及 `evidence/tduck-full/assistant-workspace/` 下明确列出的验收 JSON 和截图。其他会话的脏文件未纳入提交。

```text
backend-extensions/analysis/tduck-form/src/main/java/com/tduck/cloud/form/analysis/AnalysisSnapshotService.java
backend-extensions/assistant/tduck-api/src/main/java/com/tduck/cloud/api/web/controller/AssistantController.java
backend-extensions/assistant/tduck-api/src/test/java/com/tduck/cloud/api/ai/AssistantQueryTest.java
backend-extensions/assistant/tduck-api/src/test/java/com/tduck/cloud/api/ai/AssistantSimpleTest.java
backend-extensions/assistant/tduck-api/src/test/java/com/tduck/cloud/api/ai/AssistantWorkspaceTest.java
backend-extensions/assistant/tduck-form/src/main/java/com/tduck/cloud/form/assistant/AssistantActionService.java
backend-extensions/assistant/tduck-form/src/main/java/com/tduck/cloud/form/assistant/AssistantChatService.java
backend-extensions/assistant/tduck-form/src/main/java/com/tduck/cloud/form/assistant/AssistantMcpProtocol.java
backend-extensions/assistant/tduck-form/src/main/java/com/tduck/cloud/form/assistant/AssistantPlanner.java
backend-extensions/assistant/tduck-form/src/main/java/com/tduck/cloud/form/assistant/AssistantTools.java
backend-extensions/assistant/tduck-form/src/main/java/com/tduck/cloud/form/assistant/AssistantWorkspace.java
backend-extensions/assistant/tduck-form/src/main/java/com/tduck/cloud/form/mapper/AssistantActionMapper.java
db/tduck/009_assistant_actions.sql
scripts/tduck/Apply-AssistantMigration.ps1
scripts/tduck/assistant-workspace-api.mjs
scripts/tduck/assistant-workspace-persistence.mjs
scripts/tduck/assistant-workspace-ui.mjs
tduck-vue3/src/td/api/project/assistant.js
tduck-vue3/src/td/assistant/SurveyAction.vue
tduck-vue3/src/td/assistant/SurveyAnalysis.vue
tduck-vue3/src/td/assistant/download.js
tduck-vue3/src/td/assistant/selection.js
tduck-vue3/src/td/views/assistant/index.vue
tduck-vue3/tests/unit/assistant-workspace.test.js
```
