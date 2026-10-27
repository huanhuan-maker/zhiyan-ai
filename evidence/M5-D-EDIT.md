# M5-D-EDIT｜AI 草稿单题手动编辑修复

日期：2026-10-27（America/New_York）。实现提交：`768d616dc31427105f72a113713491ca4b474b25`；本交付记录与截图在后续文档提交。范围是修复现有问卷系统的编辑入口，不推进新阶段。

## 问题与结果

用户反馈：AI 生成后部分题目满意、部分需要手动调整，但找不到功能。检查发现 AI 建卷“审核草稿”只读，必须先导入编辑器；聊天生成预览也缺少直接进入编辑的操作。本轮先编写浏览器回归，旧页面实测 0 通过、1 失败（每题没有编辑按钮），见 [before.json](tduck-full/ai-draft-edit/before.json)。

现在每道 AI 草稿题旁都有“编辑题目”，弹窗支持题干、单选/多选/评分/开放题型、必填、选项增删、评分上限和文本提示。保存使用独立副本，仅替换选中的题；取消/关闭不更改任何题。校验空白、过长、重复题干与选项、选项数量和评分范围。修改不请求 AI，不立即建卷；当前标签页刷新恢复手动版本。预览与导入使用修改后的数据，导入仍走已有后端与真实 MySQL，问卷状态为未发布。

助手中的含题目新建预览增加“保存草稿并编辑”，点击沿用原确认接口创建未发布草稿，再打开现有编辑器。已实际用真实模型生成 4 题，通过此入口修改一题、保存、刷新，核对其他题干、必填、选项、评分、提示和题目编号保持原样。

新增弹窗适配手机与深色主题，删除按钮使用浅色背景/清晰文字。用户保存手改后会看到“含手动调整”提醒，AI 原有设计说明需重新核对。范围说明见 [AI_DRAFT_MANUAL_EDIT.md](../docs/AI_DRAFT_MANUAL_EDIT.md)。

## 实际验证

| 检查 | 通过 | 失败 | 证据 |
| --- | ---: | ---: | --- |
| 前端 Vitest（含新增 6 个输入/隔离校验） | 50 | 0 | [verification.json](tduck-full/ai-draft-edit/verification.json) |
| Edge 合成草稿编辑与真实导入 | 11 | 0 | [after.json](tduck-full/ai-draft-edit/after.json) |
| Edge 真实 AI 建卷→手改→预览→导入→刷新 | 6 | 0 | [real.json](tduck-full/ai-draft-edit/real.json) |
| Edge 真实助手建卷→保存并编辑→单题保存→刷新 | 4 | 0 | [assistant.json](tduck-full/ai-draft-edit/assistant.json) |
| 原导入续传/内容变化/丢失响应/网络失败回归 | 10 | 0 | [edge-results.json](tduck-full/ai-draft-edit/import-recovery/edge-results.json) |
| 凭据扫描 | 3 | 0 个新增命中 | [credential-scan.json](tduck-full/ai-draft-edit/credential-scan.json) |

前端 production build 成功；仅有现有 Sass 弃用和大包告警。真实 AI 记录的 Provider 为“本机推理网关”，模型标识为 `group/group`，无密钥输出。合成测试明确标记 MOCK，不冒充模型生成。所有写入只发生在 `tduck_vue3_dev` 的既有隔离合成验收账号中，仅新建测试草稿，没有修改真实用户问卷。

调试中修正了测试脚本对 Element Plus 隐藏 switch/组合框的定位；助手保存回归初始还将编辑器补充的运行元数据当作题目变化，改为逐项核对实际题目内容与字段编号。最终表中均为实际重跑结果。旧 `.local/tduck-dev/acceptance.json` 账号不能登录，本轮使用可正常登录的 `.local/assistant-simple/acceptance.json`；未重置或输出账号密码。

未更改后端 Java、数据库结构或 API，无新增 SQL 迁移，也未重复运行无关 Java 套件。既有 MyBatis-Plus 写入和所有权/发布冻结校验沿用。本轮没有全站压力或安全审计。凭据扫描的 1 处旧 M1 文档登记问题保留为未解决，本轮新增命中为 0。

## 运行与复验命令

