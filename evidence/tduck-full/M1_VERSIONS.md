# M1 收尾｜差距核对与不可变问卷版本机制验收

- 日期：2026-10-24 深夜。执行：GLM-5.3。范围：M1 差距核对 + 版本快照机制补齐 + 验收指南全项复测。
- 本地提交：本文件所在提交，用 `git log -1 --format="%h %s" -- evidence/tduck-full/M1_VERSIONS.md` 精确查询；未 push。
- 运行环境：前端 `http://localhost:5180`（入口 `src/td/main.js`）；后端 `127.0.0.1:8997`（`.local/tduck-closure-build` 私有构建，三份补丁链）；数据库 `tduck_vue3_dev`。原版 8890/8999、旧知研工程与备份全部保留未动。旧工程归档报告 `evidence/M1.md` 不受影响。

## 1. 差距核对结论（不重复开发已有功能）

对照 `docs/DEVELOPMENT_PLAN.md` M1 与 `docs/ACCEPTANCE_GUIDE.md` M1 剧本，逐项核对已交付内容（`evidence/tduck-full/CORE_CLOSURE.md`）：

| M1 要求 | 已有实现 | 差距 |
|---|---|---|
| 四题型建卷/编辑/保存刷新/预览 | 原生 Vue3 设计器 | 无 |
| 发布、停止、公开填写、提交 | 真实接口 | 无 |
| 提交幂等（事务+防重） | 会话回执表 + X-Submission-Key | 无 |
| 必填校验、密码、IP 限次 | 已有 | 无 |
| 统计：人数/比例/均值/有效/缺失、开放题原文 | 后端计算 | 无 |
| 越权防护 | 所有权校验 | 无 |
| **发布生成不可变版本、唯一随机公开链接** | 仅有"发布冻结 + 复制新问卷" | **缺失（本轮补齐）** |
| **旧版本结果不因新版本草稿修改而改变** | 无版本概念 | **缺失（本轮补齐）** |

## 2. 版本快照机制（本轮新增）

**数据模型**（`db/tduck/003_form_versions.sql`，幂等，含存量回填）：
- 新表 `fm_user_form_version`：`form_key + version_no` 唯一，`status`（1=收集中/2=已停止），`items_snapshot`（发布时题目集 JSON 快照），`share_token`（24 位随机令牌，唯一）。
- `fm_user_form_data` 新增 `version_no` 列：答卷绑定的不可变版本。
- 存量回填：70 个已有答卷的问卷按当前题目生成 v1 快照（此前"发布后冻结"补丁保证题目未被改过），128 份历史答卷绑定 v1。

**行为契约**：
1. **发布**：题目集冻结为版本快照（v1），生成 `/s/{formKey}?t={token}` 随机令牌链接；同一问卷重新发布生成 v2 新令牌，并自动关闭 v1（一卷同时只有一个收集中的版本）。
2. **冻结规则**：收集中（RELEASE）题目增/改/删/批量全部拒绝；**停止收集后可修改草稿**（为下一版本准备），改的是活题目，已发布快照与旧答卷不受影响。
3. **旧链接**：带旧令牌的链接始终加载**旧版本快照内容**（旧标题、旧选项），页面显示停止提示条，提交被服务端拒绝（"该问卷版本已停止收集，请向发起者获取最新链接"）。无令牌的旧式链接服务最新发布版本（兼容）。
4. **答卷绑定**：公开提交携带版本令牌，服务端校验版本归属与状态后按 `version_no` 入库；旧答案在后续一切编辑后逐字不变。
5. **统计口径**：`/report/analysis?version=` 与 `/report/stats?version=` 按版本过滤（题目取该版本快照、答卷取该版本绑定）；默认最新发布版本；统计页"数据分析"标签提供版本选择器。不同版本的题目与答卷互不混算。

