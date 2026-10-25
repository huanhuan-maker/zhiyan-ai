# M2 用户问题复测与修复（2026-10-25）

范围：修复用户反馈的“期望题数设置不了”和“生成后预览不了”，验证现有 M2 流程。不进入 M3，不删除旧项目，不更改端口或数据库配置。提交为本文件所在本地提交，可用 `git log -1 --format="%h %s" -- evidence/tduck-full/usability/M2_USABILITY.md` 查询；未推送。

## 问题与修改

| 文件 | 修改与原因 |
|---|---|
| `tduck-vue3/src/td/views/form/ai-draft/index.vue` | 数字输入原内宽 80px、左右 padding 合计 80px，值虽变化却不可见。局部修正宽度/padding；增加基于当前草稿的“预览答题效果”，四题型可实际填写，预览提交不写库；限制容器高度并允许滚动；导入保留卷首语及开放题提示。预览/导入共用题目转换。 |
| `tduck-vue3/src/td/views/form/index.vue` | AI 页尚无问卷 key，原顶部预览使用项目 key 导致空白。该页隐藏依赖已建问卷的顶部操作和侧栏，使用草稿自己的预览按钮。 |
| `tduck-vue3/src/td/api/project/ai.js` | 原 Axios 30 秒先于后端 90 秒超时。仅草稿生成延长至 120 秒，其他请求不变。 |
| `tduck-vue3/src/td/generator/FormDesign.vue` | 编辑器与已有 M1 版本契约对齐：收集中冻结；停收可编辑下一版草稿，已发布快照与旧答卷不变。 |
| `scripts/tduck/settings-flows.mjs` | 旧断言仍要求停收后锁定，更新为已有版本契约；另实际运行版本回归验证快照保护。 |
| `scripts/tduck/m2-usability.mjs`、`m2-slow-request.mjs`、`m2-real-usability.mjs` | 用户问题、慢请求和真实 AI 完整流程的专项回归。 |

本轮仅前端及测试变更，未更改后端或 SQL，不需要新增数据库迁移。

## 实际执行

修复前先运行回归：校正测试按钮定位后，9 项中成功 4、失败 5，失败为数字不可见、无草稿答题预览、显示无 key 的项目操作、卷首语导入丢失、停收后仍锁定。最初错误定位导致的测试超时不计作产品缺陷。私有基线：`.local/tduck-full-audit/m2-usability-before.json`。增加长内容滚动检查后，最终专项为 10 项。

| 命令（默认仓库根目录） | 成功 | 失败 | 说明 |
|---|---:|---:|---|
| `node scripts/tduck/m2-usability.mjs` | 10 | 0 | 明确标注的合成 AI 响应；真实后端导入、刷新、发布、匿名提交和统计。检查桌面/390px题数输入、滚动、四题型答题预览及预览不写库。 |
| `node scripts/tduck/m2-slow-request.mjs` | 1 | 0 | 控制响应延迟 32 秒，非真实模型。修复前被取消，修复后 32577ms 成功；不写库。 |
| `node scripts/tduck/m2-real-usability.mjs` | 5 组 | 0 | 真实 AI 场景“我想知道为什么大学生喜欢校外外卖”，指定 13 题；生成、导入前预览、导入刷新、人工编辑保存/预览、UI 发布、390px匿名填写、数据库持久化与13题后端统计全部通过。 |
| `node scripts/tduck/version-flows.mjs` | 20 | 0 | 改草稿/重发不改变旧版本题目、旧答案和统计，旧链接拒绝新提交。 |
| `cd tduck-vue3; npm.cmd test` | 31 | 0 | 4 个测试文件，含保留的历史原型测试，不等同于31项新迁移UI验收。 |
| `cd tduck-vue3; npm.cmd run test:e2e` | 12 | 0 | 首跑11成功/1失败（旧停收锁定断言），更新后完整复跑12成功。 |
| `cd tduck-vue3; npm.cmd run build` | 1 | 0 | 23.75秒，仍有原有大包提示。 |

真实 Provider：本机推理网关；服务端返回模型标识 `group/group`。真实生成耗时和题型清单见 `real-flow.json`；这是网关返回的标识，不推断网关内部模型。测试使用合成答卷，只停止测试自己创建的问卷，不删除用户数据。普通答题不调用 AI。

## 证据与复验

- `D:/LcProject/evidence/tduck-full/usability/results.json`：10项专项结果。
- `D:/LcProject/evidence/tduck-full/usability/slow-request.json`：慢响应结果。
- `D:/LcProject/evidence/tduck-full/usability/real-flow.json`：真实模型13题流程。
- `D:/LcProject/evidence/tduck-full/usability/01-generated.png`、`02-preview.png`：合成fixture界面与可交互预览。
- `D:/LcProject/evidence/tduck-full/usability/03-real-13-questions.png`、`04-real-answer-preview.png`：真实生成与答题预览；截图是视口内容，非整份13题的拼接。
- `D:/LcProject/evidence/tduck-full/e2e-results.xml`、`version-flows.json`：完整E2E与版本回归。
- 构建/测试日志：`D:/LcProject/.local/tduck-full-audit/m2-usability-*.log`（本地忽略，不发布原始配置/凭据）。

当前服务运行中，浏览器强制刷新 `http://localhost:5180/project/form/ai-draft`，填写调查目标/人群、设置题数并生成，滚动到底部点击“预览答题效果”。此时不用先导入。需要收答卷时再导入编辑器，人工审核并发布。

服务关闭后 PowerShell 启动：终端A在 `D:\LcProject` 运行 `.\scripts\tduck\Start-FullBackend.ps1`；终端B在 `D:\LcProject\tduck-vue3` 运行 `npm.cmd run dev`。不要重复启动占用端口的实例。当前入口5180，隔离后端8997、MySQL库`tduck_vue3_dev`；本轮未重启后端。

## 已知边界

导入仍是建卷后逐题保存，未做事务性失败回滚；中途网络失败可能留下不完整草稿。AI设计假设/维度仍只在生成页供审核，未持久化。未覆盖所有第三方服务及全部移动端布局，也未专测停收后修改草稿再预览的版本选择行为。本报告不宣称全项目无缺陷，M2继续等待用户复验，不推进下一阶段。
