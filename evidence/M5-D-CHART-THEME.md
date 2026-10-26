# M5-D｜统计页图表与深色模式修复（2026-10-26）

接手时工作树里有一处未提交的半成品改动：`TChart` 调用 `this.getThemedOption(...)`，但全仓库没有任何定义。统计页"访问与收集概览"的 4 个 ECharts 因此在 `init()` 抛 `TypeError`，只剩空容器。本轮补齐实现、补主题切换重绘、补统计页深色容器覆盖，并用真实浏览器回归锁住。

入口仍是 `http://localhost:5180/project/form/statistics`（5180 → 8997 → 隔离库 `tduck_vue3_dev`），交付后等待用户复验。

## 原因与修复

1. **图表运行时崩溃**：`TChart` 的 `init()` 调用不存在的 `getThemedOption`，浏览器抛 `this.getThemedOption is not a function`，4 个图表全部空白。修复前真实复现见 [before-fix-diagnostic.json](tduck-full/chart-theme/before-fix-diagnostic.json)（2 条 pageerror、1/4 图表渲染）与 [before-fix-blank-charts.png](tduck-full/chart-theme/before-fix-blank-charts.png)。
2. **补齐 `getThemedOption`**：浅色直接返回调用方配置（不改既有观感）；深色按 `--zy-*` 令牌替换图表里的浅色中性色（`#fff/#666/#333/#D9D9D9/#E8E8E8/#f5f5f5/#e6f7ff/rgba(180,180,180,.1)`），品牌色与数据色不动。克隆只深拷贝普通对象，函数（如柱状图 `formatter`）与 `graphic.LinearGradient` 按引用保留，避免破坏配置。
3. **主题切换要重绘**：图表是 canvas/svg，读不到 CSS 变量继承。`applyWorkbenchTheme` 在深浅真正变化时派发 `zhiyan:theme-change`，`TChart` 监听后 `refresh()`（销毁重建），卸载时移除监听；`mergeOptions` 与 `option` 深度监听的 `setOption` 也走同一套主题包装，避免后续数据更新把深色覆盖回去。
4. **编辑器外壳补主题开关**：`form/index.vue` 顶部栏在普通编辑器下也显示"深色模式/浅色模式"按钮（AI 建卷分支原本已有）。该改动接手时已存在于工作树，本轮一并纳入并验证。
5. **统计页深色容器覆盖**：统计页容器（`.statistics-workspace`、`.statistics-version`、`.el-tabs__nav-wrap`、`.dashboard-container`、`.card-panel`）自带 scoped 浅色底，与 `workbench-dark-admin.scss` 里的 `.zy-dark .xxx` 特异性相同，组件样式后加载而获胜。按项目既有做法用 `!important` 提升，统计页在深色下页面底色、版本栏、标签栏、四张指标卡均为深色令牌。

## 修改文件

- `tduck-vue3/src/td/views/components/TChart/index.vue`：新增 `getThemedOption` 与主题事件监听；三处 `setOption` 统一走主题包装。
- `tduck-vue3/src/td/utils/workbenchTheme.js`：`applyWorkbenchTheme` 在主题真正变化时派发 `zhiyan:theme-change`。
- `tduck-vue3/src/td/views/form/index.vue`：编辑器顶栏深色/浅色切换按钮（接手时的未提交改动）。
- `tduck-vue3/src/td/assets/styles/workbench-dark-admin.scss`：统计页深色容器覆盖加深。
- `scripts/tduck/chart-theme.mjs`：新增真实浏览器回归（7 项）。
- `evidence/tduck-full/chart-theme/`：修复前后诊断、截图、回归日志。

无 SQL 迁移，不改后端，不改模型配置。

## 实际执行结果