在 `D:\LcProject` 的 PowerShell 中，已有后端 8997 和 Vite 5180 可直接使用；改动已经由当前 Vite 开发服务载入。

```powershell
# 后端关闭且端口空闲时，使用现有已构建实例；本次未修改后端
.\scripts\tduck\Start-FullBackend.ps1 -Background

Set-Location D:\LcProject\tduck-vue3
npm run test -- --reporter=dot
npm run build
# 前端关闭时启动；已有 5180 服务请直接使用
npm run dev -- --host 127.0.0.1 --port 5180
```

浏览器自动化（使用 `.local/assistant-simple/acceptance.json` 中的隔离夹具，Edge 与依赖已安装）：

```powershell
Set-Location D:\LcProject
node scripts/tduck/ai-draft-edit-ui.mjs --baseline  # 旧版失败证据已保存，修复版入口应通过
node scripts/tduck/ai-draft-edit-ui.mjs
node scripts/tduck/ai-draft-edit-ui.mjs --real
node scripts/tduck/ai-draft-assistant-edit-ui.mjs
```

注意：不需要在修复版再次运行 `--baseline`，它会覆盖 `before.json`，这里列明用于记录先前实际执行。导入恢复套件实际执行了 `scripts/tduck/m2-import-recovery.mjs`，通过内存字符串替换将夹具改为 `.local/assistant-simple/acceptance.json`、输出目录改为 `evidence/tduck-full/ai-draft-edit/import-recovery`；测试逻辑未更改，旧证据文件未覆盖。

## 截图与手工步骤

实际浏览器截图已查看：

- [单题编辑弹窗](tduck-full/ai-draft-edit/01-edit-dialog.png)
- [390px 深色编辑弹窗](tduck-full/ai-draft-edit/02-mobile-edit.png)
- [手动调整后导入编辑器](tduck-full/ai-draft-edit/03-imported-editor.png)
- [真实 AI 草稿单题编辑](tduck-full/ai-draft-edit/04-real-generated-edit.png)
- [真实 AI 手改后导入](tduck-full/ai-draft-edit/05-real-imported-editor.png)
- [助手保存并编辑入口](tduck-full/ai-draft-edit/06-assistant-edit-entry.png)
- [助手生成后手动保存](tduck-full/ai-draft-edit/07-assistant-manual-saved.png)

1. 打开 `http://127.0.0.1:5180/project/form/ai-draft`，生成草稿。
2. 对不满意的一题点“编辑题目”，修改题干/选项等，点“保存修改”。其他题应保持不变。
3. 再打开一题改字后取消，确认原题没有被覆盖。输入重复题干或重复选项保存，应留在弹窗并提示原因。
4. 刷新页面，修改仍在；打开答题预览核对，再导入编辑器并刷新核对持久化内容。
5. 若从问卷助手生成，可直接点“保存草稿并编辑”，进入编辑器选中题目，在右侧修改，点“保存设置”。

请反馈当前修复 PASS/FAIL；本轮到此等待验收。

## 修改文件与限制

实现提交的 8 个文件：

```text
tduck-vue3/src/td/generator/DraftQuestionEditor.vue
tduck-vue3/src/td/generator/draft-edit.js
tduck-vue3/src/td/views/form/ai-draft/index.vue
tduck-vue3/src/td/assistant/SurveyAction.vue
tduck-vue3/src/td/views/assistant/index.vue
tduck-vue3/tests/unit/draft-edit.test.js
scripts/tduck/ai-draft-edit-ui.mjs
scripts/tduck/ai-draft-assistant-edit-ui.mjs
```

文档提交另含 `docs/AI_DRAFT_MANUAL_EDIT.md`、`docs/DEVELOPMENT_PLAN.md`、`docs/ACCEPTANCE_GUIDE.md`、本报告与本轮独立证据目录中明确提交的 JSON/PNG。保留其他会话原有脏文件，不纳入本轮提交。

未导入草稿保存在本标签页 sessionStorage，清理浏览器存储或关闭标签页后不保证保留；正式保存请导入编辑器。手改不会自动重新生成 AI 设计说明，也不能替代用户核对题干与选项语义是否匹配。原导入中断后若内容已变化，沿用原策略另建草稿并提示，不覆盖先前已保存的部分草稿；可在问卷列表管理。已发布核心题仍受原冻结保护。
