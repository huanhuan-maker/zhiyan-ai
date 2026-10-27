# M5-H｜问卷助手布局重构（2026-10-27）

需求：现有问卷助手布局"很难看"，重做布局。只调整结构/样式，查询、MCP、会话、操作确认等逻辑一行未改。

## 一、原布局的问题

1. 内容满屏拉伸到 1368px，消息与列表行过长，视觉重心散；
2. 问答没有角色区分：提问只有个小标签，回答直接是一整块白（现为深色）大盒子，主次不分；
3. 回答里的问卷列表是一行一条、按钮甩到最右，行与行之间全靠分隔线，像后台表格而不像对话；
4. 顶部工具栏三个按钮裸放在右侧，与标题不在同一视觉组；
5. 输入区只是一个描边盒子，textarea 占满整宽，说明文字与发送按钮排版松散；
6. 空状态只有一行居中文字 + 一排按钮，没有引导感；手机上标题换行后与操作按钮挤在一起。

## 二、改动

**模板（只动结构，不动逻辑）**
- 顶部：品牌图标 + 标题组（h2/说明）+ 右侧操作胶囊（能力 / 历史 / 新对话）；
- 上下文提示条：状态点 + 问卷名 + 清除，改为一条浅色提示；
- 每条对话拆成两行带头像的消息：用户（"我"，右对齐）与助手（品牌图标，左对齐）；
- 回答头部新增元信息条：问卷助手 / 模型或本地降级 / 只读查询标签；
- 问卷列表沿用原 DOM（`article` + 标题 + 状态 + 查询按钮），改为卡片网格。

**样式**
- 统一居中对话列（最大 1080px），消息、输入区同宽对齐；
- 气泡：用户 16/16/4 圆角、助手 16/16/16/4 圆角，深色令牌 + 1px 描边 + 柔和阴影；
- 问卷结果：桌面两列自适应卡片（≥300px 一列），hover 上浮 + 青色描边；窄屏单列；
- 表格 / 折叠面板 / 提示区在气泡内统一 18px 横向内边距，不再贴边；
- 输入区改吸底卡片，聚焦时青色光晕；说明文字与发送按钮一行排布；
- 空状态：品牌图标 + 标题 + 说明 + 2×2 示例卡片；
- 移动端（≤900px）：工具栏改为上下两段（标题在上、操作分段铺满），示例单列，气泡占宽 92%，头像缩小。

## 三、验证（实际执行）

| 项 | 结果 |
| --- | --- |
| `workbench-visual.mjs` 全站 23 条路由深色/无白块/对比度回归 | **92/92 通过**（含 /home/assistant） |
| 前端 Vitest | 59/59 通过 |
| `vue-tsc --noEmit` + `vite build` | 通过（15.48s，dist 21:22:39） |
| 390×844 移动端 | 无横向溢出（`scrollWidth <= clientWidth`），工具栏/示例/输入区单列排布正常 |

## 四、前后对比

| 场景 | 之前 | 之后 |
| --- | --- | --- |
| 桌面 · 对话 | [before-desktop.png](tduck-full/assistant-layout/before-desktop.png) | [after-desktop.png](tduck-full/assistant-layout/after-desktop.png) |
| 桌面 · 空状态 | — | [after-empty.png](tduck-full/assistant-layout/after-empty.png) |
| 移动端 | [before-mobile.png](tduck-full/assistant-layout/before-mobile.png) | [after-mobile.png](tduck-full/assistant-layout/after-mobile.png) |

"之前"截图是把 `assistant/index.vue` 的改动 `git stash` 掉后现场拍摄的，不是旧图复用。

## 五、实现约束

- 保留原有类名与交互锚点：`.assistant-page`、`.assistant-turn[data-turn-id]`、`.question-bubble`、`.answer-bubble`、`.answer-meta`、`.assistant-answer-text`、`.survey-results article`、`.assistant-composer`、`.composer-footer` 等，避免影响仍在使用的选择器与深色回归；
- 深色底值未改（`.assistant-page` 仍是 `rgb(12,24,41)`，`.assistant-composer` 仍是 `rgb(20,34,53)`），原有深色断言继续成立。

## 六、已知边界

- `scripts/tduck/assistant-ui.mjs` 是 M5-C 之前的旧交互（模式单选、作用域下拉、"发送查询"按钮），早已与当前界面不符，本轮未修；当前界面回归由 `workbench-visual.mjs` 覆盖深色与对比度，功能回归仍走 `assistant-simple-api.mjs`/`assistant-selection-ui.mjs`。
- 回答里统计表格、来源对话框等内容的视觉沿用全局深色规则，本轮只调了间距，未重做表格样式。