| 本轮执行项 | 成功 | 失败 |
| --- | ---: | ---: |
| 真实浏览器回归 `chart-theme.mjs`（浅色渲染/浅色文字色/切深色重绘/刷新保持/切回浅色/深色无浅底块/无 getThemedOption 报错） | 7 | 0 |
| 同一脚本在修复前的失败复现（深色文字色未变） | 5 | 1 |
| 前端 Vitest 全量 | 39 | 0 |
| `vue-tsc --noEmit` + `vite build` | 1 | 0 |

- 回归脚本修复前失败记录：[before-regression.txt](tduck-full/chart-theme/before-regression.txt)（`FAIL toggling dark repaints charts with dark tokens: ["rgb(102, 102, 102)"]`）。
- 修复后通过记录：[after-regression.txt](tduck-full/chart-theme/after-regression.txt)、[results.json](tduck-full/chart-theme/results.json)。
- 构建：`npm.cmd run build` 输出 `✓ built in 36.95s`，`dist/index.html` 写入时间 2026-10-26 11:49:54；旧的包体积 >1000kB 警告仍在，与本次无关。
- 构建期间先跑 `vue-tsc --noEmit`（`build` 脚本串联），未报类型错误。

## PowerShell 复现与启动

本机 8997/5180 已在运行时只需刷新页面。冷启动：

```powershell
# 根目录：先确保 MySQL80 服务为 Running（系统服务，需管理员启动）
Get-Service MySQL80
.\scripts\tduck\Start-FullBackend.ps1 -Background
# 另开终端
Set-Location .\tduck-vue3
npm.cmd run dev
# 回归（根目录，需 5180/8997 与私有 fixture 就绪）
node scripts\tduck\chart-theme.mjs
Set-Location .\tduck-vue3; npm.cmd test; npm.cmd run build
```

回归读取私有 fixture `.local/assistant-simple/acceptance.json`（只读浏览，不提交答卷、不改用户真实问卷）。该文件不属于 Git；缺失时先按 `scripts/tduck/New-SimpleChatFixture.ps1` 重建。

## 截图与用户复验

- [修复前：图表容器空白](tduck-full/chart-theme/before-fix-blank-charts.png)
- [修复后：浅色统计页](tduck-full/chart-theme/01-statistics-light.png)
- [修复后：深色统计页（图表文字、坐标轴、卡片同步变深）](tduck-full/chart-theme/02-statistics-dark.png)

复验步骤：进入任一份问卷 → 统计 → "访问与收集概览"。浅色下 4 个图表应有内容；点顶栏"深色模式"后页面底色、指标卡、图表文字同步变深，无控制台报错；刷新后仍是深色；再点"浅色模式"恢复原样。

## 已知边界

- 本轮只修统计页"访问与收集概览"与图表。**"题目统计""主题与报告"两个标签页在深色模式下仍有残留浅底**（`el-card__header`、表头 `#fafbfc`、`.research-panel` 白底、选中的单选按钮浅蓝），审计数据见 [known-dark-gaps.json](tduck-full/chart-theme/known-dark-gaps.json)，截图见 [known-gap-analysis-tab-dark.png](tduck-full/chart-theme/known-gap-analysis-tab-dark.png)。需要的话下一轮补齐。
- 回归使用的 fixture 问卷没有答卷，图表渲染了坐标轴与图例但没有数据点；有答卷口径（含地域地图、设备饼图）在 M4-R 报告里验证过，本轮未重复。
- 图表深色只替换浅色中性色，地图 `visualMap` 的高值区间仍是品牌蓝（`#1890ff/#0050b3`），低值 `#e6f7ff` 已映射为深色 `--zy-primary-soft`；如需整条色阶适配可另做。
- 接手时工作树另有 30+ 个 evidence 截图/JSON 的改动与未跟踪的 `artifacts/`、根目录 zip、`tduck-api.jar`，属于其他会话的运行产物，本轮未纳入提交。
- 另有一处环境问题：`.local/tduck-dev/acceptance.json` 指向已被删除的账号（id 15677），依赖它的旧脚本（如 `workbench-dark-mode.mjs`）当前会登录失败；本轮改用 `.local/assistant-simple/acceptance.json`，未改动该文件。
