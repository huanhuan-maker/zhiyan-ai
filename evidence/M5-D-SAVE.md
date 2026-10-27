# M5-D-SAVE｜100 题上限与右上角暂时保存

日期：2026-10-27（America/New_York）。实现提交：`b71130d51b17acf171cd9a66f87dd50673b2ed82`。本报告、阶段文档与截图在后续文档提交。本轮按用户连续指令同时完成“AI 出题上限 100”和“用暂时保存替换 AI 建卷页右上角的浅色模式按钮”，不推进新阶段。

## 交付结果

- AI 建卷控件与提示、服务端生成校验、助手设计工具及题目预览上限统一为 100；101 题仍拒绝。修复助手只匹配两位数导致“100 道题”被错误解析的问题。
- AI 建卷页右上角为“暂时保存”，该页不再显示主题切换。保留当前配色；普通编辑器的主题按钮不变。手机缩小非必要品牌文字，保存按钮保持在右上角。
- 暂存保存当前需求（允许未填完）以及生成/手改题目，通过 Spring Boot + MyBatis-Plus 写入 MySQL。每账号一份最新工作副本，不生成/发布正式问卷；关闭页面后在新浏览器上下文重开可恢复。
- 同标签页已有本地编辑优先保留；生成、导入和暂存期间避免重复保存，加载暂存期间阻止相冲突操作。请求失败保留输入并允许重试。清空结果成功后同时删除账号暂存和本地缓存。
- 暂存接口仅使用认证的 userId，不接受客户端指定 owner；校验题数、内容、字段及 512KB UTF-8 大小，设置速率限制和 no-store。不同账号读写/清除互不影响。

完整范围与限制见 [AI_DRAFT_WORKSPACE.md](../docs/AI_DRAFT_WORKSPACE.md)。

## 实际执行与验证

| 验证 | 通过 | 失败/错误 | 证据 |
| --- | ---: | ---: | --- |
| Java：AiDraft*Test、Assistant*Test、Analysis*Test | 106 | 0 / 0 | [verification.json](tduck-full/ai-draft-workspace/verification.json) |
| 前端 Vitest | 50 | 0 | 同上 |
| 暂存浏览器/接口/账号隔离/失败恢复 | 11 | 0 | [ui.json](tduck-full/ai-draft-workspace/ui.json) |
| 真实 100 题暂存恢复与完整导入 | 2 | 0 | [real-hundred-import.json](tduck-full/ai-draft-workspace/real-hundred-import.json) |
| 已有手动单题编辑流程回归 | 11 | 0 | [manual-edit-regression.json](tduck-full/ai-draft-workspace/manual-edit-regression.json) |
| 凭据扫描 | 3 | 0 个新增命中 | [credential-scan.json](tduck-full/ai-draft-workspace/credential-scan.json) |

真实 Provider“本机推理网关”、模型 `group/group` 实际生成 **100 题**，请求耗时 **19,593ms**，mode=REAL，见 [real-100.json](tduck-full/ai-draft-workspace/real-100.json)。验收要求 99 道简短评分题和 1 道开放题以验证数量边界；不将这份合成验收卷当作推荐的正式问卷设计。随后把该真实结果暂存，在新浏览器中恢复全部 100 题，再导入现有编辑器；MySQL 实际返回 100 条题目，题干和顺序逐项一致，状态为未发布，刷新后保留。

另有 100 道明确标注 MOCK 的合成题用于 UI/手改/账号隔离/网络失败注入，未冒充真实 AI。全部写入在 `tduck_vue3_dev` 的既有合成验收账号中，仅创建新的测试草稿；工作区测试前保存账号原暂存，结束时恢复。未操作真实用户问卷或答卷，未修改用户模型配置和上游源码。

首次边界回归在旧代码上执行 5 项，其中 3 失败、1 错误、1 通过（101 题本来就拒绝），日志 `.local/ai-draft-limit-before.log`。修复后这 5 项与新增 7 项暂存验证均纳入最终 106 项 Java 结果。首次暂存浏览器检查 9 通过、2 失败，见 [before-save-fixes.json](tduck-full/ai-draft-workspace/before-save-fixes.json)：发现 Element Plus 题数控件在挂载时记录 aria-disabled，加载结束后未更新；改为加载完成再挂载表单。另移除了保存失败时与全局 HTTP 拦截器重复的错误 toast。最终重跑 11 项全部通过。

前端 production build 与后端完整 clean package 成功，现有 Sass 弃用/大包提示、Java 17 反射和 Node 实验性代理提示未导致验证失败。旧 M1 文档登记的凭据问题保留为未解决，本轮无新增命中。未执行全站压力测试或与本轮无关的全部历史套件。旧通用 `ai-draft.mjs` 的过期上限断言从 31 改为 101，但没有重跑其整个旧部署流程，实际验证以本报告列表为准。

## SQL、构建、安装和启动

新增 `db/tduck/010_ai_draft_workspace.sql`，表 `fm_ai_draft_workspace` 按 owner_id 主键保存 JSON 与服务端更新时间。迁移脚本已实际运行，确认助手历史、操作审计和暂存共 4 张表；幂等 CREATE IF NOT EXISTS，不删除问卷/答卷数据。

在 `D:\LcProject` 的 PowerShell 中：

