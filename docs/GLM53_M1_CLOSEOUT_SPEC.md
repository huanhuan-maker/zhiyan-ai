# GLM53 基础问卷收尾规格（给 Codex 的实现契约）

- 日期：2026-10-24 深夜。作者：GLM-5.3。
- 背景：四项预验收 32/32 通过（`evidence/GLM53/four-item-check.md`），但进入 M2 前有两个已确认缺口需要后端修复。本文件是两件事的精确契约，**验收测试已写好**：`node .local/glm53-accept/contract-red.mjs`，当前 4 RED，修复后应全 GREEN。实现方案细节由 Codex 决定，以下是我的建议。

## 一、提交幂等（同一答题会话只入库一份）

**现象**：`POST /user/form/data/public/create` 默认无去重，同一载荷连提两次入库两份（实测 `evidence/GLM53/four-item-check.md` ②）。每 IP 限次不能替代（校园网/宿舍共享出口 IP），且是设置项不是机制。

**契约（测试 A1/A2 编码的就是这个）**：
1. 提交体携带会话标识，建议复用现成列 `fm_user_form_data.ext_value`（varchar 255）承载 `answerSessionId`（前端 PublicForm 页加载时 `crypto.randomUUID()` 生成，存 sessionStorage，提交时带上；未带 extValue 的提交维持现状不限）。
2. 后端 public/create：`extValue` 非空时先查 `(form_key, ext_value)` 已有行——有则**直接返回已有行的 id**（幂等重放视为成功，不报错、不覆盖），没有才入库。
3. 并发同发两份（双击竞态）需兜底：推荐 Redis `SETNX` 锁或 `(form_key, ext_value)` 唯一索引（注意存量数据 ext_value 可能有重复/业务占用，上索引前先核查该列现有用途）。

**边界**：不改动 `/user/form/data/create`（登录态）与 `update`；编辑答案继续走 update 语义；extValue 为空不启用去重（兼容旧客户端/导入）。

**为 V3 预留**：同一 `answerSessionId` 之后也是追问预算的扣减主体（全问卷追问预算不可重复扣），命名和存储按这个用途长期保留。

## 二、四题型分析补齐（数值全部由后端计算）

**现象**：`FormDashboardServiceImpl.formReportAnalysis` 只统计 RADIO/CHECKBOX/IMAGE_SELECT/SELECT；量表均值、开放题原文完全不出现在 `/user/form/report/analysis`，统计页"数据分析"标签看不到这两类题（实测 ④）。

**契约（测试 B1-B4）**：
1. RATE 条目进入 analysis 返回，新增字段：`average`（有效答案均值）、`validCount`（有效人数）、`missingCount`（缺失数=提交总数−有效人数）。口径：分母=该卷提交总数（`fm_user_form_data` 行数），缺失含未答/空/0 星（0 视为未答，与生成器 defaultValue:0 一致——如按 0 星有效计数请先在测试里改期望再讨论）。
2. TEXTAREA/INPUT 条目进入 analysis 返回，新增 `texts`：开放题原文列表 `[{dataId, serialNumber, text, submitTime}]`（顺序按 serial）。**只回原文，不做事先的关键词归纳**——主题归纳是 V4 的活，且必须走证据溯源，不能在统计接口里顺手做。
3. 选择题条目保持现有结构不变（map/data），可顺带补 `validCount/missingCount` 同口径字段。
4. 前端 `statistics/analysis.vue`：量表渲染数值卡（均值/有效/缺失），开放题渲染原文列表（带序号与提交时间）。图表用 ECharts，数值一律取后端字段，前端不得自行计算。
5. 老师规则 8 合规：统计响应建议携带 `formKey` 与题目当前 label（已有），报告页注明分母口径。

## 三、顺序与分工

1. Codex 实现一、二（后端 + analysis.vue 前端展示；涉及 `.local/tduck-build` 补丁链记得同步 `patches/tduck-backend/` 与重建 8997 JAR）。
2. GLM-5.3 复跑：`node .local/glm53-accept/contract-red.mjs`（应 4→全 GREEN）+ `verify3/verify4` 回归（确保没破坏选择题统计与既有答卷）。
3. 全绿后用户按 M0.md 手工验收 5180（含计划中的"重复提交不增加数量"——该项必须等幂等落地后测，默认设置下现在测必然 FAIL）。
4. 三步确认后进入 M2（输入调研目标 → AI 生成可编辑草稿 → 人工审核发布）。M2 的 AI 调用、输出校验、测试归 GLM-5.3，设计稿我随后出。

## 附：契约测试现状（2026-10-24 深夜）

```
[RED] A1 同会话重复提交不新增答卷(行数=1) | 当前行数=2
[RED] A2 重复提交返回同一数据id | id1=211802 id2=211803
[RED] B1 analysis 包含量表条目 | 当前analysis=[]
[RED] B4 analysis 包含开放题条目(原文列表) | 当前A卷analysis条目=["你的年级","你常去的学习地点"]
```

测试卷：`GLM53收尾契约C`（1 道量表题）。测试脚本与已知值见 `.local/glm53-accept/`。
