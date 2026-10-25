# 按用户决定停止追问方向

日期：2026-10-25。用户明确表示“追问这个方向就不搞了”。停止此前超时问题的修复与模型复测，不推进M4。此前截图对应的记录为`MODEL_FAILURE / TIMEOUT`，耗时6032ms；该历史记录保持原样，不伪造修复或成功结果。

## 当前行为与修改

- 公开表单`BizProjectForm.vue`关闭`allowFollowup`，`write/index.vue`不再启用该标志；旧问卷依然按原发布版本显示核心题目，界面不加载追问控件，也不发送追问请求。
- `views/form/index.vue`移除“AI追问”菜单；`router/modules/form.js`将旧设置路径重定向到同一问卷编辑器，保留query。
- 服务端`FollowUpController`增加默认关闭的`followup.enabled`门控：公开info返回`enabled=false`；新建会话、决策、同意变更、回应和配置保存均拒绝，进入Provider/会话处理前返回停用提示。拥有者的历史记录读取接口保留。
- `UserFormVersionService`在功能关闭时不再生成追问策略快照，普通发布不依赖追问策略查询。已发布核心题、策略快照及历史答卷没有重写。
- `Start-FullBackend.ps1`显式传入`--followup.enabled=false`，保持重启后关闭；临时8996测试后端已按路径/PID核对并停止。原版8890/8999/8998未操作。
- 原启动/演示/汇总追问脚本在入口提示归档并退出，避免误启动或继续调用。Git中的源实现与验证数据保留供历史追溯。

没有删表、删问卷或清理答卷，无需新增SQL迁移。当前依然使用Vue3/ECharts、Spring Boot/MyBatis-Plus、MySQL。后端变更仍通过`patches/tduck-backend/followup.patch`跟踪，增加停用测试后共15个Java文件；私有构建从原TDuck源码和完整补丁链重新生成。

## 实际验证

| 命令/检查 | 成功 | 失败 |
|---|---:|---:|
| 停用前`FollowUpDisabledTest` | 0 | 3 |
| 停用前`verify-followup-retired.mjs` | 0 | 1 |
| Java：`FollowUpDisabledTest`+`AiDraftServiceTest`+`LoginTokenReplayTest` | 25 | 0 |
| `Build-FullBackend.ps1 -BuildName tduck-m3-release-build` | 1 | 0 |
| `npm.cmd run build`（tduck-vue3） | 1 | 0 |
| `node scripts/tduck/verify-followup-retired.mjs` | 6 | 0 |
| 原`m2-usability.mjs`完整复跑，输出转至本目录 | 10 | 0 |

25项包含3项控制器门控测试（验证未调用FollowUpService）、18项原AI建卷校验/Mock测试、4项登录幂等保护。没有继续执行真实追问模型请求。

真实浏览器/API验证6项：已启用的旧问卷info仍返回false；4个公开追问写入口均停用；旧演示六道原题保持且追问控件/请求均为0；新固定问卷真实发布、匿名提交并从MySQL查到1份；菜单移除和旧URL跳转；AI建卷状态接口仍可用。

原10项闭环另验证四题型、草稿生成/导入、编辑器预览、真实匿名提交、量表后端均值和统计，生成响应为明确合成fixture，不冒充本轮真实模型调用。原历史45项等M3报告没有在本轮重复宣称执行。

部署：构建完成后仅重启路径核对通过的隔离8997，替换为停用版本，当前PID以运行检查为准。`build-artifacts.json`记录发布与运行JAR哈希；配置/数据留在原隔离库，不换端口。

## 文件、证据与运行

改动文件：`README.md`、`tduck-vue3/README.md`、`docs/DEVELOPMENT_PLAN.md`、历史M3报告的归档标记；上述前端4文件；`patches/tduck-backend/followup.patch`；`scripts/tduck/Start-FullBackend.ps1`、`Start-FollowupStaging.ps1`、`New-FollowupDemo.mjs`、`Verify-Followup.ps1`及新增`verify-followup-retired.mjs`。

结果：本目录`results.json`、`before.json`、`build-artifacts.json`与`m2-usability/results.json`。

截图：`D:/LcProject/evidence/tduck-full/followup-retired/01-fixed-questions-only.png`；原四题型闭环截图位于本目录`m2-usability/`。本地日志：`.local/tduck-full-audit/followup-*.log`（忽略，不含配置导出）。本地Git提交为本报告所属提交，`git log -1 --format="%h %s" -- evidence/tduck-full/followup-retired/README.md`可查；未推送。

日常启动不变：PowerShell终端A在`D:\LcProject`运行`.\scripts\tduck\Start-FullBackend.ps1`，终端B在`D:\LcProject\tduck-vue3`运行`npm.cmd run dev`。已运行时无需重复启动。刷新5180页面后仅有普通问卷；使用首页继续AI建卷、固定题发布、收集及统计。

已知边界：历史追问代码和数据作为归档保留，并非物理删除；历史演示标题属于原发布快照，仍可能含“追问”字样，实际功能已停用。没有在本轮实现新的AI分析/报告功能，也没有自动进入原计划后续阶段。