**后端**：`patches/tduck-backend/version-snapshots.patch`（第三份补丁，在另两份之后应用；9 个文件修改 + 3 个新文件：`UserFormVersionEntity/Mapper/Service`）。构建链 `Build-FullBackend.ps1` 已接入第三份补丁。冻结规则由"仅未发布可编辑"改为"仅收集中冻结"——这是 M1 计划（"发布后修改草稿→重新发布产生新版本"）要求的语义升级，配套更新了 `backend-security.mjs` 回归（见 §3 失败记录）。

**前端**（5 个文件）：发布页链接带 `?t=` 令牌并显示当前版本号；答题页解析令牌、绑定版本提交、旧版本停止提示条；统计页版本选择器；`BizProjectForm` 按令牌取版本快照。

## 3. 实际执行的验证（全部真实运行，无 mock）

| 命令/检查 | 成功 | 失败 | 证据 |
|---|---:|---:|---|
| `node scripts/tduck/version-flows.mjs`（版本机制专项） | 20 | 0 | 本文件 §5 |
| `node scripts/tduck/backend-security.mjs`（更新至新语义） | 6 | 0 | `evidence/tduck-full/backend-security.json` |
| `npm.cmd test`（tduck-vue3） | 31 | 0 | 25 历史原型 + 6 协议/校验 |
| `npm.cmd run build` | 1 | 0 | 17.4s 通过（大包提示沿用） |
| `npm.cmd run test:e2e` | 12 | 0 | `e2e-results.xml` |
| `scripts/tduck/Verify-HTTP.ps1` | 15 | 0 | `http-results.json` |
| 重启 8997 后复验版本数据 | 1 | 0 | 版本列表/快照/统计/答卷绑定全部保持 |
| 浏览器验证（旧令牌链接/版本选择器） | 2 | 0 | `16-version-analysis-v1.png`、`17-old-link-v1-stopped.png` |

**version-flows 20 项**覆盖：发布返回版本号+24位令牌 / 收集中改题被拒 / 令牌链接读快照 / 无令牌链接取最新版 / v1 答卷绑定 version_no=1 / 停收后可改可增题 / 重发生成 v2 新令牌 / 版本列表 v1 停+v2 收 / **旧令牌链接加载 v1 旧内容** / 快照未被改题污染 / **旧版本提交被服务端拒绝** / 新令牌加载 v2 内容 / v2 答卷绑定 2 / **v1 旧答案原文不变** / 统计 v1 只含旧答卷旧选项 / 统计 v2 只含新答卷新选项 / 默认口径=最新版 / stats 返回版本标识 / 无效令牌拒绝。

**真实失败与修复**（保留记录）：
1. e2e 首跑 11/12：`backend-security` 断言的是旧冻结语义（停收后不可改题）——按 M1 新契约更新该回归（收集中冻结 + 停收可改 + 快照/答卷不变断言），复跑 12/12。
2. `Apply-VersionMigration.ps1` 首跑假失败：PS5.1 `Get-Content` 默认按 GBK 读 UTF-8 SQL 导致临时文件乱码；加 `-Encoding UTF8` 修复并验证幂等重跑。
3. 8997 运行中执行构建被脚本运行保护拦截（预期行为；先停自有实例再重建）。

## 4. 验收指南 M1 剧本对照

| 验收项 | 结果 | 依据 |
|---|---|---|
| 1. 四题型建卷、保存刷新不丢 | ✓ | e2e smoke-full（真实浏览器） |
| 2. 两个独立会话提交满意/不满意 | ✓ | closure-flows（e2e 内含） |
| 3. 回收数=2、单选各 1/50%、图表与记录一致、刷新不变 | ✓ | closure-flows 断言 + 本轮复跑 |
| 4. 再提交不变成 3 份 | ✓ | closure-flows 8 并发同会话=1 份 + 浏览器刷新重试 |
| 5. 另一账户访问管理 API 被拒 | ✓ | backend-security 6/6 |
| 6. 发布后改题：旧链接加载旧版内容、旧答案绑定原版本 | ✓ | **本轮新增机制，20/20** |
| 7. 重启后数据保留 | ✓ | 本轮重启复验 |
| 8. 关闭 AI 仍能完成普通问卷流程 | ✓ | 本阶段未集成任何 AI，全流程无 AI 依赖 |

