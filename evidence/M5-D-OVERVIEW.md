# M5-D-OVERVIEW｜AI 暂存显示在问卷概览

2026-10-27，分支 `codex/tduck-full-vue3`；实现提交 `be9836d`。用户要求已编辑的 AI 问卷在点击“暂时保存”后显示在问卷概览，并可以继续编辑。

问卷概览读取当前账号已有的 AI 建卷暂存，在列表顶部单独显示标题、暂存状态、题数、时间和“继续编辑”。普通问卷总数与 AI 暂存数量分别显示，不创建重复问卷。暂存与“全部/待发布”、标题和时间筛选一致；两个视图均可见。请求失败显示可重试提示，普通列表继续可用。

从暂存入口打开时，如果本浏览器仍有与账号暂存不同的内容，页面优先保留本地内容并提示，可选择打开账号暂存版本；原本地内容留有副本，并可在页面中切回。普通保存仍使用现有账号数据库接口。当前系统每账号只有一份 AI 建卷暂存，后一次暂时保存会更新该账号的同一份暂存；这是现有接口能力，并非多个独立暂存槽。暂存和正式问卷仍是不同对象；导入编辑器后正式问卷不会自动替换原暂存。

修改文件：`tduck-vue3/src/td/views/project/my/index.vue`、`tduck-vue3/src/td/views/form/ai-draft/index.vue`、`scripts/tduck/ai-overview-ui.mjs`、本报告和本轮截图/结果。无需数据库迁移和后端更改。未修改真实问卷数据；使用独立合成账号做写入测试，测试结束恢复原暂存。

实际验证：

- `node scripts/tduck/ai-overview-ui.mjs`：9 成功、0 失败，覆盖真实暂存/恢复、标题与题数、编辑后再打开、筛选、账号隔离、本地与账号版本冲突、加载失败重试、390px 和浏览器异常；见 `tduck-full/ai-overview/ui.json`。
- 在 `tduck-vue3` 运行 `npm run test -- --reporter=dot`：57 成功、0 失败。
- 在 `tduck-vue3` 运行 `npm run build`：生产构建通过；已有 Sass 弃用和分包体积提示。
- 实际查看用户当前账号的概览，已显示《大学生AI使用情况与期待调查》、30 题、AI 暂存及继续编辑按钮，原有 9 份问卷仍在。没有将用户真实问卷截图或内容写入本轮测试结果。
- [合成账号桌面截图](tduck-full/ai-overview/01-overview-dark.png)、[合成账号手机截图](tduck-full/ai-overview/02-overview-mobile.png)。

PowerShell 本地运行沿用当前服务：在 `D:\LcProject` 执行 `.\scripts\tduck\Start-FullBackend.ps1 -Background` 启动隔离后端；在 `D:\LcProject\tduck-vue3` 执行 `npm run dev -- --host 127.0.0.1 --port 5180` 启动前端。已有服务运行时无需重复启动。访问 `http://127.0.0.1:5180/home` 验收，完成后等待用户反馈。
