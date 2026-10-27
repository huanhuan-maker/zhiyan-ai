# M5-D-HEADER｜AI 建卷顶部操作

2026-10-27，分支 `codex/tduck-full-vue3`。实现提交 `42cf671`。

按用户截图，将“预览答题效果”“导入编辑器继续编辑”“重新生成”从草稿底部移至 AI 建卷固定顶部栏，与“暂时保存”并列。有草稿时显示；加载、生成、保存或导入期间按原规则禁用，导入保留加载状态。手机宽度时顶部按钮排列为两行。草稿说明和原有问卷功能保留。

修改文件：`tduck-vue3/src/td/views/form/index.vue`、`tduck-vue3/src/td/views/form/ai-draft/index.vue`、`scripts/tduck/ai-header-actions-ui.mjs`、本报告及本轮测试截图/结果。无需数据库迁移或后端变更。

## 实测

- 在 `D:\LcProject\tduck-vue3` 执行 `npm run test -- --reporter=dot`：57 成功、0 失败。
- 在同目录执行 `npm run build`：生产构建通过；仍有既有 Sass 弃用和分包体积警告。
- 在 `D:\LcProject` 执行 `node scripts/tduck/ai-header-actions-ui.mjs`：8 成功、0 失败。覆盖无草稿时隐藏、有草稿时位置、滚动后可见、实际预览、重新生成及忙碌禁用、390px、实际导入未发布问卷、浏览器错误。生成返回使用明确标注的合成模型数据，预览与导入使用真实页面和隔离后端；测试创建的问卷是合成数据。
- 首次测试5成功、3失败：测试误用预览对话框关闭按钮的英文无障碍名称，导致对话框未关闭及后续动作受阻；改为选择实际关闭控件后复验8项全部通过。首次结果保留在 `ui-initial.json`。
- [桌面截图](tduck-full/ai-header-actions/01-header-actions.png)、[手机截图](tduck-full/ai-header-actions/02-mobile-header-actions.png)；均为合成测试内容。

## 启动及验收

现有服务运行时刷新 AI 建卷即可。若需启动，在 `D:\LcProject` 的 PowerShell 执行 `.\scripts\tduck\Start-FullBackend.ps1 -Background`，再进入 `D:\LcProject\tduck-vue3` 执行 `npm run dev -- --host 127.0.0.1 --port 5180`。进入 AI 建卷并生成或打开草稿，确认顶部三个按钮分别能预览、导入和重新生成，滚动到问卷末尾仍可使用；暂时保存仍在右侧。本轮结束后等待用户验收。
