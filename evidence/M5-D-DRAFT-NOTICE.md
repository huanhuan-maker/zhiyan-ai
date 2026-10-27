# M5-D-DRAFT-NOTICE｜草稿版本提示修复

2026-10-27，分支 `codex/tduck-full-vue3`；实现提交 `ddc5a63`。用户询问草稿版本提示的含义，并要求改得更清楚。

## 变更

当账号暂存与浏览器内容不同时，提示先说明当前显示的是哪一份、另一份在哪里，以及只有点击“暂时保存”才会更新账号暂存。按钮改为“查看账号暂存的内容”和“切回浏览器里的内容”。若切换前的内容已被用户修改，会标为“切换前的内容”，不会错误称作账号暂存。生成、导入或保存期间禁止切换。

比较改为忽略 JSON 对象键的排列顺序，同时保留题目、选项数组的顺序差异。成功保存当前草稿后，旧的冲突提示清除；账号内容用独立快照记录，避免编辑时把内存中的账号快照一并改掉。

切换前的本地副本按草稿独立存到当前标签页的 sessionStorage，可在同一标签页刷新后恢复；原旧版全局备份仅在第一个暂存且账号与标题或目标匹配时提供恢复。若内容一致不再显示恢复提示。sessionStorage 不可用时仅当前页面保留内存副本；关闭标签页后不保证本地副本仍在，账号已暂存内容继续存于数据库。没有自动替用户选择或保存。

修改文件：`tduck-vue3/src/td/views/form/ai-draft/index.vue`、`tduck-vue3/src/td/generator/draft-version.js`、`tduck-vue3/tests/unit/draft-version.test.js`、`scripts/tduck/ai-slots-ui.mjs`、计划/验收文档和本报告/测试证据。没有后端或数据库结构变动，不需要 SQL 迁移。当前用户页面只读核对，原30题草稿仍显示；写入测试使用合成账号，测试结束清理测试草稿。

## 实测

| 项目 | 成功 | 失败 | 说明 |
| --- | ---: | ---: | --- |
| 前端 Vitest | 59 | 0 | 9个测试文件，新增2项比较测试 |
| 真实浏览器与隔离数据库 | 13 | 0 | 版本切换、旧备份恢复、保存消除提示、3份暂存和手机布局；`tduck-full/ai-conflict/ui.json` |
| 前端构建 | 通过 | 0 | 保留既有 Sass 弃用与大分包警告 |

先加入对象键重排的浏览器回归，修复前11成功、1失败：相同内容误提示冲突（`ui-before.json`）。改进来源显示后，中间复验12成功、1失败：账号快照和页面引用共享，导致修改后来源判断错误（`ui-intermediate.json`）；将账号快照和显示内容独立复制，最终13项全部通过。没有删除失败断言。

桌面合成测试截图：[当前显示浏览器内容](tduck-full/ai-conflict/03-local-version-notice.png)、[当前内容来自账号暂存](tduck-full/ai-conflict/04-saved-version-notice.png)。已人工查看两种提示的深色样式。

## PowerShell 运行和验收

在 `D:\LcProject`：

```powershell
$env:AI_DRAFT_EVIDENCE_DIR='evidence/tduck-full/ai-conflict'
node scripts/tduck/ai-slots-ui.mjs
Remove-Item Env:AI_DRAFT_EVIDENCE_DIR
Set-Location D:\LcProject\tduck-vue3
npm run test -- --reporter=dot
npm run build
```

如需启动服务，在项目根目录执行 `.\scripts\tduck\Start-FullBackend.ps1 -Background`，前端目录运行 `npm run dev -- --host 127.0.0.1 --port 5180`；服务已运行时不重复启动。相同内容不应出现提示；有实际差异时核对来源说明，切换后检查内容、保存后核对提示及刷新。此轮完成后等待验收。
