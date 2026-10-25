# UI 改版回归复核（2026-10-25）

## 结论

UI 改版的核心流程没有回归问题。复核中发现并修复了首页的三类问题：左侧品牌文字被窄栏挤成竖排；列表请求失败时会清空已有列表且没有重试入口；首页排序文案与后端实际按创建时间排序不一致。右上角没有实现消息功能的按钮也已移除。

## 复核范围

- 首页/我的问卷：新建校验、真实保存、卡片和列表导航、状态筛选、断网提示与重试、移动端弹窗、日期筛选、账户菜单。
- AI 建卷：题数设置、生成、预览、导入和移动端滚动。
- 原有闭环：导入续传、编辑器预览、停收后编辑、发布、匿名填写、后端统计。

## 实际结果

| 检查 | 结果 |
| --- | ---: |
| 首页专项复核 | 11/11 |
| AI 建卷与核心闭环 | 10/10 |
| 导入失败续传 | 10/10 |
| UI 桌面/手机布局 | 5/5 |
| 前端单元测试 | 31/31 |
| 前端构建 | 通过 |

验证使用真实 `5180 → 8997` 和隔离数据库；新建问卷、提交数据使用合成测试名称，AI 响应为明确标注的 fixture，没有调用真实模型。专项截图和结果位于 `evidence/tduck-full/ui-review/`。

## 本轮修复文件

- `tduck-vue3/src/td/views/home/index.vue`
- `tduck-vue3/src/td/views/project/my/index.vue`
- `scripts/tduck/review-ui-refresh.mjs`

原有问卷、答卷、版本、统计和追问停用策略未改动。

## 接手续验（2026-10-25）

接续会话后核对到上述页面修复已保存在本地提交 `1b5b2b45a7c6a9e3ce85b2219b43cd52371f24e2`。本次基于该提交重新运行：首页 11 成功 / 0 失败，AI 建卷及真实核心闭环 10 成功 / 0 失败，导入续传 10 成功 / 0 失败，前端单元测试 31 成功 / 0 失败；生产构建退出码 0。桌面/手机布局 5 项为上轮记录，本次没有单独重跑该套件；本次首页专项包含 390px 弹窗、列表、日期选择器和账户菜单，已查看新生成的手机列表截图。

初次续验因 8997 未启动而连接失败，没有执行到业务断言；恢复服务后已复测通过。另修正验证脚本的两个记录问题：去掉写死的 `7800e2b` 提交号，改为读取实际 HEAD；初始化或整体执行异常现在计入失败并返回非零退出码，避免生成“0 成功 / 0 失败”的误导结果。本次首页结果的 commit 字段指向被测页面代码，脚本本身包含本轮尚未提交的上述记录修正。

实际执行的 PowerShell 命令（前两条仅在对应服务没有运行时执行）：

```powershell
Set-Location D:\LcProject
.\scripts\tduck\Start-FullBackend.ps1 -Background -StartupTimeoutSeconds 45
# 本次通过隐藏的后台 Node 进程运行同一 Vite 命令；手工验收可在独立终端运行：
Set-Location D:\LcProject\tduck-vue3
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5180 --strictPort
# 另开终端：
Set-Location D:\LcProject\tduck-vue3
npm.cmd test
npm.cmd run build
Set-Location D:\LcProject
node scripts/tduck/review-ui-refresh.mjs
node scripts/tduck/m2-usability.mjs
node scripts/tduck/m2-import-recovery.mjs
node --check scripts/tduck/review-ui-refresh.mjs
```

本次更新文件：`scripts/tduck/review-ui-refresh.mjs`、本报告，以及 `ui-review/home/` 中结果与 3 张截图、`ui-review/usability/` 中结果与 2 张截图、`ui-review/import-recovery/` 中结果与 3 张截图。上轮页面修复的完整文件列表可用 `git show --stat 1b5b2b4` 查看。续验结果复制到本报告同目录的 `ui-review/` 目录，原有未提交的历史证据及其他文件不纳入本轮提交。

本轮没有业务接口、数据库结构或 SQL 迁移变更，没有推进新阶段。AI 使用明确标注的合成响应；保存、发布、匿名提交、版本关联及统计使用真实 Spring Boot/MyBatis-Plus/MySQL 链路。本轮不重复宣称已验证真实模型。构建仍有既有 Sass 弃用与大包体积警告；未覆盖全部旧题型和外部服务组合。服务保留在本机 5180 → 8997 供用户验收。
