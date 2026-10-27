# M5-J AI 建卷独立工作室（信息架构升级）

- 日期：2026-10-27
- 范围：前端信息架构与页面（Vue 3 + Element Plus），复用现有 AI 建卷后端接口，未改数据库与接口契约
- 结论：AI 建卷从「我的问卷」里的次级按钮升级为侧栏第一位的独立页面 `/home/ai`；生成、候选对比、草稿箱、导入编辑器形成闭环，全部验证通过

## 1. 之前的问题

| 现状 | 问题 |
| --- | --- |
| 侧栏只有「我的问卷 / 问卷助手 / 用户管理 / 系统配置」 | AI 建卷不是一级入口 |
| 「我的问卷」工具栏里一个次级按钮 | 视觉权重低于「新建问卷」，用户默认先手搓表单 |
| AI 建卷页在 `/project/form/ai-draft` | 看起来像某份问卷的附属页，不像独立工作室 |
| 三槽/进度/单题优化/设计助手/评审都藏在这一页里 | 能力齐全但用户感知不到 |

## 2. 新的信息架构

- 侧栏顺序：**AI 建卷** / 我的问卷 / 问卷助手 / 用户管理 / 系统配置
- 「我的问卷」页顶部新增 AI 横幅（一句话价值说明 + 主按钮），原来的 AI 建卷按钮也改为进入工作室
- 职责切分（不改动原有能力）：
  - **AI 建卷工作室 `/home/ai`** = 从想法到候选：描述需求 → 生成 → 最多 3 份候选对比 → 逐题预览 → 精修或导入
  - **AI 工作台 `/project/form/ai-draft`** = 深加工：逐题编辑、AI 单题优化、设计助手、问卷评审、预览答题、暂时保存
  - **问卷助手 `/home/assistant`** = 查数据/管问卷，保持不变

## 3. 工作室页面能力

1. 顶部价值说明区 + AI 模式标注（真实 AI / Mock，Provider 与模型放 tooltip，避免生硬的技术标识）
2. 需求输入：调查目标（必填）、目标人群（必填）、期望题数 chips（6/8/10/12/16/20）、补充信息（可选）
3. 4 个灵感示例，一键填充，解决「不知道怎么写目标」
4. 生成进度：复用 `DraftGenerationProgress`，真实阶段/耗时/失败重试，需求澄清时单独提示
5. 候选对比：最多 3 份并排，展示题量、用时、审核提示数、题型结构；可选中查看完整题目、丢弃单个候选
6. 一键动作：
   - **继续精修** → 存为账号草稿槽后打开工作台（`ai-draft?draft=<slotId>`）
   - **导入编辑器** → 直接生成未发布问卷并进入编辑器（与工作台共用同一条入库路径）
7. 我的 AI 草稿：列出账号草稿槽，可继续编辑或移除；空态给出如何产生草稿的说明
8. 深色为唯一外观，无换肤入口，窄屏（≤767px）单列排布

## 4. 变更文件

| 文件 | 变更 |
| --- | --- |
| `tduck-vue3/src/td/views/ai-create/index.vue` | 新增：AI 建卷工作室页面（输入、生成、候选对比、题目预览、草稿箱） |
| `tduck-vue3/src/td/router/modules/root.js` | 新增子路由 `/home/ai` |
| `tduck-vue3/src/td/views/home/index.vue` | 侧栏新增并置顶「AI 建卷」；补充该页副标题；`/` 仍落在「我的问卷」 |
| `tduck-vue3/src/td/views/project/my/index.vue` | 「我的问卷」顶部 AI 横幅；原 AI 建卷按钮改为进入工作室 |
| `tduck-vue3/src/td/generator/ai-draft-import.js` | 新增：把草稿导入为未发布问卷的共用逻辑（字段转换 + 断点续传） |
| `tduck-vue3/src/td/views/form/ai-draft/index.vue` | 改为调用共用导入模块，行为与提示文案保持不变 |
| `scripts/tduck/ai-studio-visual.mjs` | 新增：工作室视觉与流程回归（11 项，可选真实生成 1 项） |

未改动：后端接口、数据库、统计、问卷编辑器本身。

## 5. 验证

| 命令 | 结果 |
| --- | --- |
| `node scripts/tduck/ai-studio-visual.mjs` | 11/11 通过（可选 `STUDIO_REAL=1` 时额外 1 项真实生成） |
| `node scripts/tduck/ai-header-actions-ui.mjs` | 8/8 通过（重构后的导入路径仍能真实建卷进编辑器） |
| `node scripts/tduck/workbench-visual.mjs` | 92/92 通过（全站深色、无浅色残留、无换肤入口、对比度） |
| `cd tduck-vue3; npm.cmd test` | 59/59 通过 |
| `cd tduck-vue3; npm.cmd run build` | 成功（仅有既有的 chunk 体积告警） |

## 6. 截图

- `evidence/tduck-full/ai-studio/01-home-banner.png`：我的问卷页 AI 横幅
- `02-studio-empty.png`：工作室首屏（输入区 + 三步说明 + 草稿箱）
- `03-studio-idea-filled.png`：点击灵感示例后自动填充
- `04-studio-variants.png`：3 份候选并排对比
- `05-studio-detail.png`：选中候选的完整题目预览与两个动作
- `06-studio-mobile.png` / `07-studio-mobile-variants.png` / `08-studio-mobile-drafts.png`：390px 布局
- `09-imported-editor.png`：从候选直接导入后进入编辑器（4 题未发布）
- `10-studio-real-generated.png`：真实网关生成一份草稿（可选检查）
- `results.json`：逐项结果

## 7. 已知限制与下一步

- 候选暂存在当前浏览器会话（sessionStorage），刷新可恢复但不跨设备；跨设备继续编辑需在工作台点「暂时保存」写入账号草稿
- 工作室每次「继续精修」都会新建一份草稿槽，连续点击会产生多条草稿记录（未做去重）
- 生成成本未做额度提示；Mock 模式沿用工作台的提示口径
- P2 计划：候选去重与命名、把单题优化/评审搬进工作室详情、质量提示（题量/必填比例/敏感题）
- P3 计划：模板/灵感库、直接发布（需版本快照与二次确认）
