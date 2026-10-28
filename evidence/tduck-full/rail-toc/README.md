# 题目导航轨（Rail TOC）交付证据

日期：2026-10-28 ｜ 任务板：task-2 ｜ 负责人：rail-nav

## 1. 交付内容

| 类型 | 文件 | 说明 |
| --- | --- | --- |
| 新组件 | `tduck-vue3/src/td/components/RailToc/index.vue` | 右侧竖排圆点 + 序号 + 阅读进度线 + 深色浮层标签；固定定位，不占布局 |
| 纯函数 | `tduck-vue3/src/td/components/RailToc/rail.js` | 激活项求解、进度比例、点击滚动目标、键盘步进、锚点/条目构造 |
| 单测 | `tduck-vue3/tests/unit/rail-toc.test.js` | 13 个用例，全部为纯函数（不含 DOM） |
| 接入(统计) | `tduck-vue3/src/td/views/form/statistics/analysis.vue` | 题卡外层 `el-col` 加稳定锚点 `id=question-<fieldId>`；挂 RailToc；桌面留 56px 通道 |
| 接入(编辑器) | `tduck-vue3/src/td/generator/FormDesign.vue` | 模板尾部插入 RailToc + 选中联动；桌面给画布留 64px 通道 |
| 回归脚本 | `scripts/tduck/rail-toc.mjs` | Playwright 真实登录 + 真实问卷，17 项检查 |
| 证据 | `evidence/tduck-full/rail-toc/` | 本文件、`results.json`、9 张截图 |

没有改动 `src/td/assets/styles/**`、`views/home/**`、`views/assistant/**`、`views/project/my/**`、后端 Java 与 `package.json`；没有新增依赖。

## 2. 交互与可访问性

- 序号 1..n 与题卡顺序一致；圆点列右侧是一条阅读进度竖线（顶部起随滚动填充，走到底部 100%）。
- 点击：`container.scrollTo({top, behavior})`，在**滚动容器内**滚动（统计页 `.statistics-workspace`，编辑器 `.designer-canvas`），不调用 `window.scrollTo`。
- 滚动高亮：`scroll` 监听 + `requestAnimationFrame` 节流，按「阅读线」取最近一题（`readingLine` 默认 96px，题卡矮于阅读线时不会一次跳过两题），贴底强制最后一题。
- 浮层：自绘深色浮层（`--zy-surface` / `--zy-border` / `--zy-shadow-popup`，兜底色同样是深色），同一时刻只浮出一个；悬停 > 键盘焦点 > 当前题。
- 键盘：roving tabindex（只有一个 `tabindex=0`），Tab 进入、ArrowUp/Down 移动焦点、Home/End 首尾、Enter 触发定位；`aria-label="题目导航"`，每项 `aria-label="第 N 题：题干"`，当前项 `aria-current="true"`。
- `prefers-reduced-motion: reduce`：JS 用 `auto` 代替 `smooth`，CSS 把标签动画与所有过渡设为 none。
- 窄屏：`max-width:1099.98px` 时 `display:none !important`，不占位、不产生横向滚动。
- 可见性：`display:none`（切到「主题与报告」「访问与收集概览」、或编辑器窄屏）时用 `getClientRects().length===0` 判定并隐藏，切回自动恢复。

## 3. 验证命令与结果

```powershell
# 纯函数单测
cd tduck-vue3; npx.cmd vitest run tests/unit/rail-toc.test.js
# => Test Files 1 passed (1) / Tests 13 passed (13)

# Playwright 回归（真实登录 + 真实问卷）
node scripts/tduck/rail-toc.mjs
# => 17/17 checks passed
```

回归使用的真实数据（脚本自动挑选「题目最多、有已发布且有答卷版本」的问卷，不造假数据）：

- 问卷：大学生 AI Agent 使用与需求调查（`cYtMpVqA`）
- 版本：V2（收集中，35 份答卷），该版本 54 道题 → 54 张统计题卡
- 页面：`http://127.0.0.1:5180/project/form/statistics?key=cYtMpVqA&version=2`
- 编辑器：`http://127.0.0.1:5180/project/form/editor?key=cYtMpVqA`

### 17 项检查（全部 PASS）