## 5. PowerShell 操作步骤（可复现）

```powershell
cd D:\LcProject
# 重建前先停止自己启动的 8997 实例（脚本有运行保护，勿停其他端口）
.\scripts\tduck\Build-FullBackend.ps1          # 三份补丁在全新源码副本应用并编译
.\scripts\tduck\Apply-ClosureMigration.ps1     # 002 提交回执（幂等，已执行过）
.\scripts\tduck\Apply-VersionMigration.ps1     # 003 版本快照（幂等；输出版本数与绑定答卷数）
.\scripts\tduck\Start-FullBackend.ps1 -Background
cd D:\LcProject\tduck-vue3
npm.cmd run dev                                 # 5180
# 回归
cd D:\LcProject
node scripts\tduck\version-flows.mjs
cd tduck-vue3 ; npm.cmd test ; npm.cmd run test:e2e ; npm.cmd run build
cd .. ; powershell -ExecutionPolicy Bypass -File scripts\tduck\Verify-HTTP.ps1
```

数据库迁移版本：`db/tduck/002_public_submission.sql`（上轮）+ `db/tduck/003_form_versions.sql`（本轮）。

## 6. 已知边界与未完成

- ~~数据页（表格）未按版本过滤~~：**2026-10-25 修复轮已解决**——数据页提供版本选择器（默认最新版本），表格列头、答卷详情、导出与附件下载均按所选版本的题目渲染，见 §8。
- 无令牌旧式链接（`/s/{key}`）始终服务最新发布版本；带 `?t=` 的链接固定版本。本轮之前分发出的链接属无令牌形态。
- 每问卷同时只有一个收集中的版本；重发布自动关闭旧版本，旧版本链接可看不可交。
- 存量回填的快照正确性依赖此前"发布后冻结"补丁（发布后题目未再修改）；此前经"复制新问卷"修改的问卷不受影响（新问卷独立 formKey）。
- **历史版本的表单级快照（标题/描述/逻辑/主题）按迁移时的当前值回填**（发布时原值不可再考，见 §8 缺陷2）；004 迁移之后的新发布版本均为发布时真实快照。
- 短信/微信/地图/文件存储/真实 AI 未联调（沿 CORE_CLOSURE 边界）；不宣称与原版全功能等价。
- 构建/测试均针对隔离库 `tduck_vue3_dev`；原库未动。

## 7. 自检

- 是否满足本阶段验收闸门：**PASS（待用户手工复验确认）**。
- 2026-10-25 修复轮（四项缺陷：明文凭证/快照不完整/跨版本回执冲突/历史答卷当前题展示）已完成并全量回归通过，见 §8。
- 本轮不进入 M2；若 FAIL 按指南先补回归再修复。
- 手工复验建议：按 §4 对照表在 5180 走一遍；重点体验发布→复制带 `?t=` 的链接→停收→改题改名→重发布→旧链接打开看旧标题与停止提示条→统计页与数据页切换 V1/V2。

## 8. 修复轮（2026-10-25）：四项缺陷，测试先行

用户验收前审查提出四项缺陷，全部按"先补回归测试（记录修复前真实失败）→ 修复 → 复验"流程处理。专项测试已纳入自动化套件（见 §8.6 命令）。

### 8.1 缺陷1：明文凭证（跟踪文件含真实账号/口令）

