# M4-R｜统计与可追溯分析交付（2026-10-25）

> 后续用户界面范围调整：工作台侧栏精简，仅保留我的问卷、用户管理、系统配置。模板/主题库/回收中心的界面和旧路由退役，统计分析功能保留。该调整的修改文件、测试、截图及启动命令见 [WORKSPACE_MENU_CLEANUP.md](tduck-full/WORKSPACE_MENU_CLEANUP.md)；下方为分析阶段原交付记录。

## 本轮范围与当前入口

用户在 UI 复核后明确授权开始“统计与分析页”。本轮按 `docs/ANALYSIS_STAGE.md` 实施，替代旧计划中依赖动态追问的 M4 安排。技术栈保持 Vue 3 / ECharts、Spring Boot / MyBatis-Plus / MySQL 8，追问继续关闭。完成本轮后停止等待用户验收。

入口仍为 `http://localhost:5180` → 隔离后端 8997 → `tduck_vue3_dev`。可直接打开合成验收问卷：

<http://localhost:5180/project/form/statistics?key=AQy19yzU>

这是明确标记的 Synthetic 数据，V1/V2 用于复核版本隔离。最终 V2 本地报告编号 `d0d37cbf-af53-4a74-a40c-77ea88cde0bc`，快照为 4 份答卷、量表均值 3.5，状态待审核。选择“主题与报告”查看。交付前另用相同的四份合成答卷生成了新鲜的真实模型演示报告 `c008f3ef-623b-46fa-9ced-dd3bcc84358b`，保留待审核；默认选中最近报告。模型识别了插座、晚间座位及增加座位建议三项候选，后两项引用重叠，不视为互斥分类或独立研究结论。演示元数据见 `demo.json`，导出见 `current-model-report.md`。

## 实际实现

- 统计页统一为“题目统计 / 主题与报告 / 访问与收集概览”。按发布版本切换题目、答卷、分母和报告；ECharts 读取后端结果。历史访问概览明确全版本口径，去掉混用全版本浏览量与最新版本答卷计算的“回收率”。图表提示改用富文本画布，避免将选项作为 HTML。
- 答卷页统一标题与版本栏；先确定版本和字段再加载表格。加载失败不退回混合版本，提供显式重试；390px 工具栏与分页可换行，不覆盖表头。旧答卷导入、导出和权限入口保留。
- 新增 `fm_analysis_report` / `fm_analysis_review`，经 MyBatis-Plus 保存报告快照与审核审计。没有删改既有题目、版本或答卷表；SQL 可重复执行。
- 后端在可重复读事务中捕获发布版本题目、全量支持题型统计及开放回答证据，并对版本内容与原始答卷计算指纹。支持单版本最多 5000 份答卷，超限明确拒绝本轮报告，不截断统计冒充全量。
- 证据按答卷编号和题目顺序入选，最多 200 条 / 60000 字符，单条超 2000 字符排除而非伪造截断原文。显示开放回答条数、入选、排除和覆盖答卷数。核心开放回答标记 `CORE_OPEN_RESPONSE`，不自动认定为自发提及，不读取历史追问记录。
- 默认“本地相同回答分组”：同题相同文本合并，最多十二组；明确非语义模型，算法标识 `exact-text-v1`。真实模式复用原服务端 Provider，生成前需核对输入并确认已有数据处理告知/授权。发送的只有临时证据编号、题干和入选原文，不发送账号、IP或数据库答卷编号；原文自身可能含个人信息，系统不宣称自动匿名化。
- 真实模型仅能提出候选主题与解释及证据编号。服务端拒绝不存在/重复的引用、模型自填引文/计数/多余字段、含阿拉伯数字或百分号的解释、坏 JSON、重复键、额外尾部输出及过深结构。引文由后端保存的原文提供；主题支持人数由后端按引用涉及的不同答卷去重计算，不能解释为总体比例。引用存在不证明语义支持，仍需人工复核。
- 模型调用在数据库事务外执行；失败不保存不可信结果、不覆盖旧报告，也不阻断普通答题。生成前指纹变化会拒绝发送并要求刷新输入、重新确认授权。
- 报告正文快照不可通过接口改写；人工通过/驳回需说明，采用乐观版本防并发覆盖，并在事务中追加审计。新增、修改或删除答卷会使旧报告显示数据变化；旧快照保持原状，不能直接再次审核通过。历史“已通过”表示当时的审核，不自动消除数据变化提示。
- 所有报告读写、审核和导出检查调查所有权；真实生成每用户每分钟最多 4 次，本地生成 12 次，另有读取与审核限流；响应不缓存。报告不提供公开分享入口。
- 导出 Markdown / JSON，包含版本、后端事实、证据坐标、模型/算法与审核状态；Markdown 转义原文中的 HTML/链接控制字符。修复全局 Blob 处理误解析 JSON 附件的问题，同时保留无附件头的 JSON 错误处理。

