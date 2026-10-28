# M5-Q-INTERACTIONS-2：第二批交互与流式回答显示层

2026-10-28。本批把上一轮提出的 5 个候选交互全部落地，并为问卷助手的逐字输出补了一层"显示层"效果：服务端流式内容保持原样，浏览器只控制呈现节奏与状态提示。

## 一、交付内容

| # | 交互 | 落点 | 关键行为 |
| --- | --- | --- | --- |
| 1 | Inline AI 状态 | 问卷助手等待态、AI 建卷进度面板 | 微光状态行 + 跳动小点 + 实时秒数；`prefers-reduced-motion` 下静止但仍计时 |
| 2 | 步骤播放器 | `DraftGenerationProgress`（AI 建卷 / 编辑页 AI 草稿共用） | 四步连接线按真实阶段填充、完成步打勾弹入、进行中环形呼吸；点任一步回看该阶段真实记录与耗时；"回看流程"按真实事件回放 |
| 3 | 文件夹展开 | 我的问卷 | `folder=true` 记录渲染为文件夹卡片（页签造型 + 内部问卷数），点击播 380ms 开启动效后进入；面包屑"根目录 / 名称"返回，URL 同步 folderId，空文件夹有深色空状态 |
| 4 | 按住确认删除 | 我的问卷卡片 | 浮层覆盖卡片（不撑破布局），按住 1 秒圆环填满才逻辑删除；松手/移开/ESC 取消；键盘 Space/Enter 同样计时；失败在浮层内 `role=alert` 提示可重试 |
| 5 | Rail TOC | 题目统计、问卷编辑器 | 右侧竖排编号圆点 + 阅读进度线；点击在滚动容器内定位；滚动高亮；深色标签浮层；键盘可达；<1100px 隐藏 |
| 6 | 流式回答显示层 | 问卷助手 | 无实时草稿时，已校验正文按节奏逐字铺开（约 3 秒铺完，不改变内容）；闪烁光标；生成中气泡进入呼吸描边；实时草稿块带"未经核对"胶囊与光标；等待阶段用 #1 的状态行显示真实阶段与秒数 |

说明：第 6 项刻意与"模型逐 token 透传"区分。上游 token 流由同期另一条工作线（`6736e1f`）以"未经核对的草稿"呈现；本层只处理**已校验正文**的显示节奏，服务端没有新增定时器，也没有为了动画提前展示未校验内容。

## 二、文件

新增：
- `tduck-vue3/src/td/components/AiStatus/index.vue`
- `tduck-vue3/src/td/assistant/StreamingAnswer.vue`、`tduck-vue3/src/td/assistant/typing.js`
- `tduck-vue3/src/td/generator/generation-steps.js`
- `tduck-vue3/src/td/components/RailToc/{index.vue,rail.js}`
- `tduck-vue3/src/td/utils/formGroups.js`
- 单测：`tests/unit/{ai-status,assistant-typing,generation-steps,rail-toc,form-groups}.test.js`
- 回归：`scripts/tduck/{assistant-stream-ux,ai-step-player,rail-toc,folder-card-ux}.mjs`

修改：
- `views/assistant/index.vue`：`StreamingAnswer` 替换静态正文、等待态接入 `AiStatus`、`liveTurnId` 只让本次轮次逐字展示（历史轮次直接显示）
- `generator/DraftGenerationProgress.vue`：步骤播放器
- `views/project/my/{card,index,mixin,table}.vue`：文件夹卡片/面包屑/按住删除/列表入口
- `views/form/statistics/analysis.vue`、`generator/FormDesign.vue`：题目锚点与 Rail TOC
- `assets/styles/interactions.scss`：流式气泡描边、草稿块与光标（第 32 节）

## 三、验证