- **根因**：`scripts/tduck/version-flows.mjs` 硬编码管理员邮箱/密码（登录）与 `-p123456`（MySQL root，命令行）。
- **回归测试**：`scripts/tduck/credential-scan.mjs`（无需后端）——从 `.local/tduck-credentials.json`（gitignored）读取当前真实凭据，扫描全部 Git 跟踪文本文件（441 个）不得出现这些值或长 Bearer 令牌；同时校验 `.local/` 已被忽略。修复前：3 处命中（version-flows.mjs:12/25）→ FAIL。
- **修复**：version-flows.mjs 改用 `.local/tduck-dev/acceptance.json` fixture 账号登录、数据库口令改读凭据清单；其余脚本本就从 `.local` 读取（核实无需改动）；新约定：凭据只存放于 `.local/`。复验：扫描 3/3 PASS，命中 0。
- 结果文件：`evidence/tduck-full/credential-scan.json`（仅文件/行号/规则名，不含凭据值）。

### 8.2 缺陷2：版本快照不完整（只冻结题目，表单级信息未冻结）

- **根因**：`fm_user_form_version` 仅有 `items_snapshot`；详情接口的标题/描述取自当前 `fm_user_form` 行、主题与显示逻辑取自实时表——改名或改逻辑后旧链接跟着变。
- **回归测试**：`scripts/tduck/version-fixes.mjs` A 组（5 项断言）。修复前：2-1..2-5 全部 FAIL（旧令牌标题变为草稿改名、描述同、新逻辑出现在旧链接、快照列不存在）。
- **修复**：版本新增 `form_snapshot`（标题/描述/类型）`logic_snapshot` `theme_snapshot`；发布时冻结，详情接口按快照还原（快照缺失=历史版本回退当前值；空集合哨兵 `[]`/`{}` 表示"发布时无逻辑/无主题"，防止发布后新增逻辑污染旧版本）。迁移 `db/tduck/004_version_fixes.sql` 对存量 96 个版本按当前值回填（历史原值不可再考，已知边界）。
- 复验：6/6 PASS（含发布后改名/改逻辑不影响旧链接、无令牌链接显示发布时标题）。

### 8.3 缺陷3：跨版本提交回执冲突（同一会话键被 v1 回执吞掉）

- **根因**：`fm_public_submission` 主键仅 `(form_key, session_hash)`；回放查找不带版本——同一浏览器标签页（sessionStorage 按问卷存键，跨版本复用）在 v2 提交时直接回放 v1 答卷号，v2 答卷被静默丢弃。
- **回归测试**：version-fixes.mjs B 组（5 项断言）。修复前：3-2/3-4/3-5 FAIL（v2 提交 replayed=true 返回 v1 答卷号、回执仅 1 条、库中只有 1 份 v1 答卷）；同版本幂等（3-1）修复前后均 PASS。
- **修复**：回执表加 `version_no` 并入主键 `(form_key, session_hash, version_no)`；提交流程版本解析前置，回执按版本分键；前端提交键改为 `tdSubmission:{key}:v{version}`（按版本隔离）。迁移 004 回填存量 75 条回执（按其答卷版本，无版本记 0）。
- 复验：5/5 PASS（跨版本同键各自成卷、双版本回执并存、同版本重放幂等保持）。

### 8.4 缺陷4：历史答卷使用当前题目展示

- **根因**：答卷详情 `GET /user/form/data/details/{id}` 与数据页字段 `GET /user/form/fields/{key}` 都取实时题目；数据列表 `/user/form/data/query` 无版本过滤——旧答卷列头/详情按当前题渲染。
- **回归测试**：version-fixes.mjs C 组（8 项断言）。修复前：4-1/4-3/4-5/4-6 FAIL（v1 答卷详情显示新题目、字段接口忽略 version 参数、列表不过滤）；4-7（不带版本参数兼容返回全部）修复前后均 PASS。
- **修复**：字段接口支持 `?version=`（快照生成，含默认字段）；答卷详情按该答卷 `version_no` 的快照渲染；列表查询支持 `versionNo` 过滤（兼容：不传=全部）；前端数据页新增版本选择器（默认最新），列头/详情/导出/附件下载口径联动；**连带发现并修复**：Excel 导入答卷未绑版本（`version_no=NULL`，被版本视图排除）——导入现绑定最新发布版本（由 e2e data-roundtrip 真实失败暴露并复验通过）。
- 复验：8/8 PASS + data-roundtrip 4 项 PASS + 浏览器实测（见 8.5）。

