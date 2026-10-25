# M2 验收证据｜AI 问卷草稿设计

日期：2026-10-25，Asia/Shanghai。范围：按用户授权进入 M2；不含 M3 自适应追问、M4 主题发现、M5 AI 分析报告。自检结论 **PASS（待用户手工验收确认）**。

## 1. 流程与规格映射

目标流程：输入调查目标/目标人群/期望题数 → AI 生成结构化草稿 → 服务端校验 → 导入现有四题型编辑器 → 人工修改/保存/预览 → 用户手动发布。

| 要求 | 实现 | 验证 |
| --- | --- | --- |
| 1 复用四题型与 M1 发布版本机制，不另建编辑器 | 草稿导入 = `POST /user/form/item/create` 逐题建（与设计器同构）→ 跳转现有 `/project/form/editor`；发布完全走 M1 发布/版本快照 | M2-15/16/17、UI-6/7/8 |
| 2 Provider 服务端统一调用，密钥仅服务端私有配置 | `com.tduck.cloud.form.ai.OpenAiCompatibleProvider`（hutool HTTP，Bearer 鉴权）；密钥在 `.local/tduck-dev/application-local.yml`（gitignored），前端/日志/数据库无密钥 | M2-3/4、单测 statusReportsRealProvider |
| 3 页面显示 Provider、模型、真实 AI / Mock 状态 | `/user/form/ai/status` → 页面状态栏标签（真实 AI 绿 / Mock 橙 + 说明） | UI-1、M2-20 |
| 4 校验题型/题数/选项唯一/量表范围/必填；无效输出不得保存或发布 | `AiDraftValidator`：题型白名单（RADIO/CHECKBOX/RATE/TEXT→TEXTAREA）、题数=期望、选项 2-20 且唯一、rateMax 2-10、题干非空且不重复、至少 1 道开放题；error 级拒绝；warning 级（诱导措辞/选项过少）供人工审核 | 单测 18 项 + M2-10~14 |
| 5 无密钥/超时/坏 JSON 可恢复；手工建卷答题不受影响 | 无密钥自动 Mock；超时/网络/非 200 → 可恢复提示；坏 JSON/坏结构 → 明确拒绝；AI 端点独立，不影响现有流程 | M2-5~7/18~21、单测 brokenJson/invalidOutput/timeout |
| 6 AI 只生成草稿，不自动发布、不改已发布问卷 | AI 端点零写库；导入创建的是 CREATE 状态问卷；发布/停收/改题全由用户在现有编辑器/发布页手动操作 | M2-17、UI-8 |
| 7 配置缺失询问用户 | 已按用户指示配置本机推理网关（Provider 展示名"本机推理网关"，模型 `group/group`） | §4 真实验证 |
| 8 自动化回归 + ≥1 次真实模型验证 + 运行步骤 + 证据 + 提交 | 见 §3/§4/§6 | 全部真实运行 |

## 2. 实现

**后端**（新增 `patches/tduck-backend/ai-draft.patch`，第 4 个补丁；构建链 = 原始源码 → 4 补丁 → Maven，纯净重建通过）：
- `tduck-form/.../ai/`：`AiProvider` 接口、`OpenAiCompatibleProvider`（OpenAI 兼容 chat/completions，读 `ai.provider-name/base-url/api-key/model/timeout-ms`）、`MockAiProvider`（无密钥降级，确定性模板、明确标注 Mock）、`AiDraftValidator`（纯函数校验器）、`AiDraftService`（输入校验→prompt→Provider→剥壳解析→校验→返回；无密钥时自动 Mock）、`AiDraftInput`/`AiDraftSpec` 契约。
- `tduck-api`：`AiDraftController`（`GET /user/form/ai/status`、`POST /user/form/ai/draft`，均需登录，未登录 401）。
- 澄清路径：目标含糊时模型返回 `{"kind":"clarification",...}`，页面展示澄清问题与初步假设，补充后重新生成（M2-9 覆盖）。

**前端**（`tduck-vue3`）：
- 新页 `src/td/views/form/ai-draft/index.vue`（路由 `/project/form/ai-draft`）：状态栏、三项输入+补充信息、草稿预览（题型标签/必填/选项/量表范围/审核提示/设计假设/预设维度）、"导入编辑器继续编辑"。
- 入口：我的项目页"AI 智能建表"按钮改指新页。原版 `ChatFormDialog`（调社区版 `tduck-ai` 的 `/ai/gen-form-chat` 流式接口、无草稿校验）保留未用，M2 按规格新做服务端校验链路。
- `vite.config.ts` 代理超时 15s→120s（真实模型生成常超 15s，后端 AI 超时 90s）。

## 3. 自动化回归结果（全部真实运行，无 mock 冒充真实）

| 套件 | 结果 | 覆盖 |
| --- | --- | --- |
| `scripts/tduck/ai-draft.mjs`（21 项） | 21/21 PASS | 权限 401；状态真实标注且不含 Key；输入校验（空目标/题数 0/31）；真实模型生成（题数=6、四题型、开放题、选项唯一、量表合法、假设齐）；导入编辑器（题目可读、status=1 未发布）；手工建卷/发布/答题不受影响；无密钥 8996 实例 → Mock 标注 + Mock 草稿过同一校验 |
| Java 单测 `AiDraftServiceTest`（18 项） | 18/18 PASS | 校验器全规则；Mock 链路；markdown 剥壳；坏 JSON 拒绝；坏草稿（重复选项/题数不符）拒绝；超时转可恢复提示；状态不回显密钥 |
| `scripts/tduck/m2-ui-flows.mjs`（9 项，Edge 无头真实 UI） | 9/9 PASS | 状态栏"真实 AI · 本机推理网关 · group/group"；剧本输入生成 6 题；开放题/量表标注；"不写库不发布"提示；导入跳编辑器 6 题可编辑无冻结；无前端报错 |
| 既有套件回归 | version-fixes 22/22、version-flows 20/20、backend-security 6/6、Verify-HTTP 15/15、vitest 31/31、Playwright e2e 12/12 | M1 行为未受影响 |

