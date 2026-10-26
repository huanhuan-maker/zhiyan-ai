# TDuck 二次开发交接文档（知研 AI 2.0）

交接日期：2026-10-25（Asia/Shanghai）。项目目录：`D:\LcProject`，分支 `codex/tduck-full-vue3`，HEAD `418bf80`（未 push）。

**一句话现状**：知研 AI 2.0 已从"自研 Vue3+Boot 工程"转向 **TDuck 社区版二次开发**（Vue3 重写前端 + 补丁版后端），交付推进到 **M5-C（简化版问卷助手）**；工作树有 70 个未提交条目（疑似另一会话正在改 assistant 模块），接手前先与用户确认处置方式，勿 reset/clean。

## 1. 演进线（读旧文档前必看）

| 时代 | 内容 | 位置 |
|---|---|---|
| 旧自研（已归档） | 知研 M0/M1：`frontend/`、`backend/`（cn.zhiyan），M1 验收报告见 `evidence/M1_REVIEW.md` | **勿再开发**，历史价值保留 |
| TDuck 转向（2026-10-24） | 用户决定按 TDuck v6 二次开发；Codex 整体迁移 392 文件（`2799e38`），前端 `tduck-vue3/` 原生 Vue3 重写设计器（未用 form-create/闭源 dist） | 活跃主线 |
| M1–M5-C（2026-10-24~25） | 版本快照(786ed74)→M1修复(0b1fe4c)→M2 AI草稿(872d82e)→M3 追问已交付后**按用户要求停用**(228a7f5)→M4-R 统计报告→M5-A/B/C 助手+AI配置 | `README.md` 头部有各轮入口 |

`docs/AGENT_HANDOFF.md` 是旧自研 M1 的交接，**已过时**，仅作历史参考。根 `AGENTS.md` 部分内容仍描述旧路线，与 TDuck 现实冲突时以用户决策和本文档为准；但其中"老师强制栈"（Vue3+ECharts / Spring Boot+MyBatis-Plus / MySQL，禁 React/JPA）仍然有效——TDuck 后端与该栈吻合。

## 2. 运行拓扑与启动

| 端口 | 服务 | 说明 |
|---|---|---|
| 5180 | `tduck-vue3` Vite dev server | `cd tduck-vue3 && npm.cmd run dev`（vite.config 已 `--host 127.0.0.1 --port 5180 --strictPort`） |
| 8997 | **当前开发后端**（补丁 JAR） | `.local/tduck-dev/tduck-api.jar`，连库 `tduck_vue3_dev`(3306, root/123456)；含版本快照/AI 草稿/公开提交校验等补丁 |
| 8999 | 原版 TDuck 后端（D:\tduck-survey-form-master） | **勿动**，仅对照用 |
| 3425 | 本机推理网关 `/v1`（OpenAI 兼容，key 在 `.local/tduck-dev/application-local.yml` 的 ai: 段） | 展示名一律写"本机推理网关"，key 不得进 UI/证据/跟踪文件 |

推荐启动：`scripts/tduck/Start-FullBackend.ps1 -Background`（后端）+ 前端 dev。**PID 不固定，先 `Get-NetTCPConnection -State Listen -LocalPort 8997,5180` 查端口再决定启停**；停止后端按 PID taskkill，勿批量杀 java。MySQL80 服务为系统服务（3306）。

前端代理：`/tduck-api` → 8997（已去前缀）；**Vite 代理 timeout 已改 120s**（原 15s 会静默掐死真实模型生成，勿改回）。

## 3. 目录地图

```
tduck-vue3/                 # 前端主线（Vue3+Vite+Element Plus+ECharts）
  src/td/views/
    home/                   # 工作台外壳（.home-container），子路由：我的问卷 /home、member、assistant /home/assistant
    project/my/             # 问卷列表（卡片 card.vue / 表格 table.vue）
    form/                   # 外壳 .form-index-container，子路由 /project/form/{editor,ai-draft,logic,preview,setting,publish,theme,data,statistics}
    form/write/             # 公开填写页 /s/:key（浅色设计，勿套深色）
    form/ai-draft/          # M2 AI 建卷（/project/form/ai-draft）
    assistant/              # M5 问卷助手（.assistant-page）
    account/                # login / ForgetPwd / validate / member
    manage/{user,system}    # 管理页（需 admin）
  src/td/assets/styles/     # ★ 设计令牌与深色模式（见 §5）
backend-extensions/         # 后端补丁源码：ai-config / analysis / assistant / tduck-api / tduck-form
patches/                    # 后端补丁链（version-snapshots、ai-draft 等 .patch）
scripts/tduck/              # 启动/构建/迁移/验证脚本全家桶（见 §7）
evidence/                   # M5-A/B/C.md、tduck-full/ 各轮实测与截图
.local/                     # 被忽略：JAR、application-local.yml、凭据清单 tduck-credentials.json、日志
```

