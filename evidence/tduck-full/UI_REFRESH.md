# 知研 AI 首页 / 我的问卷与 AI 建卷 UI 改版验证（2026-10-25）

本轮只调整 `tduck-vue3` 的前端呈现，未修改数据库结构、接口契约、鉴权、版本冻结、统计计算或追问入口。视觉方向按用户提供的控制台参考图改为浅灰白层次、细边框、现代无衬线字体和彩色语义数值。

## 改动文件

- `tduck-vue3/src/td/assets/styles/index.scss`：按需引入工作台样式令牌。
- `tduck-vue3/src/td/assets/styles/workbench.scss`：新增可复用颜色、字号、间距、圆角和字体变量。
- `tduck-vue3/src/td/views/home/index.vue`：工作台改为参考式左侧导航 + 顶部标题栏；390px 改为顶部横向导航。
- `tduck-vue3/src/td/views/project/my/index.vue`：我的问卷页统一标题、入口按钮、筛选栏、分页和新建弹窗。
- `tduck-vue3/src/td/views/project/my/card.vue`：问卷卡片改为轻量控制台卡片，展示真实状态/类型编号/更新时间语义化数值。
- `tduck-vue3/src/td/views/project/my/table.vue`：列表容器改成轻量边框，保留横向滚动。
- `tduck-vue3/src/td/views/project/my/mixin.js`：仅调整现有状态/类型的展示颜色。
- `tduck-vue3/src/td/views/form/ai-draft/index.vue`：AI 建卷改为分区表单与审核草稿卡；新增真实题数、生成用时和审核提示数展示；保留生成、预览、导入、清空、重试、续传和 sessionStorage 恢复逻辑。
- `tduck-vue3/src/td/views/form/index.vue`：AI 页外层背景和品牌文字微调。
- `scripts/tduck/capture-ui-refresh.mjs`：新增本轮桌面/手机截图与交互证据脚本；AI 响应为明确标注的合成 fixture。

## 截图

修改前基线：

- `evidence/tduck-full/ui-refresh/01-home-before-desktop.png`
- `evidence/tduck-full/ui-refresh/02-home-before-mobile.png`
- `evidence/tduck-full/ui-refresh/03-ai-before-desktop.png`
- `evidence/tduck-full/ui-refresh/04-ai-before-mobile.png`

修改后：

- `evidence/tduck-full/ui-refresh/06-home-after-desktop.png`
- `evidence/tduck-full/ui-refresh/07-ai-after-desktop.png`
- `evidence/tduck-full/ui-refresh/08-ai-after-mobile.png`
- `evidence/tduck-full/ui-refresh/09-home-after-mobile.png`

注意：改动前 IAB 全页截图存在固定布局重复绘制伪影；改动后证据使用 Playwright 真实视口截图。

## 验证命令与结果

- `npm.cmd --prefix D:/LcProject/tduck-vue3 run build`：通过，最终一次 14.91s；仅有既有 Sass `@import` 弃用警告和大 chunk 警告。
- `node scripts/tduck/check-templates.mjs`：通过，Template failures: 0。
- `node scripts/tduck/m2-usability.mjs`：10/10 通过；合成 AI 响应 + 真实后端导入、预览、发布、匿名答卷和统计。
- `node scripts/tduck/m2-import-recovery.mjs`：10/10 通过；刷新恢复、内容变化独立导入、失败续传和已发布问卷保护均保留。
- `node scripts/tduck/m2-slow-request.mjs`：通过；32.8 秒受控慢响应后可重试，明确不是实际模型调用。
- `node scripts/tduck/capture-ui-refresh.mjs`：5/5 通过；1440px 与 390px 均可操作、无横向溢出，AI 页底部操作可滚动到达。
- `node scripts/tduck/credential-scan.mjs`：3/3 通过；本轮文件 0 命中。保留历史已知记录 `evidence/tduck-full/M1_VERSIONS.md` 的口令字样，非本轮新增。

## 已知问题 / 边界

- 其他页面本轮保持原有功能与样式，未统一调整。
- 构建输出仍提示 Sass `@import` 未来弃用和主 chunk 超 1MB；这是既有前端结构警告，不影响本轮功能。
- 本轮生成内容用于 UI 证据的 AI 响应为 `fixture-no-model-call` 合成响应；真实模型本轮未额外计费调用。
- 8997 后端在首次回归前意外退出，已按 `scripts/tduck/Start-FullBackend.ps1 -Background` 原配置恢复并完成全部验证。

## 藏蓝深色模式补充（2026-10-25）

新增文件：

- `tduck-vue3/src/td/utils/workbenchTheme.js`：初始化浅色/深色主题，按用户选择保存至本机 localStorage；不可用时只影响持久化，不阻塞切换。
- `tduck-vue3/src/td/assets/styles/workbench-dark.scss`：藏蓝深色变量对应的局部组件样式，仅覆盖本轮工作台与 AI 建卷范围。
- `scripts/tduck/workbench-dark-mode.mjs`：主题持久化、真实计算样式、AI 表单、预览及 390px 回归。

变更：`main.js` 初始化主题；`workbench.scss` 增加深色令牌；`index.scss` 引入深色皮肤；工作台侧栏/手机顶部和 AI 建卷右上角新增切换按钮。AI 答题预览保留原有白色问卷阅读面，不改动公共问卷组件。

验证：

- `node scripts/tduck/workbench-dark-mode.mjs`：7/7 通过。包含浅色默认、深色刷新保持、卡片与导航实际背景色、输入值、AI 生成、预览、手机无横向溢出。
- `node scripts/tduck/m2-usability.mjs`：10/10 通过，真实后端闭环未受主题影响。
- `node scripts/tduck/m2-import-recovery.mjs`：10/10 通过。
- `node scripts/tduck/m2-slow-request.mjs`：通过，32.7 秒受控响应。
- `node scripts/tduck/capture-ui-refresh.mjs`：5/5 浅色回归通过。
- `npm.cmd --prefix D:/LcProject/tduck-vue3 run build`：通过；保留既有 Sass 与 chunk 警告。
- `node scripts/tduck/credential-scan.mjs`：3/3 通过，本轮无凭据泄漏。

深色截图：

- `evidence/tduck-full/dark-mode/01-home-dark-desktop.png`
- `evidence/tduck-full/dark-mode/02-ai-dark-form-desktop.png`
- `evidence/tduck-full/dark-mode/03-ai-dark-draft-desktop.png`
- `evidence/tduck-full/dark-mode/04-ai-dark-preview-desktop.png`
- `evidence/tduck-full/dark-mode/05-home-dark-mobile.png`
- `evidence/tduck-full/dark-mode/06-ai-dark-mobile.png`

边界：本轮未给编辑器、统计页和其他页面统一换肤；深色模式只覆盖本轮改造范围。测试 AI 响应为合成 fixture，不是实际模型调用。
