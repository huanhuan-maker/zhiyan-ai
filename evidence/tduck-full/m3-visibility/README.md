# M3 用户复验修复：追问入口与未生成原因

**后续用户决定停止追问方向，本报告已归档。** 当前停用状态见[停用记录](../followup-retired/README.md)。

日期：2026-10-25。用户反馈“没看到哪里有追问”。本轮仍为M3修复，不推进M4；本地提交为本报告所属提交，可用`git log -1 --format="%h %s" -- evidence/tduck-full/m3-visibility/README.md`查询，未推送。

## 核对结果

当前规则演示`RcluTkXX`已启用追问。只读取了匿名会话的同意/已用次数/动作/理由等元信息，没有导出用户回答。最近会话已同意并触发两次评估，均为`SKIP / NO_CLEAR_INFORMATION_GAP`，已用次数0；不是没有接入评估。旧页面只显示“不再追问”，未解释本地规则未识别到补充方向，入口也未说明需要逐题点击。

## 修改

- `GenerateForm.vue`：在顶部说明“同意→填写开放题→点击查看”的操作；开放题下始终显示“查看可选追问”，未同意时禁用并提示，不自动勾选同意、不发出决策请求。按钮使用主色突出。
- 同文件按后端实际理由说明规则未识别到方向、具体情境、次数/时间用完、拒答等；不把未识别到方向说成回答已经充分，也不强制生成问题。
- `followup.js`：真实模型模式明确显示“真实模型：Provider”，保留规则模式的“非模型”标签。
- `New-FollowupDemo.mjs`：支持显式`RULE`或`LLM`参数；LLM版单独建卷并检查真实Provider配置，完整链接写入另一个忽略文件，保留旧演示和用户填写记录。
- 新增`m3-followup-visibility.mjs`并加入`Verify-Followup.ps1`；新增真实模型演示UI验证`m3-real-demo-ui.mjs`，更新原UI回归的按钮定位及具体情境提示断言。

本轮只改前端、演示/验证脚本和说明，没有后端或SQL改动，不需迁移或重启后端。Vite开发服务自动更新，旧页面可强制刷新。

## 先复现、再修复的实际执行

| 命令 | 成功 | 失败 | 说明 |
|---|---:|---:|---|
| 修复前`node scripts/tduck/m3-followup-visibility.mjs` | 0 | 1 | 未找到操作指引，基线保存在本地忽略目录 |
| 修复后同命令 | 5 | 0 | 可发现入口、同意前不发送、明确规则跳过原因、不扣次数、刷新不重复调用、仍能显示实际问题 |
| `node scripts/tduck/New-FollowupDemo.mjs LLM` | 1 | 0 | 独立创建真实模型演示，旧卷未停止/修改 |
| `node scripts/tduck/m3-real-demo-ui.mjs` | 2 | 0 | 真模型生成可答追问，并可跳过；单独合成受访会话，未操作用户标签页 |
| `node scripts/tduck/m3-ui.mjs` | 6 | 0 | 设置/发布、拒绝AI、跳过/刷新/回应、网络失败不阻塞提交、审计与无未捕获错误 |
| `cd tduck-vue3; npm.cmd run build` | 1 | 0 | 32.61秒；沿用已有大包/旧样式弃用提示 |

真实模型演示：`NqqlwySZ` V1，`LLM`；测试输入为合成文本“食堂不太方便”，Provider“本机推理网关”、模型标识`group/group`，实际返回`CLARIFY / ASKED / AMBIGUOUS`，4411ms。问题显示在第四题下方，可填写补充回答或跳过。模型仅由服务端调用，服务端中立模板使用可定位原文；未使用Mock响应冒充真实调用。

证据：本目录`results.json`（5项）、`real-demo-results.json`（2项）；原6项UI结果位于`../m3/ui-results.json`。没有重复宣称本轮重跑旧报告的45项Java测试。

实际截图：

- `D:/LcProject/evidence/tduck-full/m3-visibility/01-skip-explained.png`
- `D:/LcProject/evidence/tduck-full/m3-visibility/02-followup-visible.png`
- `D:/LcProject/evidence/tduck-full/m3-visibility/03-real-model-question.png`

日志：`.local/tduck-full-audit/m3-visibility-{before,after,build,existing-ui}.log`及`m3-real-demo-ui.log`。本轮仍使用5180→8997。

## 用户复验

完整真实模型版链接保存在`.local/tduck-full-audit/m3-demo-real.json`，不提交Git。另建可重复演示：`node scripts/tduck/New-FollowupDemo.mjs LLM`。

1. 打开真实模型版，勾选“我同意参与可选追问”。
2. 在第四题“你认为食堂哪里需要改善？”试填“食堂不太方便”。
3. 点击该题下“查看可选追问”，等待模型判断，补充问题显示在该题下。

不同回答可能被判断为无需追问；规则词表覆盖有限，真实模型也不保证每次都提问。原规则演示及原会话评估记录保持不变；已经完成的单题评估不会因修改原回答而重复触发或扣减预算。