## 4. 后端与数据库要点

- 后端 = TDuck v6 源码 + `backend-extensions/` 扩展（`com.tduck.cloud.form.ai`、assistant、analysis）+ `patches/` 补丁链，构建产物为 `.local/tduck-dev/tduck-api.jar`（`Build-FullBackend.ps1`）。
- 关键表：`fm_user_form_item`（题目，form_item_id="field"+8hex 稳定 ID，scheme JSON）、`fm_user_form_data`（答卷 original_data JSON Map 按 formItemId 键控，`version_no` 绑定版本）、`fm_user_form_version`（**发布快照**：form/logic/theme_snapshot，空集合哨兵）、`fm_public_submission`（回执，主键 (form_key,session_hash,version_no) 幂等）。
- 迁移 SQL：`.local/tduck-dev/003_form_versions`、`004_version_fixes` 等，配套 `Apply-*Migration.ps1`（幂等，勿重复手跑）。
- 已知语义：发布=生成快照，`/s/{key}?t=令牌`；重发 v2 自动关 v1；**仅"收集中"冻结**（停收后可改草稿）；旧令牌加载旧快照并拒绝提交；统计/数据接口带 `?version=`（默认最新）。
- 公开提交 `POST /user/form/data/public/create` 服务端无必填校验=已知历史风险（补丁已加部分校验，改动提交链路时注意）。
- 管理员：（账号见本机私有配置） / （密码见本机私有配置）（id=1）。凭据只存 `.local/tduck-credentials.json`（gitignored），跟踪文件出现明文口令会被 `credential-scan.mjs` 拦下。

## 5. 前端设计体系与深色模式（本会话刚修完，重要）

- **令牌**：`src/td/assets/styles/workbench.scss` 定义 `--zy-*`（浅色在 `:root`，深色在 `.zy-dark`）。改色优先动令牌。
- **深色三层**：`.zy-dark` 挂在 `<html>`（`utils/workbenchTheme.js`：localStorage `zhiyan-workbench-theme`，无存储时跟随系统；同时设 `colorScheme`）。
  1. `workbench.scss` — 令牌浅/深双值；
  2. `workbench-dark.scss` — 逐页面容器覆盖（工作台/AI 建卷/过渡页/助手页）；
  3. `workbench-dark-admin.scss` — 根级 Element Plus 变量（`--el-bg-*`/`--el-text-*`/`--el-table-*` 等）+ 编辑器/数据/统计/管理页覆盖。
- 2026-10-25 修复（`418bf80`）：login/ForgetPwd/validate/助手页补深色；根级 `--el-table-*`（此前表格浅灰头）；编辑器侧栏被 scoped 样式压过加 `!important`；占位文字 `--zy-text-placeholder` #67758a→#8391a5（WCAG 5.3:1）。
- **新增页面规则**：自定义容器色必须同步在 `workbench-dark*.scss` 补 `.zy-dark` 覆盖；组件 scoped 样式与全局类同特异性时会赢，必要时 `!important`；EP 组件深色优先补 `--el-*` 变量而非逐组件覆盖。公开填写页/登录前页中，公开填写页保持浅色是设计决策。
- 验证方法：computedStyle 量化审计（扫描浅底亮度>180 的块 + 文字对比<4.5:1），比截图可靠；本会话脚本可重写（约 60 行 evaluate）。注意 IAB 截图对该站偶发 surface 超时，DOM 审计更稳。

## 6. 路由与功能入口

- 工作台 `/home`（外壳含侧栏：我的问卷/用户管理/系统配置，管理员 3 项、普通用户 1 项——模板库等入口已按用户要求移除，旧地址跳首页）。
- 编辑器 `/project/form/editor`（**四题型**：单选 RADIO/多选 CHECKBOX/量表 RATE/开放 INPUT+TEXTAREA，Codex 简化过，勿恢复 37 种枚举 UI）；AI 建卷 `/project/form/ai-draft`（真实 Provider 失败自动 Mock 且明确标注）。
- 助手 `/home/assistant`（M5-C：单聊天窗，只读 MCP 查询问卷/统计/原文，关键词检索，未做向量 RAG）。
- 管理页 `/manage/user`、`/manage/system`（router 守卫查 `userInfo.admin`；**当前登录用户无 admin 标记时会被重定向回 /home**——深色覆盖在该页未实测，样式已写）。
- AI 配置：系统配置→AI 配置（M5-B：自定义供应商/多模型/三种协议/思考强度等，密钥加密不回显）。

## 7. 验证脚本（scripts/tduck/，改完代码必跑相关项）