## 修改文件与 Git

新增后端源码为 Git 跟踪的 `backend-extensions/analysis/`，构建脚本在既有补丁链后复制增量 Java 源码，不修改上游工程。十一份 Java 源码及构建副本的逐文件哈希一致，构建与安装 JAR 哈希一致，见 `tduck-full/analysis/build-artifacts.json`。

主要变更：

- `backend-extensions/analysis/`：快照、校验、报告、审核、导出、Mapper、Controller 和 19 项新增 Java 回归。
- `db/tduck/006_analysis_report.sql`；`scripts/tduck/Apply-AnalysisMigration.ps1`、`Install-AnalysisBackend.ps1`、`Build-FullBackend.ps1`。
- `tduck-vue3/src/td/views/form/statistics/` 的统计、报告、概览；答卷页 `views/form/data/index.vue`；结果页手机头栏 `views/form/index.vue`。
- `tduck-vue3/src/td/api/project/research.js` 与 `api/index.js` 的附件处理。
- `scripts/tduck/analysis-api.mjs`、`analysis-ui.mjs`、`analysis-layout.mjs`、`capture-analysis.mjs`；旧 `smoke-full.mjs` / `closure-flows.mjs` 更新 UI 定位，保留原断言。
- 当前范围、启动说明、验收证据与本报告。完整提交清单见 `M4-R-FILES.txt`。

基线提交为 `f095466`。本轮本地提交可用 `git log -1 --format="%h %s" -- evidence/M4-R.md` 查询；最终答复给出实际提交号。未推送、未部署到公网。原有工作区的其他未提交文件未混入本轮提交。

## 实际测试结果

| 实际执行项 | 成功 | 失败 |
| --- | ---: | ---: |
| Java：新增分析 19 + 原 AI 草稿 18 | 37 | 0 |
| 前端 Vitest | 31 | 0 |
| 分析 HTTP：真实 MySQL、独立 SQL 原文核对、权限、分母、审核竞争、陈旧检测、真实模型 | 14 | 0 |
| 分析浏览器：ECharts、切版本、原文、审核刷新、下载、断网恢复、手机 | 13 | 0 |
| 答卷手机工具栏、数据版本切换、版本加载失败重试 | 3 | 0 |
| 真正停止/启动后端后的快照和非空审核审计恢复 | 2 | 0 |
| 原 AI 建卷及真实固定问卷闭环（生成响应为合成 fixture） | 10 | 0 |
| 原首页专项 | 11 | 0 |
| 追问继续停用 | 6 | 0 |
| 原 XLSX 模板/导入、CSV 与 XLSX 导出 | 4 | 0 |
| 原真实浏览器 smoke 脚本 | 1 | 0 |

以上合计 132 个脚本检查/测试用例，不表示穷尽所有组合。前后端构建退出码均为 0。结构化汇总为 `tduck-full/analysis/verification-summary.json`；各项细节和日志在同目录，原流程复测复制到 `regression/`，未用历史通过数冒充本轮执行。

真实模型：本机推理网关，配置模型标识 `group/group`；确实请求了已配置 Provider，返回结果经引用校验并持久化，见 `real-provider.json`。该标识为网关配置名称，不推断底层供应商或未暴露的模型版本。模型测试只发送合成回答，未打印或提交 API Key。原建卷回归和网络故障注入分别明确标注，没有当作额外真实模型调用。

本轮确实重启后端：`restart-process.json` 记录重启前后 PID；`restart-results.json` 核对原快照及一份有审核事件的历史报告完整保留。

### 发现与修复的失败

保留过程失败于 `tduck-full/analysis/initial/`，最终结果以同级最新 JSON 为准：

1. HTTP 证据测试误读旧详情接口字段，改为独立 SQL 核对数据库原文；初始 12 成功/1失败，最终相关项通过。
2. 浏览器测试旧关闭按钮名称及原生隐藏 radio 定位失败，调整为实际可操作控件；下载等待改为同时等待点击与下载事件，避免悬空 Promise。
3. JSON 下载真实失败：全局拦截器将 JSON 附件解析成对象。保留失败后修复；Markdown 和 JSON 的实际下载、内容和 HTML 转义均通过。
4. 手机答卷工具栏真实覆盖表头，先补几何回归得到失败，再修 CSS；最终 3/3。另一次截图等待被鼠标悬停的消息延时影响，移开鼠标后等待完整消息消失，未删除布局断言。
5. 旧 smoke 沿用上一轮 UI 改名前的名称输入提示和创建按钮，更新定位后完整登录→手工建卷→保存刷新→发布→匿名提交→数据页通过。