修复过程中真实失败并已修复（如实记录）：单测抓到 Mock 模板题干重复；`ai-draft.mjs` 两次脚本自身 bug（headers 未展开、8996 jar 相对路径）；前端经 Vite 代理 15s 超时导致生成静默失败（改 120s + 显式错误提示）；AI 页面 import 路径笔误。

## 4. 真实模型验证（≥1 次）

- 用户指定本机推理网关（`http://127.0.0.1:3425/v1`，OpenAI 兼容；模型 `group/group`，网关实际路由到 deepseek-v4.1-flash 等后端）。
- 冒烟：UTF-8 请求/响应正常（曾出现控制台 GBK 乱码，经文件落盘验证为控制台显示问题，网关本身 UTF-8 正常）。
- 真实生成实测：`ai-draft.mjs` M2-8~14（剧本输入，6 题，4.2s 级响应）+ `m2-ui-flows.mjs` UI-2~4（浏览器全链路）。证据 JSON 记录 Provider/模型/题数/题型/耗时，**不含 API Key**。
- 至少 8 次真实调用成功（脚本 + UI 各多次），其中 1 次由真实模型返回 clarification 路径在单测外未复现（模型对剧本输入直接给出草稿；澄清路径由 Mock 与单测覆盖契约）。

## 5. 验收剧本对照（ACCEPTANCE_GUIDE M2）

- [x] 输入"我想研究大学生为什么不想参加社团，包含没参加过和已经退出两类人"→ 生成含结构化题型与开放题的草稿（`ai-draft.mjs` + UI 流程，截图 21/22）。
- [x] 人工修改后发布：导入编辑器（截图 23）→ 用户在编辑器改题/保存 → 发布页手动发布（复用 M1，发布后版本快照/统计/数据全套不受影响——既有套件验证）。
- [x] 空白/无效数量：M2-5/6/7，可恢复提示不崩溃。
- [x] 歧义目标：澄清路径（澄清问题+假设展示，补充后重新生成；M2-9）。
- [x] 人为坏 JSON/非法题型/重复选项：单测 brokenJsonOutput/invalidType/duplicateOptions 拒绝；未通过校验的草稿不返回、不落库。
- [x] 未配置真实 Key：8996 无密钥实例 → 状态明确 Mock、不假称真实 AI（M2-20），Mock 草稿过同一校验（M2-21）；手工建卷/填写/提交正常（M2-18）。
- [x] Provider 名称+模型+成功响应结构+失败处理可核查；Key 未出现在聊天、日志、证据中。

## 6. 复现步骤（PowerShell，D:\LcProject）

```powershell
# 1) 后端：四补丁链构建 + 启动（AI 密钥已在 .local/tduck-dev/application-local.yml 的 ai: 段）
.\scripts\tduck\Build-FullBackend.ps1
.\scripts\tduck\Start-FullBackend.ps1 -Background
# 2) 前端：5180
cd tduck-vue3; npm.cmd run dev
# 3) 回归
node scripts\tduck\ai-draft.mjs        # API 级 21 项（含真实模型与 Mock 降级）
node scripts\tduck\m2-ui-flows.mjs     # UI 级 9 项（Edge 无头，生成 21/22/23 截图）
# Java 单测（18 项）
$env:JAVA_HOME='D:\jdk\jdk17'; & 'D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd' -q -f .local\tduck-closure-build\pom.xml -pl tduck-api -am test "-Dtest=AiDraftServiceTest" "-DfailIfNoTests=false"
# 4) 手工体验：登录 → 我的项目 → "AI 智能建表" → 填三项 → 生成 → 审核预览 → 导入编辑器 → 手动发布
```

## 7. 遗留事项（保留记录，未解决）

- **验收报告的明文凭据处理**：`evidence/tduck-full/M1_VERSIONS.md` §8.1 根因描述含口令字样（0b1fe4c 引入）。按用户指示保留记录、不标已解决；`credential-scan.mjs` 已将该处登记为遗留豁免并持续明示 `[遗留·未解决]`，**本轮新增文件 0 命中**（447 个跟踪文件）。
- **专项测试接入统一入口**：各专项脚本仍按 README 步骤逐个运行（本轮新增 ai-draft/m2-ui-flows 同样列入 README），未做统一 runner。
- 本阶段不宣称：多轮对话式建表、英文问卷质量、网关长时间稳定性、生成内容学术质量（人工审核仍是闸门）。

## 8. 本轮修改清单

- 新增：`patches/tduck-backend/ai-draft.patch`（10 个新 Java 文件）、`db` 无变更（AI 草稿不落库）。
- 前端：`views/form/ai-draft/index.vue`、`api/project/ai.js`、`router/modules/form.js`（ai-draft 路由）、`views/project/my/index.vue`（入口按钮改指新页）、`vite.config.ts`（代理超时）。
- 脚本：`scripts/tduck/ai-draft.mjs`、`scripts/tduck/m2-ui-flows.mjs`、`credential-scan.mjs`（遗留豁免分类）、`Build-FullBackend.ps1`（第 4 补丁接入）。
- 证据：本文档、`ai-draft.json`、`m2-ui-flows.json`、截图 21/22/23。
