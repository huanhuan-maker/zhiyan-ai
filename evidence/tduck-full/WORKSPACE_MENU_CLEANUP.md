# 工作台功能精简（2026-10-25）

用户要求：保留“我的问卷、用户管理、系统配置”，移除截图中的其余功能。本轮是现有界面范围调整，不进入新业务阶段。

## 变更

- 管理员侧栏仅保留上述三项；普通用户仍只显示“我的问卷”。管理员权限要求保持，未把管理功能开放给普通用户。
- 移除共享模板、模板分类、主题列表、主题分类、回收中心的导航与页面加载；六个历史地址（含模板预览）返回 `/home`，同时清除旧地址的查询参数与 hash。
- 移除问卷编辑页、答卷页与统计页公用头栏中的“保存至模板中心”按钮及弹窗导入。
- 保留问卷内部“外观”、AI 建卷、“主题与报告”、预览、发布、收集和统计；图中主题库后台与 AI 分析主题不同。
- 不改后端、不删表或原数据。原模块源码/API 作为历史代码留存，不再从现有页面加载；本轮不宣称物理删除整个后端模块。问卷删除仍是原逻辑归档，确认文案改为“移除后不再显示在我的问卷”，不再依赖回收中心恢复入口。
- 活跃 E2E 套件用菜单精简回归替代已退役的模板分类管理测试；原兼容性回归改为核对“归档后列表移除、题目记录保留”，不继续要求已移除的回收站恢复 UI。答卷修改的选项断言限定到被修改的行，避免其他答卷同名选项造成定位冲突。

## 修改文件

`tduck-vue3/src/td/views/home/index.vue`、`router/modules/project.js`、`router/index.js`、`views/form/index.vue`、`views/project/my/card.vue`、`views/project/my/table.vue`（均位于同一 `src/td` 目录）；`tduck-vue3/tests/e2e/migration.spec.ts`；`scripts/tduck/workspace-menu.mjs`、`feature-flows.mjs`；根 README、前端 README、M4-R 报告及本证据目录。

本轮本地 Git 提交：`git log -1 --format="%h %s" -- evidence/tduck-full/WORKSPACE_MENU_CLEANUP.md`，最终答复给出实际提交号。未推送。其他既有未提交文件未纳入。

## 执行与证据

- 菜单专项：10 成功、0 失败。覆盖普通用户菜单、六个旧路由、新建保存、去掉模板按钮、普通预览、外观、AI/报告入口、管理路由拦截、手机菜单、逻辑归档与无浏览器异常。结果为 `workspace-menu/results.json`。
- 前端单元测试：31 成功、0 失败。
- 原 AI 建卷/四题型/发布/匿名提交/真实统计：10 成功、0 失败；生成响应为明确合成 fixture，未调用真实模型，见 `workspace-menu/core-results.json`。
- 前端构建退出码 0，仍有既有 Sass 弃用及包体积告警。
- 27 题型兼容、归档、权限与答卷编辑：5 成功、0 失败，结果保存于 `workspace-menu/compatibility-results.txt`；完整手工建卷闭环脚本：1 成功、0 失败，日志为同目录 `smoke.txt`。

初次回归存在旧查询参数被保留、测试读取隐藏菜单文字、富文本标题比较、未等待 Vue 渲染、漏传列表 folderId 和选项同名等失败；分别修复显式清理旧路由参数及对应测试前提/定位，保留 `initial-*` 结果，不用初次失败数冒充最终结果。

管理员菜单截图使用明确的 UI-only 合成管理员标志，仅验证三项菜单的呈现；服务端登录仍为真实普通合成账号，不修改管理员账号、不授予权限，也不宣称重新完成管理员接口验收。普通用户对管理路由的拦截实际执行。截图只截导航，避免包含真实项目内容：

- `D:/LcProject/evidence/tduck-full/workspace-menu/01-admin-menu-synthetic-state.png`
- `D:/LcProject/evidence/tduck-full/workspace-menu/02-menu-mobile.png`

PowerShell 实际验证命令（5180/8997 需已运行）：

```powershell
Set-Location D:\LcProject
node scripts/tduck/workspace-menu.mjs
node scripts/tduck/m2-usability.mjs
node scripts/tduck/smoke-full.mjs
node scripts/tduck/feature-flows.mjs
Set-Location D:\LcProject\tduck-vue3
npm.cmd test
npm.cmd run build
```

无需 SQL 迁移或重启后端。前端日常启动仍为前端目录 `npm.cmd run dev`；已运行时刷新 `http://localhost:5180/home` 即可。没有执行整个旧 E2E 套件，不把源码归档等同于服务端 API 已禁用。停在本轮界面精简验收。