## 运行命令（PowerShell）

本机升级已执行；服务已运行，无需重复安装或启动。

```powershell
Set-Location D:\LcProject
# 独立目录构建，不覆盖运行中的标准 JAR：
.\scripts\tduck\Build-FullBackend.ps1 -BuildName tduck-analysis-build
.\scripts\tduck\Apply-AnalysisMigration.ps1
.\scripts\tduck\Install-AnalysisBackend.ps1
# 以后服务停止时日常启动：
.\scripts\tduck\Start-FullBackend.ps1
```

前端独立终端：

```powershell
Set-Location D:\LcProject\tduck-vue3
npm.cmd run dev
```

本轮真实执行的构建与验证命令：

```powershell
Set-Location D:\LcProject
$env:JAVA_HOME='D:\jdk\jdk17'
& 'D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd' -q -f .local/tduck-analysis-build/pom.xml -pl tduck-api -am test '-Dtest=AnalysisReportTest,AiDraftServiceTest' '-Dsurefire.failIfNoSpecifiedTests=false'
Set-Location D:\LcProject\tduck-vue3
npm.cmd test
npm.cmd run build
Set-Location D:\LcProject
node scripts/tduck/analysis-api.mjs --real
node scripts/tduck/analysis-ui.mjs
node scripts/tduck/analysis-layout.mjs
node scripts/tduck/smoke-full.mjs
node scripts/tduck/data-roundtrip.mjs
node scripts/tduck/m2-usability.mjs
node scripts/tduck/verify-followup-retired.mjs
node scripts/tduck/review-ui-refresh.mjs
# 再次执行安装脚本，确实停止旧进程并启动新进程；随后复核持久化：
.\scripts\tduck\Install-AnalysisBackend.ps1
node scripts/tduck/analysis-api.mjs --replay
# 交付前刷新真实模型合成演示并保存无弹窗遮罩的截图；只允许已知 Synthetic 原文：
node scripts/tduck/capture-analysis.mjs
```

脚本从忽略的 `.local/tduck-dev/acceptance.json` 读取合成账号，不要求把口令发到聊天。`analysis-api.mjs --real` 需要已配置且可用的真实模型；不满足时明确失败，不冒充真实调用。浏览器脚本使用前一脚本写入的本地合成验收记录。本轮没有运行整个旧 `test:e2e` 套件，而是执行上述与改动相关的专项及原闭环脚本。

## 截图路径

均为本轮实际生成、查看的合成页面截图：

- `D:/LcProject/evidence/tduck-full/analysis/01-statistics-desktop.png`
- `D:/LcProject/evidence/tduck-full/analysis/02-evidence-desktop.png`
- `D:/LcProject/evidence/tduck-full/analysis/03-model-report-desktop.png`
- `D:/LcProject/evidence/tduck-full/analysis/04-report-mobile.png`
- `D:/LcProject/evidence/tduck-full/analysis/05-evidence-mobile.png`
- `D:/LcProject/evidence/tduck-full/analysis/06-data-mobile.png`

## 用户验收与边界

1. 打开上方合成问卷，切换 V1/V2，核对题目统计与答卷页的版本、有效/缺失和量表均值。
2. 进入“主题与报告”，选择报告，点击证据，核对题干、原文、题目和答卷编号。
3. 查看生成输入，选择本地分组或真实模型。真实模式只有确认既有告知/授权后才能发送；本地分组不会调用外部模型。
4. 填写审核说明，保存后刷新；下载两种格式，核对版本、分母、来源和审核记录。
5. 在该版本新增答卷后刷新报告，确认历史快照不变且提示数据变化；重新生成后再审核。
6. 用 390px 模拟或缩窄窗口检查按钮、原文弹窗、表格横向滚动与分页。

已知边界：本轮不是整个旧后端的安全审计；未穷举全部旧题型/第三方服务/浏览器，未压测 5000 份上限。报告以四种当前核心题型为主，旧统计接口支持的其他题型沿用原实现。证据选择不是随机抽样，限额外文本仍保留在原答卷，本轮不做完整语义覆盖保证。审核授权是发起者对既有告知的确认，不是系统自动验证每条历史答卷的同意记录。模型主题与解释不证明因果、总体比例、统计显著性或论文创新。导出为 Markdown/JSON，未做 Word/PDF 排版。构建仍有既有 Sass 弃用和包体积告警。

当前停在 M4-R 用户验收，未自动推进下一阶段。