### 8.5 浏览器实测（IAB，5180）

- 数据页版本选择器：默认 V2 仅 1 份（列头"新题目Q"、值 新X）；切换 V1 仅 1 份（列头"旧题目Q"、值 旧A）。截图 `18-data-version-v1.png`、`19-data-version-v2.png`。
- 旧链接标题快照：发布"现场验证标题发布时A"→草稿改名→旧 `?t=` 链接标题仍为"现场验证标题发布时A"。截图 `20-old-link-snapshot-title.png`。
- 过程中发现并修复：版本号异步写入 `queryParams` 晚于表格首查，补一次 `handleReloadTable()`（否则默认视图仍显示全部版本答卷）。

### 8.6 修复轮全量回归结果（2026-10-25，全部真实运行）

| 套件 | 结果 |
| --- | --- |
| credential-scan.mjs（缺陷1专项） | 3/3 PASS（441 个跟踪文件 0 命中） |
| version-fixes.mjs（缺陷2/3/4专项，22 项） | 22/22 PASS（修复前 12 项 FAIL，记录存 `.local/m1-fixes-prefail.json`） |
| version-flows.mjs（版本机制回归） | 20/20 PASS |
| backend-security.mjs（安全回归） | 6/6 PASS |
| Verify-HTTP.ps1 | 15/15 PASS |
| data-roundtrip.mjs（含导入绑定版本） | 4/4 PASS（exit 0） |
| vitest 单测 | 31/31 PASS |
| Playwright e2e | 12/12 PASS |
| 后端重启持久化 | 3/3 PASS（快照/回执分键/按版本查询重启后不变） |
| 浏览器抽查 | 3/3 PASS（截图 18/19/20） |

环境事件（如实记录）：验证期间本机 MySQL80 服务一度停止（非本项目操作导致，用户手动重启）；Vite dev server 掉线一次（重启恢复）；两者恢复后上述全部套件在同一构建上重跑通过。

### 8.7 本轮修改清单

- 迁移：`db/tduck/004_version_fixes.sql` + `scripts/tduck/Apply-FixMigration.ps1`（幂等，已应用：96 版本快照补全、75 回执版本回填、回执主键改三元）。
- 后端（进入 `patches/tduck-backend/version-snapshots.patch`，构建链仍为 3 个补丁，纯净源码重建通过）：`UserFormVersionEntity/Service`（快照扩展+还原）、`PublicSubmissionMapper/Service`（回执按版本）、`UserFormController`（详情快照还原、字段接口 version 参数）、`UserFormDataServiceImpl`（详情按版本）、`QueryFormResultRequest`/`FormDataMysqlService`（列表版本过滤）、`FormDataImportUtils`（导入绑最新版本）、`UserFormDetailVO`（无参构造）。
- 前端：`write/index.vue`（提交键带版本）、`data/index.vue`（版本选择器+联动刷新）、`api/project/form.js`（字段接口 version 参数）。
- 测试：新增 `credential-scan.mjs`、`version-fixes.mjs`；`version-flows.mjs` 去 hardcoded 凭据改 fixture；`closure-flows.mjs` 会话键断言改为前缀匹配（键名语义随缺陷3修复有意变更）；`backend-security.mjs` 不变。

复现命令（PowerShell，D:\LcProject）：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/tduck/Build-FullBackend.ps1     # 纯净源码+3补丁重建
powershell -ExecutionPolicy Bypass -File scripts/tduck/Apply-FixMigration.ps1    # 004 迁移（幂等）
powershell -ExecutionPolicy Bypass -File scripts/tduck/Start-FullBackend.ps1 -Background
node scripts/tduck/credential-scan.mjs
node scripts/tduck/version-fixes.mjs
node scripts/tduck/version-flows.mjs
node scripts/tduck/backend-security.mjs
```
