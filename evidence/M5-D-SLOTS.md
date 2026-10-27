# M5-D-SLOTS｜三个独立 AI 问卷暂存

2026-10-27，分支 `codex/tduck-full-vue3`；实现提交 `3109029`。用户要求最多暂存3份，暂存期间仍能从空白开始 AI 建卷。

## 交付

每个账号最多保存3份独立 AI 建卷暂存。“我的问卷”概览逐份显示标题、题数和时间，可继续编辑或确认后移除；移除后可以腾出位置。点击概览上的“AI 建卷”从空白开始，不读取其他暂存；保存新草稿占用一个位置，继续编辑并保存已有草稿只更新该份。满额仍可新建和编辑，但保存第四份时提示先移除一份，当前输入保留。

原单份暂存已一次性复制到新的第1个位置，旧记录保留备查；迁移重复执行不会重复导入或让已移除的暂存复活。对现有用户原记录与迁移后记录计算的 JSON 摘要一致，原《大学生AI使用情况与期待调查》仍为30题。概览和用户账号页已实际确认原草稿可见。旧页面使用单份接口尝试写入时会收到刷新提示，避免写入已不再显示的旧表。

每份暂存使用不可复用的 UUID，账号隔离；服务端按账号事务加锁分配最多3个位置。移除后复用位置不会让旧页面的 ID 覆盖新的暂存。每份草稿的浏览器缓存和导入续传记录分开；迁移前同题目的本地未暂存修改会保留，并可在本地与账号暂存之间选择。编辑器内“清空结果”只清空当前内容；删除账号暂存需回概览明确确认。

## 文件与迁移

- `db/tduck/011_ai_draft_slots.sql`：独立暂存、账号锁和一次性迁移标记；`scripts/tduck/Apply-AssistantMigration.ps1` 依次执行迁移并检查7张表。
- `backend-extensions/assistant/tduck-form/src/main/java/com/tduck/cloud/form/ai/AiDraftSlotsService.java` 和 `.../mapper/AiDraftSlotMapper.java`：独立存取、事务容量限制、所有权和 UUID。
- `backend-extensions/assistant/tduck-api/src/main/java/com/tduck/cloud/api/web/controller/AiDraftSlotsController.java`：暂存接口；`AiDraftWorkspaceController.java` 防止旧单份接口继续写入。
- `backend-extensions/assistant/tduck-api/src/test/java/com/tduck/cloud/api/ai/AiDraftSlotsTest.java`：6项单元测试。
- `tduck-vue3/src/td/api/project/ai.js`、`tduck-vue3/src/td/views/form/ai-draft/index.vue`、`tduck-vue3/src/td/views/project/my/index.vue`：新建、独立缓存、继续编辑、概览和确认移除。
- `scripts/tduck/ai-slots-api.mjs`、`ai-slots-ui.mjs`、`ai-slots-real.mjs`：接口、浏览器和真实模型验证。

## 实际测试

| 验证 | 成功 | 失败 | 备注 |
| --- | ---: | ---: | --- |
| 后端 AI 草稿、单题优化和助手 JUnit 套件 | 110 | 0 | 包含6项本轮测试；未运行全仓库所有测试 |
| 前端 Vitest | 57 | 0 | 8个测试文件 |
| REST/MySQL 接口 | 7 | 0 | 含并发争夺最后位置、账号隔离、旧接口保护和旧 ID 不可覆盖新草稿；`tduck-full/ai-slots/api.json` |
| 浏览器完整流程 | 11 | 0 | 含旧本地修改恢复、新建、3份、刷新、上限、移除、手机布局；`tduck-full/ai-slots/ui.json` |
| 真实 AI 新建问卷 | 1 | 0 | 真实 `本机推理网关 / group/group` 生成3题；`real-generation.json` |
| 后端构建、迁移和前端生产构建 | 通过 | 0 | 迁移重复执行成功；前端仍有既有 Sass 弃用及大分包提示 |
| 凭据扫描 | 3 | 0 | 本轮无新增命中；保留既有 M1 遗留提示 |

浏览器生成草稿使用明确标注的合成模型返回，验证真实数据库保存与界面交互；真实 AI 调用单独运行，没有把合成返回冒充真实模型。浏览器、接口测试使用独立合成账号，结束后检查测试账号剩余暂存0份。真实用户问卷未用于写入测试。

初次 JUnit 运行110项中109成功、1错误：Mockito 默认把未配置的 Map 返回为空 Map，测试需要明确模拟数据库未找到时返回 null；修正测试替身后复验110成功。没有跳过该断言。

构建与安装 JAR 的 SHA-256 均为 `FBE7F53AEE6A79039F328B08A8FB1D740F01CAA753D000B1587514B4B671B3A6`。当前服务位于前端5180、后端8997，使用隔离数据库 `tduck_vue3_dev`。本轮未更改真实已发布问卷或答卷。

截图：[三个暂存的桌面概览](tduck-full/ai-slots/01-three-drafts.png)、[手机概览](tduck-full/ai-slots/02-mobile-drafts.png)。截图均为合成数据。

## PowerShell 运行和验收

在 `D:\LcProject`：

```powershell
.\scripts\tduck\Apply-AssistantMigration.ps1
.\scripts\tduck\Build-FullBackend.ps1 -BuildName tduck-workspace-build
$env:JAVA_HOME='D:\jdk\jdk17'
& 'D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd' -q -f .local/tduck-workspace-build/pom.xml '-Dtest=AiDraft*Test,AiSurveyDesignTest,Assistant*Test' '-Dsurefire.failIfNoSpecifiedTests=false' test
.\scripts\tduck\Install-AnalysisBackend.ps1 -BuildName tduck-workspace-build
node scripts/tduck/ai-slots-api.mjs
node scripts/tduck/ai-slots-ui.mjs
node scripts/tduck/ai-slots-real.mjs
Set-Location D:\LcProject\tduck-vue3
npm run test -- --reporter=dot
npm run build
npm run dev -- --host 127.0.0.1 --port 5180
```

已有服务运行时无需重复启动。页面验收：进入“我的问卷”，确认原30题暂存；点击“AI 建卷”检查空白；生成并暂存两份新草稿，分别继续编辑并刷新；第四份保存应提示已满且不丢当前输入；自行确认移除某一份后可以保存新的草稿。本轮完成后等待反馈。
