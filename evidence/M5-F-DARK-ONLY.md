# M5-F｜固定深色主题 + 问卷编辑器深色全覆盖（2026-10-27）

用户要求：不再提供"浅色/深色"切换，工作台固定深色；问卷编辑器里的逻辑、外观、设置、发布、数据、统计、预览等页面"不能留有白色"。

## 一、主题模型改动

1. `utils/workbenchTheme.js`：只保留 `initializeWorkbenchTheme()`/`applyWorkbenchTheme()`，固定添加 `zy-dark` 并设 `color-scheme: dark`；不再读取 `localStorage`/系统偏好，删掉 `toggleWorkbenchTheme()`。
2. 删除全部换肤入口：工作台侧栏底部、工作台顶栏、编辑器顶栏（`home/index.vue` 两处、`form/index.vue` 一处）以及对应的 `isDark`/`toggleTheme` 逻辑与 import。
3. 新增令牌 `--zy-primary-solid`（浅色 #2563eb / 深色 #2f6fed）：深色下 `--zy-primary` 是浅蓝强调色，直接当实心按钮底色会出现"白字压浅蓝"，实心态统一改用该令牌。

## 二、深色全覆盖：白块清点（1600×900，逐页实测）

| 页面 | 修复前白块 | 修复后 |
| --- | ---: | ---: |
| 编辑 /project/form/editor | 0 | 0 |
| 逻辑 /project/form/logic | 2 | **0** |
| 外观 /project/form/theme | 12 | **0** |
| 设置 /project/form/setting | 5 | **0** |
| 发布 /project/form/publish | 4 | **0** |
| 数据 /project/form/data | 5 | **0** |
| 统计 /project/form/statistics（题目统计页签） | 234 | **0** |
| 预览 /project/form/preview | 4（含手机外壳图片白边） | **0** |
| AI 建卷 /project/form/ai-draft | 0 | 0 |

白块判定：浏览器计算样式 `background-color` 亮度 > 0.72 且面积 ≥ 40×24 的节点（排除 TinyMCE 编辑器内部）。

主要手法（都在 `workbench-premium.scss` 的 `.zy-dark` 段）：
- Element Plus 卡片/表头/标签/分页/单选组/开关统一换深色令牌；
- 逻辑页 `.show-logic-container`、外观页 `.left-container/.right-container/.option-line-view/.style-btn`、设置页 `.setting-tabs/.segmented-control`、发布页 `.publish-ready-view/.feature-icon`、数据页 `vxe-table` 全套；
- 统计页 `analysis.vue` 里写死 `#f7f8fa !important`/内联 `header-cell-style` 的表格，改为主题令牌（`var(--zy-surface-subtle)` 等）并移除内联浅色；`.research-metrics > div` 提特异性压过 scoped 白底；
- 预览页 `ProjectForm.vue` 加 `.project-form-preview` 包裹类，把 Element Plus 深色变量容器扩展到该页；手机外壳由白色 PNG 改为 CSS 深色圆角边框，iframe 深色底并填满外壳；二维码卡片同步深色。

文字对比度：深底上原本写死的深色字（`.logic_title`、`.theme-title`、`.ready-title`、`.label`、`.el-radio-button__inner` 等）统一提亮；正文一律 ≥ 4.5:1（装饰性头像字母、TinyMCE 工具栏除外）。

## 三、验证（实际执行）

| 项 | 成功 | 失败 |
| --- | ---: | ---: |
| `workbench-visual.mjs`（13 个页面 × 深色/无白块/对比度/无换肤入口 + 2 项回归断言） | 54 | 0 |
| `chart-theme.mjs`（统计图表渲染、深色文字、无白块、无 getThemedOption 报错） | 5 | 0 |
| 前端 Vitest 全量 | 59 | 0 |
| `vue-tsc --noEmit` + `vite build` | 通过（30.48s，dist 20:52:32） | — |
| 凭据扫描 | 3 项检查，0 失败（仅 M1 历史遗留） | — |

## 四、前后对比

| 页面 | 修复前 | 修复后 |
| --- | --- | --- |
| 逻辑 | [before-form-logic.png](tduck-full/workbench-visual/before-form-logic.png) | [dark-form-logic.png](tduck-full/workbench-visual/dark-form-logic.png) |
| 外观 | [before-form-theme.png](tduck-full/workbench-visual/before-form-theme.png) | [dark-form-theme.png](tduck-full/workbench-visual/dark-form-theme.png) |
| 设置 | [before-form-setting.png](tduck-full/workbench-visual/before-form-setting.png) | [dark-form-setting.png](tduck-full/workbench-visual/dark-form-setting.png) |
| 发布 | [before-form-publish.png](tduck-full/workbench-visual/before-form-publish.png) | [dark-form-publish.png](tduck-full/workbench-visual/dark-form-publish.png) |
| 数据 | [before-form-data.png](tduck-full/workbench-visual/before-form-data.png) | [dark-form-data.png](tduck-full/workbench-visual/dark-form-data.png) |
| 统计 | [before-form-statistics.png](tduck-full/workbench-visual/before-form-statistics.png) | [dark-form-statistics.png](tduck-full/workbench-visual/dark-form-statistics.png) |
| 预览 | [before-form-preview.png](tduck-full/workbench-visual/before-form-preview.png) | [dark-form-preview.png](tduck-full/workbench-visual/dark-form-preview.png) |

"修复前"是同一脚本在 `git stash` 掉本轮改动后拍的，不是旧图复用。

## 五、复现

```powershell
# 前提：MySQL80 Running、8997 后端、5180 前端
node scripts\tduck\workbench-visual.mjs
node scripts\tduck\chart-theme.mjs
Set-Location .\tduck-vue3; npm.cmd test; npm.cmd run build
```

## 六、已知边界

- **公开填写页 `/s/:key` 仍是浅色**（受访者端，产品上保持浅色是既有决策）；编辑器内的预览（`/project/form/view`）已改深色。若要连受访者页面一起深色，需要另起一轮并确认。
- 系统配置页的富文本编辑器（TinyMCE）内容区仍是白底：编辑器自带皮肤，改它需要调整其 `content_css` 配置。
- 旧的 `scripts/tduck/workbench-dark-mode.mjs` 以"浅/深切换"为前提，本改动后已失效（该脚本读取的 `.local/tduck-dev/acceptance.json` 账号也已不存在）；新的深色回归是 `workbench-visual.mjs`。
- 主题令牌仍保留浅色取值（公开页与将来可能的浅色端复用），但工作台不再有入口切换到浅色。