```powershell
.\scripts\tduck\Apply-AssistantMigration.ps1
.\scripts\tduck\Build-FullBackend.ps1 -BuildName tduck-workspace-build
$env:JAVA_HOME = 'D:\jdk\jdk17'
& 'D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd' -q `
  -f .local/tduck-workspace-build/pom.xml `
  '-Dtest=AiDraft*Test,Assistant*Test,Analysis*Test' `
  '-Dsurefire.failIfNoSpecifiedTests=false' test
.\scripts\tduck\Install-AnalysisBackend.ps1 -BuildName tduck-workspace-build

node scripts/tduck/ai-draft-workspace-ui.mjs
node scripts/tduck/ai-draft-hundred-real.mjs
node scripts/tduck/ai-draft-hundred-import.mjs
node scripts/tduck/ai-draft-edit-ui.mjs

Set-Location .\tduck-vue3
npm run test -- --reporter=dot
npm run build
# 前端关闭且端口空闲时启动；已有 5180 服务直接刷新
npm run dev -- --host 127.0.0.1 --port 5180
```

真实 100 题最初通过同内容 Node HTTP 请求实际执行，生成结果完整保存在忽略的 `.local/ai-draft-workspace/real-100.json`，仓库仅保存无密钥摘要。新脚本 `ai-draft-hundred-real.mjs` 已运行验证该 REAL 缓存；缓存存在时不会重复付费生成，需重新调用模型时加 `--regenerate`。没有把缓存读取计作第二次真实模型调用。

安装备份旧 JAR 后只重启脚本管理的 8997 实例；最新源构建与安装 JAR SHA-256 均为 `9bee683f9747771bfb4e10ee3bbe85b737155660413927005388e0fc5e929b25`。前端 `http://127.0.0.1:5180`、后端 `http://127.0.0.1:8997` 已运行，动态追问继续停用。前端无需另行部署，Vite 已载入修改。

## 截图与人工复验

以下为实际 Edge 浏览器采集并查看的截图：

- [右上角暂时保存与 100 题提示](tduck-full/ai-draft-workspace/01-header-save-and-limit.png)
- [恢复手动修改的 100 题合成草稿](tduck-full/ai-draft-workspace/02-restored-hundred-question-draft.png)
- [390px 手机右上角保存](tduck-full/ai-draft-workspace/03-mobile-temporary-save.png)
- [真实模型 100 题暂存恢复](tduck-full/ai-draft-workspace/04-real-hundred-restored.png)
- [真实 100 题导入编辑器](tduck-full/ai-draft-workspace/05-real-hundred-imported.png)

1. 刷新 AI 建卷页，确认右上角只有“暂时保存”，题数允许 1～100。
2. 先只填调查目标，点暂时保存；关闭页面，新标签页重开，应恢复输入。
3. 生成问卷，手动改一题，再点暂时保存；重开核对需求、题数和修改仍在。
4. 暂存不会发布或创建正式问卷；需要正式问卷时点“导入编辑器继续编辑”。
5. “清空结果”清除当前账号暂存；其他账号不应看到该草稿。反馈当前轮次 PASS/FAIL。

## 修改文件与已知边界

实现提交的 19 个文件：

```text
backend-extensions/assistant/tduck-api/src/main/java/com/tduck/cloud/api/web/controller/AiDraftWorkspaceController.java
backend-extensions/assistant/tduck-api/src/test/java/com/tduck/cloud/api/ai/AiDraftLimitTest.java
backend-extensions/assistant/tduck-api/src/test/java/com/tduck/cloud/api/ai/AiDraftWorkspaceTest.java
backend-extensions/assistant/tduck-form/src/main/java/com/tduck/cloud/form/ai/AiDraftWorkspaceService.java
backend-extensions/assistant/tduck-form/src/main/java/com/tduck/cloud/form/assistant/AssistantPlanner.java
backend-extensions/assistant/tduck-form/src/main/java/com/tduck/cloud/form/assistant/AssistantTools.java
backend-extensions/assistant/tduck-form/src/main/java/com/tduck/cloud/form/assistant/AssistantWorkspace.java
backend-extensions/assistant/tduck-form/src/main/java/com/tduck/cloud/form/entity/AiDraftWorkspaceEntity.java
backend-extensions/assistant/tduck-form/src/main/java/com/tduck/cloud/form/mapper/AiDraftWorkspaceMapper.java
db/tduck/010_ai_draft_workspace.sql
patches/tduck-backend/ai-draft.patch
scripts/tduck/Apply-AssistantMigration.ps1
scripts/tduck/ai-draft.mjs
scripts/tduck/ai-draft-hundred-import.mjs
scripts/tduck/ai-draft-hundred-real.mjs
scripts/tduck/ai-draft-workspace-ui.mjs
tduck-vue3/src/td/api/project/ai.js
tduck-vue3/src/td/views/form/ai-draft/index.vue
tduck-vue3/src/td/views/form/index.vue
```

文档提交另含 `docs/AI_DRAFT_WORKSPACE.md`、`docs/DEVELOPMENT_PLAN.md`、`docs/ACCEPTANCE_GUIDE.md`、本报告和独立 `evidence/tduck-full/ai-draft-workspace/` 证据。其他会话原有脏文件不纳入本轮提交。

暂存只保留当前账号最近一份副本，不提供历史列表、自动合并或多标签页版本冲突处理；最后一次成功显式保存为准。相同标签页优先保留其本地工作内容，新上下文读取账号暂存。已加载的内容修改后需再次点击暂时保存才能保证关闭页面后恢复。100 题长选项问卷仍受所配置模型输出 Token 和超时影响；系统不会用截断结果冒充完整问卷。未自动发布、修改已有答卷或放开已发布核心题编辑。
