# 本地核心闭环补齐验收记录

日期：2026-10-24，Windows / Asia/Shanghai。用户授权“先下一步吧”，本轮补齐普通问卷的提交防重和统计链，尚未进入 AI 阶段；交付后等待人工验收。

## 实现与运行

- 前端 `http://localhost:5180/home`，Vue 3 / Apache ECharts；后端 `127.0.0.1:8997`，Java 17 / Spring Boot / MyBatis-Plus / MySQL 8，隔离库 `tduck_vue3_dev`。
- 原 `D:\tduck-front`、`D:\tduck-survey-form-master` 和 8890/8999 保留；8998 未停止，旧知研工程、备份及历史答卷未删除。本轮不执行 push 或生产部署。
- 新增 `db/tduck/002_public_submission.sql`，已通过 `Apply-ClosureMigration.ps1` 在隔离库实际执行。只新增 `fm_public_submission` 回执表，既有题目/答卷表不改列、不清空。
- 可审查后端实现为 `patches/tduck-backend/core-closure.patch`，在 `local-acceptance-fixes.patch` 后应用；私有构建目录为 `.local/tduck-closure-build`。回执预占、行锁、保存答卷和完成回执位于同一事务，重复会话返回原答卷编号，不覆盖原内容、不重复通知。
- 5180 公开答题页以 sessionStorage 保存每份问卷的会话标识，经 `X-Submission-Key` 提交；服务端存哈希。缺少或格式错误的会话标识被拒绝，旧直接 API 客户端须适配。
- 后端提供量表均值、总答卷/本题有效/缺失数、选择题人数比例；开放题展示原文及问卷/题目/答卷编号。修正图表字面量换行符、渲染器和固定宽度溢出。
- 构建脚本统一私有副本的换行符，拒绝覆盖运行中的同一 JAR；后台启动脚本等待公开系统配置接口就绪后再返回。

## 实际自动化验证

| 检查 | 成功 | 失败 | 记录 |
|---|---:|---:|---|
| `npm.cmd run build`（tduck-vue3） | 1 | 0 | `.local/tduck-full-audit/closure-frontend-build.log` |
| `npm.cmd test` | 31 | 0 | `.local/tduck-full-audit/closure-unit.log`；25 项历史原型 + 6 项协议/校验 |
| `npm.cmd run test:e2e` | 12 | 0 | `e2e-results.xml`，9 项真实工作流 + 3 项认证检查；闭环断言包含其中，不重复加总 |
| `node scripts/tduck/closure-flows.mjs` | 6 组 | 0 | `closure-flows.json` |
| 重启本轮 8997 后执行 `node scripts/tduck/closure-flows.mjs --replay` | 1 | 0 | `.local/tduck-full-audit/closure-restart.log`，答卷总数仍为 4 |
| Java 17 Maven package（`-DskipTests`） | 1 | 0 | `.local/tduck-full-audit/closure-backend-build.log`；未声称运行 Java 单元测试 |
| 两份补丁在全新原源码副本应用/反向检查及与实际编译源码比对 | 1 组 | 0 | `.local/closure-patch-check`；本轮 5 个 Java 文件内容一致（统一换行符后） |
| 三份 PowerShell 脚本语法解析 | 3 | 0 | Build-FullBackend、Start-FullBackend、Apply-ClosureMigration |
| `scripts/tduck/Verify-HTTP.ps1` | 15 | 0 | `http-results.json` |
| `node scripts/tduck/check-templates.mjs` | 模板检查通过 | 0 | 本地控制台，Template failures: 0 |

闭环回归使用明确的合成问卷和真实数据库，验证：8 个并发同会话请求只保存一份且同 ID；修改内容重试不覆盖；独立会话即使同 IP 仍独立；缺少/错误请求头拒绝；评分 4、2 加一份缺失得出均值 3、有效 2、缺失 1、总数 3；多选 A 为 50%、B 为 100%；原文和定位编号保留；图表在 1440/375 像素视口不超出自身容器；真实浏览器提交并刷新重试不新增答卷。随后该合成问卷有第 4 份浏览器答卷，截图中的总数 3 对应浏览器提交前的同一次测试时点。

后台启动的就绪等待与重启回放均实际执行，日志为 `.local/tduck-full-audit/closure-start-ready.log` 及 `closure-restart.log`。秘密配置、令牌、原始运行日志和测试会话材料仅留在 `.local`，不提交。

