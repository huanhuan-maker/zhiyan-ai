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

- **数据页（表格）未按版本过滤**：列出全部版本答卷，列头按当前题目；版本口径统计走统计页"数据分析"标签或 `/report/analysis?version=`。按版本筛选答卷列表留待后续。
- 无令牌旧式链接（`/s/{key}`）始终服务最新发布版本；带 `?t=` 的链接固定版本。本轮之前分发出的链接属无令牌形态。
- 每问卷同时只有一个收集中的版本；重发布自动关闭旧版本，旧版本链接可看不可交。
- 存量回填的快照正确性依赖此前"发布后冻结"补丁（发布后题目未再修改）；此前经"复制新问卷"修改的问卷不受影响（新问卷独立 formKey）。
- 短信/微信/地图/文件存储/真实 AI 未联调（沿 CORE_CLOSURE 边界）；不宣称与原版全功能等价。
- 构建/测试均针对隔离库 `tduck_vue3_dev`；原库未动。

## 7. 自检

- 是否满足本阶段验收闸门：**PASS（待用户手工复验确认）**。
- 本轮不进入 M2；若 FAIL 按指南先补回归再修复。
- 手工复验建议：按 §4 对照表在 5180 走一遍；重点体验发布→复制带 `?t=` 的链接→停收→改题→重发布→旧链接打开看旧内容与停止提示条→统计页切换 V1/V2。