以下均为本机真实执行（Edge headless + 5180 Vite + 8997 后端 + MySQL）。

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 单元测试 | `cd tduck-vue3; npx.cmd vitest run` | **110 / 110 通过**（18 文件，含本批新增 36 个用例） |
| 生产构建 | `npm.cmd run build` | **成功**（`✓ built in 17.96s`，仅既有体积提示） |
| 流式显示层 | `node scripts/tduck/assistant-stream-ux.mjs` | **6 / 6**：等待态状态行与秒数、实时草稿/逐字正文增长、光标、气泡描边、完成后与历史一致、reduced-motion |
| 步骤播放器 | `node scripts/tduck/ai-step-player.mjs` | **5 / 5**：四步、连接线 33%/100%、点步回看真实记录、回放、窄屏两列无溢出 |
| Rail TOC | `node scripts/tduck/rail-toc.mjs` | **17 / 17**：54 题真实问卷，点数=题卡数、点击定位、滚动高亮、深色浮层、键盘、tab 切换、reduced-motion、390 宽隐藏、编辑器 rail 不遮挡 |
| 文件夹 + 按住删除 | `node scripts/tduck/folder-card-ux.mjs` | **22 / 22**：文件夹卡片/动效/面包屑/子问卷/空文件夹/新建落点、按住取消/满 1 秒删除/键盘/失败重试、reduced-motion、移动端、无白底 |
| 卡片收集份数（既有） | `node scripts/tduck/form-card-counts.mjs` | **8 / 8** |
| 交互层（既有） | `node scripts/tduck/interactions-ui.mjs` | **8 / 8** |
| 全站深色 | `node scripts/tduck/workbench-visual.mjs` | **92 / 92**（无浅色残留、对比度 ≥4.5、无换肤入口） |
| 系统配置深色 | `node scripts/tduck/system-dark-tabs.mjs` | **19 / 19** |
| 凭据扫描 | `node scripts/tduck/credential-scan.mjs` | **3 项检查 0 失败**（本轮文件 0 命中） |

合计页面/接口断言 **177 项通过、0 失败**（不含单元测试）。

截图：
- `evidence/tduck-full/assistant-stream-ux/01-waiting-status.png`（等待态状态行）
- `evidence/tduck-full/assistant-stream-ux/02-streaming.png`（实时草稿 + 光标 + 气泡描边）
- `evidence/tduck-full/assistant-stream-ux/04-paced-answer.png`（无草稿时逐字铺开）
- `evidence/tduck-full/ai-step-player/{01-running-steps,02-step-detail,03-replay,04-mobile}.png`
- `evidence/tduck-full/rail-toc/{01-statistics-desktop,02-statistics-hover,03-statistics-clicked,05-statistics-reduced-motion,06-statistics-mobile-390,07-editor-desktop}.png`
- `evidence/tduck-full/folder-card-ux/{01-desktop-folder-cards,02-folder-opening,03-inside-folder,04-empty-folder,05-hold-progress,06-mobile-folder}.png`

## 四、边界与已知限制

1. **逐字效果分两层**：上游模型 token 的实时草稿来自另一条工作线；本层的节奏只作用于"校验后的正文"。当本次轮次存在实时草稿时不重复逐字（避免同一段内容被"打"两遍），直接显示最终正文。
2. **流式内容不提前**：显示层只消费服务端 `answer`/`delta` 已到达的文本，不伪造 token、不改写正文；网络合并分块时由显示层补齐节奏。
3. **减少动态偏好**：所有新交互动效在 `prefers-reduced-motion` 下关闭；按住删除保留"按住即删"的语义（只去掉动画），不改变确认强度。
4. **文件夹**：只做浏览/进入/返回与"新建落在当前文件夹"，不新增重命名/移动/删除文件夹的写接口；文件夹内问卷数最多取 12 个目录，未知时不显示具体数字（显示"文件夹"）。
5. **Rail TOC**：统计页依赖 `.statistics-workspace` 作为滚动容器（组件有"最近可滚动祖先"回退）；编辑器在 ≥1100px 时给画布留右通道，窄屏隐藏。
6. **既有脚本** `chart-theme.mjs`、`ai-generation-progress-ui.mjs` 等仍依赖已失效的 `.local/assistant-simple` 夹具账号，本轮未修复（与本批改动无关）；本批复验使用管理员账号或路由拦截的合成响应。
7. 管理器账号原本没有文件夹，回归脚本按需创建了验收夹具：文件夹 `Archive - acceptance`(id 9154) + 子问卷 `Nested survey - acceptance`、空文件夹 `空归档 - acceptance`(id 9156)。如不需要可删除。

## 五、复现

```powershell
Set-Location D:\LcProject
# 前端（若未启动）
npm.cmd run dev --prefix tduck-vue3
# 单测与构建
cd tduck-vue3; npx.cmd vitest run; npm.cmd run build; cd ..
# 交互回归
node scripts/tduck/assistant-stream-ux.mjs
node scripts/tduck/ai-step-player.mjs
node scripts/tduck/rail-toc.mjs
node scripts/tduck/folder-card-ux.mjs
node scripts/tduck/interactions-ui.mjs
node scripts/tduck/form-card-counts.mjs
node scripts/tduck/workbench-visual.mjs
node scripts/tduck/system-dark-tabs.mjs
```