| 类别 | 脚本 | 说明 |
|---|---|---|
| 启动/构建 | `Start-FullBackend.ps1`、`Build-FullBackend.ps1`、`Initialize-Dev.ps1` | 后端 JAR 链 |
| 迁移 | `Apply-{Version,Fix,AiSettings,Analysis,Assistant,Closure,Followup}Migration.ps1` | 幂等，按需 |
| 核心回归 | `version-flows.mjs`(20)、`m2-fixes.mjs`(22)、`backend-security.mjs`、`Verify-HTTP.mjs`(15)、`data-roundtrip.mjs`、`question-roundtrip.mjs` | 版本/修复/安全/HTTP |
| AI | `ai-draft.mjs`(21)、`m3-*.mjs`、`m2-{ui-flows,import-recovery,slow-request,usability}.mjs` | M3 追问已停用但其脚本仍在 |
| 助手/配置 | `assistant-*.mjs`、`ai-settings-*.mjs`、`analysis-*.mjs` | M5 系列 |
| UI/安全 | `check-templates.mjs`、`credential-scan.mjs`、`workbench-dark-mode.mjs`、`capture-ui-refresh.mjs` | 提交前必过 scan |
| 验收 | `Admin-Acceptance.ps1`、`smoke-full.mjs`、`e2e`（Playwright，`tduck-vue3/playwright.config.ts`） | Edge/Chromium 无头 |

约定：测试脚本不得硬编码明文口令（用 `.local/tduck-credentials.json`）；修缺陷先写失败回归再修（历史惯例，`.local/m1-fixes-prefail.json` 是先失败记录的范例）。

## 8. 当前工作树警告（接手第一件事）

未提交 70 项，主体：`backend-extensions/assistant/`（AssistantController/ChatService/Planner）、`README.md`、`docs/{ACCEPTANCE_GUIDE,DEVELOPMENT_PLAN}.md`、`evidence/tduck-full/` 大量截图与 JSON、两个 zip。**这大概率是另一会话未完成的 M5 后续改动**。接手后：先 `git status --short` 全览，向用户确认"接着做 / 保留冻结 / 由原会话收尾"，不要静默覆盖或提交别人的半成品。本会话已提交的只有深色修复 `418bf80`（4 个 scss 文件）。

## 9. 坑清单（每条都真实踩过）

1. **PS5.1**：`$ErrorActionPreference='Stop'` + 原生 stderr 重定向会中断脚本（NativeCommandError）；`Get-Content` 读 UTF-8 必须 `-Encoding UTF8`；本机无 PS7。跑后端命令用 `cmd /c "... > log 2>&1"` 包装。
2. **mysql.exe 子进程必须 `--default-character-set=utf8mb4`**，否则中文比对伪 FAIL。
3. **npm ci 文件锁**：dev server 运行时 esbuild.exe 被锁，先停 dev server 再 ci；且失败的 ci 会半删 node_modules。
4. **Vite 代理 timeout 120s 勿改回 15s**（真实模型生成会被掐死且无报错）。
5. **Windows curl -d 中文变 GBK** 是控制台编码问题非服务端问题（用文件落盘验证）。
6. **Java 单测只在标准路径执行**（`tduck-api/src/test/java`；`src/test/com` 下的 CacheTest 从不运行）。
7. **Playwright 找按钮**：原生 `<i>` 图标会改变 accessible name，按钮已加 `aria-label` 补救；点发布/关闭等带 `window.confirm` 的按钮会阻塞 click promise——先轮询 `getJsDialog()` accept。
8. **8997 重启后浏览器登录态可能过期**（token header 名是 `token` 而非 Authorization）。
9. MySQL80 是系统服务，验证期间可能被外部（用户/更新）停止；先查服务再排查应用。

## 10. 待办与已知边界

- **M1 两遗留**（用户明示保留）：`M1_VERSIONS.md` §8.1 明文口令字样历史记录、专项测试统一入口缺失。
- 深色模式：`/manage/*` 未实测（需 admin 会话）；公开填写页深色未实测（设计上保持浅色）。
- 数据页历史版本表单级快照按迁移时当前值回填 = 已知边界；数据页表格按版本过滤已修（`handleReloadTable` 补查）。
- 追问（M3）功能已交付但**产品上停用**（用户决策），勿自行重新启用。
- 每轮交付后**停下等用户验收**再推进下一阶段（README 头部各 M 的"当前交付"即等待验收的节点）。

## 11. 给下一个 Agent 的首条指令模板

```text
你接手 D:\LcProject 的知研 AI 2.0（TDuck 二次开发，分支 codex/tduck-full-vue3）。
先读 docs/TDUCK_HANDOFF.md 与 README.md 头部（当前 M5-C 等待验收），
再 git status 查看 70 个未提交条目并向我确认处置方式，不要 reset/clean/覆盖。
技术栈不可改：Vue3+Element Plus+ECharts（tduck-vue3）、Spring Boot+MyBatis-Plus+MySQL（8997 补丁后端）。
后端 8999 原版勿动；凭据只放 .local；改完代码跑 scripts/tduck 对应回归再提交。
UI 改动注意深色模式三层体系（workbench-dark*.scss），新增页面必须补 .zy-dark 覆盖。
```