实际后端编译命令：设置 `JAVA_HOME=D:\jdk\jdk17` 后执行 `D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd -q -f .local/tduck-closure-build/pom.xml -DskipTests package`。Build-FullBackend 封装脚本本轮验证了语法及运行实例拒绝保护；复制、补丁应用、源码比对和 Maven 构建分步实际执行，未在正在运行的同一 JAR 上重建。

## 曾经失败及修复

1. 先补回归，在修复前后端复现 8 个并发请求生成 8 个 ID，断言 `8 !== 1` 失败（`closure-before.log`），再增加数据库回执事务；修复后通过。最早一次使用过期合成账号登录失败，重建私有合成 fixture 后才执行此真实基线验证。
2. 在运行中的旧构建目录执行 Maven repackage 遇到 JAR 文件锁；改用独立 `.local/tduck-closure-build` 构建成功，并加入运行实例保护。
3. 全新源码副本应用旧补丁时发现 Git for Windows CRLF 与原 Java LF 不匹配；构建脚本只对私有源文件及补丁副本统一 LF，再应用两份补丁并与实际编译源码比对通过。
4. 重启后过早执行全套浏览器测试，登录页系统配置未就绪，出现 10 通过 / 2 失败；已保存失败日志及截图到 `.local/tduck-full-audit/startup-failures`，启动脚本增加就绪等待后重新启动、复验和完整重跑。最终结果以本轮 `e2e-results.xml` 为准，不把失败尝试隐藏为一次全过。
5. 视觉检查发现旧 TChart 的 600px 宽度覆盖列布局，增加统计页局部宽高设置和桌面/窄屏回归，重新生成并查看 14/15 截图。
6. 就绪后完整复测出现 11 通过 / 1 失败，单独重跑定位到管理员测试新建分类超过第一页后找不到行（30 秒等待超时，`closure-admin-before.log`）。修复回归脚本，使用页面已有名称搜索定位自己新建的分类，刷新后重新搜索，结束后只清理本次创建的模板分类，不清除既有分类；工作流失败输出改为写入私有诊断日志。

## 截图与人工验收

- `D:\LcProject\evidence\tduck-full\13-closure-analysis.png`：题目分析。
- `D:\LcProject\evidence\tduck-full\14-scale-analysis.png`：量表均值、有效/缺失数及真实频数图；已实际查看。
- `D:\LcProject\evidence\tduck-full\15-open-responses.png`：带答卷编号的原文及题目/问卷定位；已实际查看。

人工复验：5180 新建含单选、多选、量表、开放题的问卷 → 保存刷新 → 发布 → 独立浏览器上下文填写 → 同一标签页刷新后再次提交确认不重复 → 用另一独立会话填写不同答案 → 后台数据与统计核对。页面未自动恢复成功页时，刷新后再次提交会返回原提交成功，并不会覆盖原答卷。

## 启动命令

```powershell
cd D:\LcProject
# 重建前先识别并停止自己启动的 8997 闭环实例，勿停止其他端口。
.\scripts\tduck\Build-FullBackend.ps1
.\scripts\tduck\Apply-ClosureMigration.ps1
.\scripts\tduck\Start-FullBackend.ps1 -Background
cd D:\LcProject\tduck-vue3
npm.cmd run dev
```

后端已经运行时不重复启动/重建；启动保护不会擅自停止占用端口的进程。现有备份恢复无需重做。

## 边界与交付索引

防重针对重试会话，不是防机器人或每人一次；独立会话可产生新答卷，复制标签页可能继承 sessionStorage。已有历史重复答卷不自动清理。开放题最多显示前 100 条，完整记录见数据页；条件隐藏造成的缺失不能解释为总体比例，多选百分比合计可以超过 100%。量表 0 为未答默认值，超范围/非数值不纳入均值。未新增版本快照系统；统计按当前冻结问卷及已存答卷计算。

第三方文件存储、短信、微信、地图和真实 AI 尚未联调。大样本统计性能、所有高级题型组合和全后端安全审计不在本轮通过项内。构建仍有大包提示，迁入页面多数为 JavaScript，不能宣称全量严格 TypeScript 化。原迁移报告的结论及“32/32”不能证明本轮此前缺失的防重、量表和开放题功能；以这里的实际回归为这几项的依据。

本轮文件路径加入 `FILES.txt`。本地 Git commit 为包含本报告的提交，可用 `git log -1 --format="%h %s" -- evidence/tduck-full/CORE_CLOSURE.md` 精确查询；未执行 push。本轮交付后停下等待用户验收，若 FAIL 先补回归修复，不推进 AI。