1. 统计页使用真实后端数据：题卡数 = 该版本题目数（54）
2. 右侧导航轨显示，圆点数量 = 题卡数量（54），首屏高亮第 1 题，序号 1..54
3. 导航轨在题卡右侧，不遮挡题卡，文档/滚动容器横向溢出均为 0
4. 当前题高亮并显示深色浮层标签（实测背景 `rgb(20,34,53)`，非白底）
5. 点击第 23 项：题卡滚入视口，高亮与 `aria-current` 指向该项
6. 滚动到中部/底部高亮跟随（底部强制最后一题，进度线 > 95%）
7. 悬停任一圆点浮出对应题干，且同一时刻只有一个浮层
8. 键盘可达：Tab 逐次进入轨道、roving tabindex 唯一、`aria-label` 中文、ArrowDown 移动、Enter 定位
9. 切到「主题与报告」导航轨隐藏，切回「题目统计」恢复
10. 原有统计内容未变：图表 canvas、版本选择器、三个 tab、「图表数值由后端计算」「有效人数占比」「比例按本题有效回答人数计算」文案都在
11. reduced-motion：过渡为 0s，点击后 160ms 内已定位（无平滑动画）
12. 统计页移动端 390 宽：轨道 `display:none`，无横向溢出，54 张题卡仍在
13. 编辑器：导航轨显示，圆点数量 = 题目卡片数量（54）
14. 编辑器：不遮挡右侧设置面板（rail 右边界 1258 ≤ 面板左边界 1284）、不压题卡与工具按钮（题卡右边界 1205 < rail 左边界 1216）、无横向溢出
15. 编辑器：点击第 23 项滚动到题卡并选中该题（设置面板标题同步为同一题干）
16. 编辑器 390 宽：轨道 `display:none`，文档无横向溢出
17. 全程无未捕获异常（`pageErrors` 为空）

## 4. 编辑器 rail 是否落地：落地，附量化证据

任务允许「不安全就跳过」，实测安全因此接入，依据：

- 布局是 `230px | minmax(360px,1fr) | 300px` 三列网格，rail 用 `position:fixed` 计算到**编辑画布列**右边界内侧（不进入设置面板列），仅在 ≥1100px 给 `.designer-canvas` 追加 `padding-right:64px` 作为通道。
- 实测几何（1600×1000）：画布 350→1270、设置面板 1284→1584、rail 1216→1258、题卡右边界 1205、工具按钮右边界 1184 ⇒ rail 既不碰面板也不碰题卡；`document`/`body` 横向溢出 = 0。
- 390 宽：rail `display:none`，文档横向溢出 0；编辑器本身在窄屏存在既有的内部横向滚动（`.native-designer` 的 `150px+260px` 两列网格 + `overflow:auto`），与 rail 无关，rail 不参与该布局。
- 逻辑改动仅限：模板插入 `<RailToc/>`、`computed railItems`、`selectRailItem`（只写 `selected`，不写 `fields`/不触发 dirty）、以及一条媒体查询样式。`saveAll/remove/reorder/locked/load` 与 `dirty` 判定均未改。

## 5. 截图

- `01-statistics-desktop.png` — 统计页桌面（54 圆点 + 首题浮层）
- `01b-statistics-desktop-rail.png` — 轨道局部放大
- `02-statistics-hover.png` — 悬停第 8 项浮出题干（深色浮层）
- `03-statistics-clicked.png` — 点击第 23 项后的定位与高亮
- `04-statistics-research-tab.png` — 「主题与报告」tab：导航轨隐藏
- `05-statistics-reduced-motion.png` — reduced-motion 下直接定位
- `06-statistics-mobile-390.png` — 统计页 390 宽：轨道隐藏、无横向溢出
- `07-editor-desktop.png` — 编辑器桌面：rail 在画布与设置面板之间
- `08-editor-clicked.png` — 编辑器点击第 23 项：题卡选中 + 设置面板同步
- `09-editor-mobile-390.png` — 编辑器 390 宽：轨道隐藏

## 6. 已知限制与风险

- 浮层标签按需求常驻在「当前题」上方，属于覆盖式提示（`pointer-events:none`，深色，宽 ≤300px）；它会在右侧短暂遮住表格最右列的一部分，这是「当前题显示标签」的直接结果，不遮挡题卡主体。
- 统计页强依赖 `.statistics-workspace` 选择器作为滚动容器；若以后外层容器改名，需同步 `analysis.vue` 里的 `container`。组件本身在拿不到该容器时会回退到「锚点最近的可滚动祖先」。
- 编辑器 rail 的锚点通过 `anchor-selector=".question-card"` 按顺序解析（未给题卡加 id），因此题目顺序变化后依赖 Vue 重渲染 + `items` watcher 重新绑定；drag 排序过程中若出现短暂错位，滚动一次即恢复。
- 遗留脚本 `analysis-layout.mjs` / `analysis-ui.mjs` 依赖 `.local/tduck-dev/acceptance.json` 里的 fixture 账号（`vue3-owner-...@example.test`），在本机数据库里登录返回 500，属既有环境问题，与本改动无关；本改动的回归不依赖该 fixture。
