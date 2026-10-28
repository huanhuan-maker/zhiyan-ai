# M5-P 交互层：参考 Rare UI 的微交互改造（第一批）

- 日期：2026-10-28
- 参考：https://www.rareui.com/ （27 个 animated React components：Inline AI Status、Animated counter、Bounce/Hook/Proximity sidebar、Grid Reveal、Scroll progress、Step player、Folder component 等）
- 结论：不引入 React/Motion 依赖，用本项目已有的 Vue3 + CSS + 原生事件实现第一批微交互；同时补齐了因「问卷已发布」状态新暴露的深色缺口

## 1. 参考站拆解 → 本项目落点

| Rare UI 组件 | 交互本质 | 落到我们哪里 | 本轮 |
| --- | --- | --- | --- |
| Inline AI Status | 图标 + 微光扫过 + 计时 | 问卷助手等待、AI 建卷生成状态 | 下一批 |
| Animated counter | 数字滚动 | 我的问卷「共 N 份 / AI 暂存 N 份」 | ✅ |
| Bounce / Hook sidebar | 选中指示条、图标回弹 | 工作台侧栏 | ✅ |
| Grid Reveal | 卡片错峰进场 | 我的问卷卡片、AI 建卷说明/候选/草稿 | ✅ |
| Scroll progress | 顶部阅读进度 | 工作台 header 下的 2px 进度条 | ✅ |
| Step player / Task list | 分步进度 | AI 建卷四步流程 | 下一批 |
| Folder component | 文件夹展开 | 我的问卷文件夹 | 下一批 |
| Delete button | 按住/滑动确认 | 危险操作二次确认 | 下一批 |
| Rail TOC / Gooey nav | 锚点导航 | 编辑器题目导航、统计页锚点 | 下一批 |

## 2. 本轮实现

- `src/td/interactions/index.js`：两个全局指令
  - `v-reveal="delayMs"`：IntersectionObserver 错峰进场，只触发一次，卸载时断开
  - `v-spotlight`：pointermove 写入 `--mx/--my`，卡片内柔和光斑跟随指针
- `components/AnimatedNumber/index.vue`：easeOutCubic 数字滚动，保留 aria-label 供读屏
- `components/ScrollProgress/index.vue`：监听 `.router-view-wrapper`，长页面才显示
- `assets/styles/interactions.scss`（第 30 节）：按钮按下反馈、`focus-visible` 焦点环、侧栏选中指示条 + 图标触感、聚光、进场、进度条、动效降级
- 应用到：我的问卷卡片（聚光 + 错峰）、数量统计（滚动数字）、AI 建卷说明/候选/草稿（进场 + 聚光）、工作台侧栏与 header
- `prefers-reduced-motion: reduce`：进场直接显示、聚光关闭、过渡全部取消（有回归断言）

## 3. 顺带修复的深色缺口（并非本轮引入）

问卷在数据里变为「已发布/有答卷」后，暴露出三处此前未渲染到的浅色/低对比：发布页分享卡白底、编辑器选项输入白底、助手结果页「查看统计页」按钮低对比。已在 `workbench-premium.scss` 第 31 节补齐，全站深色回归恢复 92/92。

## 4. 验证

| 检查 | 结果 |
| --- | --- |
| `scripts/tduck/interactions-ui.mjs`（新增） | 8/8：卡片进场/聚光跟随、侧栏指示条、阅读进度、数字滚动、AI 建卷进场、减少动态偏好、无报错 |
| `scripts/tduck/workbench-visual.mjs` | 92/92（含第 3 节修复） |
| `scripts/tduck/form-card-counts.mjs` | 8/8（放宽了「0 份配色」断言：当前数据所有问卷都有答卷） |
| `cd tduck-vue3; npm.cmd test` | 72/72 |
| `npm.cmd run build` | 成功 |

## 5. 截图

- `evidence/tduck-full/interactions/01-home-revealed.png`：卡片进场完成
- `02-card-spotlight.png`：指针悬停的卡片聚光
- `03-scroll-progress.png`：滚动到底部的顶部进度
- `04-ai-studio-guide.png`：AI 建卷说明卡进场
- `05-reduced-motion.png`：减少动态偏好时直接显示
- 参考站截图：`evidence/tduck-full/rareui-reference/`（首页、组件目录、AI 状态、侧栏、网格进场、滚动进度、步骤、文件夹）

## 6. 下一批候选（等你选）

1. **Inline AI 状态**：助手/建卷等待时显示「正在检索答卷 · 4s」的微光状态（最贴近 Rare UI 的招牌）
2. **Step player**：AI 建卷四步（需求→生成→对比→精修）做成可回看的步骤条
3. **Folder 展开**：文件夹卡片点开时有展开动效
4. **按住确认删除**：删除问卷/答卷改成按住 1 秒确认，减少误删
5. **Rail TOC**：编辑器题目列表、统计页锚点导航
