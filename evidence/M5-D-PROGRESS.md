# M5-D-PROGRESS｜AI 建卷可见生成流程

2026-10-27，分支 `codex/tduck-full-vue3`。实现提交：`6705bd1`。用户授权先实现进度、已用时间、完成后的设计说明与失败重试，查看第一版效果。

## 本轮效果

点击生成草稿或顶部重新生成后，页面滚动到本次进度面板，展示提交的调查目标、目标人群、期望题数、真实等待时长、当前阶段与建卷提示。阶段为需求检查、AI 设计问卷、检查生成结果、草稿就绪；对应后端实际执行事件，没有时间驱动的假百分比或模拟模型内部思考。

后端在接收请求、校验输入后、调用真实模型/Mock前、收到输出后开始解析校验、通过校验/需要澄清/失败时记录事件。客户端约每1.8秒读取一次；短阶段可能不单独停留，但流程记录保留实际事件顺序和时间。没有人为延长生成时间。

完成后显示实际题型数量，并展示模型原本返回的调查维度；原设计假设仍可展开。人工编辑后提示重新核对说明。失败时显示明确原因与重试入口，保留输入及原有草稿；需要澄清时展示问题。生成期间锁定本次输入，防止结果与修改后的需求混淆。详细进度启动/读取失败时降级为等待结果，最多等进度接口2秒后可继续生成；进度请求静默失败，只在面板提示，登录过期仍沿用原处理。正常生成结果返回后立即恢复原操作，不等待进度接口完成。

## 文件和数据

- `backend-extensions/assistant/tduck-form/src/main/java/com/tduck/cloud/form/ai/AiDraftService.java`：保留原生成入口和构造器，新增进度回调。此文件作为已跟踪的附加覆盖源替代构建基线同名类，上游目录未改。
- `.../ai/AiDraftProgress.java`：仅保存进度事件的内存注册表，按账号隔离，UUID不可重复提交；最多512条、每账号3个未完成登记，15分钟过期。
- `backend-extensions/assistant/tduck-api/src/main/java/com/tduck/cloud/api/web/controller/AiDraftController.java`：登记/查询进度与生成关联、限流、no-store，兼容不带进度ID的原请求；记录进度异常不打断正常生成。
- `backend-extensions/assistant/tduck-api/src/test/java/com/tduck/cloud/api/ai/AiDraftProgressTest.java`：9项边界、事件顺序、隔离、过期和失败降级测试。
- `tduck-vue3/src/td/generator/DraftGenerationProgress.vue`：进度、计时、提示、重试与实际事件记录。
- `tduck-vue3/src/td/views/form/ai-draft/index.vue`、`tduck-vue3/src/td/api/project/ai.js`：真实状态联动、结果说明、保留草稿、轮询清理与防止旧返回覆盖新请求。
- `tduck-vue3/src/td/api/index.js`：进度请求可选静默错误，其他请求与登录校验继续原处理。
- `scripts/tduck/ai-generation-progress-api.mjs`、`ai-generation-progress-ui.mjs`：接口/真实模型和浏览器验证；本报告、计划/验收文档与同名证据目录。

不需要数据库迁移。进度记录不包含调查输入、问卷正文、答卷或模型内部思考，不修改已有问卷。测试仅使用独立合成账号和调查需求，没有保存新的问卷或修改用户暂存。草稿保存仍走现有三个暂存位置和原导入流程。

## 实际执行

| 验证 | 成功 | 失败 | 证据 |
| --- | ---: | ---: | --- |
| JUnit：AI草稿、进度、助手套件 | 102 | 0 | 包含本轮9项；未运行全仓库所有测试 |
| Vitest：8个前端测试文件 | 57 | 0 | 既有单题转换、数据等回归 |
| REST/真实模型进度 | 5 | 0 | `tduck-full/ai-generation-progress/api.json` |
| 浏览器流程与实际模型 | 9 | 0 | `tduck-full/ai-generation-progress/ui.json` |
| 前后端构建 | 通过 | 0 | 前端仍有既有 Sass 弃用、大分包提示 |
| 凭据扫描 | 3 | 0 | 本轮无新增命中；既有 M1 遗留单独列出 |

接口验证了账号隔离、不重复触发模型、失败不伪装完成，以及真实模型执行时记录输入检查→MODEL_RUNNING→VALIDATING→SUCCEEDED。`real-progress.json` 记录实际事件时间和调用身份 **本机推理网关 / group/group**，真实生成3题。

浏览器验证了等待期间计时和需求摘要、没有假百分比、事件控制阶段推进、实际题型说明、失败保留并重试、进度登记失败可继续生成、轮询失败不刷错误弹窗、澄清分支、手机与浅色布局，以及独立的一次真实模型生成。可控延迟/错误用例采用明确标注的合成事件与模型返回；真实模型用例另走实际后端，不能把合成用例当作模型调用。截图已实际查看，包含干净的手机等待面板和真实模型完成后的设计说明。本轮没有未解决的测试失败。

实际命令（PowerShell）：

```powershell
# D:\LcProject
.\scripts\tduck\Build-FullBackend.ps1 -BuildName tduck-workspace-build
$env:JAVA_HOME='D:\jdk\jdk17'
& 'D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd' -q -f .local/tduck-workspace-build/pom.xml '-Dtest=AiDraft*Test,Assistant*Test' '-Dsurefire.failIfNoSpecifiedTests=false' test
.\scripts\tduck\Install-AnalysisBackend.ps1 -BuildName tduck-workspace-build
node scripts/tduck/ai-generation-progress-api.mjs
node scripts/tduck/ai-generation-progress-ui.mjs
Set-Location D:\LcProject\tduck-vue3
npm run test -- --reporter=dot
npm run build
npm run dev -- --host 127.0.0.1 --port 5180
```

安装脚本已备份并替换本地隔离后端，前端5180、后端8997。构建和已安装 JAR 的 SHA-256 一致：`31C8057A554061B5A5F0A2839E9DFB4C3B317CFB058F47A310CAD96EABAD6076`。已有服务运行时不重复启动；后端新启动沿用现有 `.\scripts\tduck\Start-FullBackend.ps1 -Background` 和隔离开发库。

## 效果与验收

- [等待中的桌面面板（合成验收）](tduck-full/ai-generation-progress/01-designing-dark.png)
- [完成与题型说明（合成验收）](tduck-full/ai-generation-progress/02-complete-and-summary.png)
- [手机深色等待面板](tduck-full/ai-generation-progress/03-mobile-progress-dark.png)
- [手机浅色等待面板](tduck-full/ai-generation-progress/04-mobile-progress-light.png)
- [真实模型完成记录](tduck-full/ai-generation-progress/05-real-provider-complete.png)
- [真实模型生成的设计说明](tduck-full/ai-generation-progress/06-real-design-summary.png)

打开 AI 建卷，填写目标、人群和题数，点击生成；检查阶段和已用时间，完成后查看设计说明。题目很多时模型阶段会持续更久，没有预计完成时间。当前为完整结果返回后展示题目，不逐字/逐题流式输出。刷新或离开页面保留已缓存输入和原草稿，但不会恢复尚未返回的生成结果；进度为内存态，后端重启或过期后不可回查。当前没有取消上游模型调用功能。设计维度是模型提出的审核材料，不证明问卷信效度。交付后停下等待本轮反馈。
