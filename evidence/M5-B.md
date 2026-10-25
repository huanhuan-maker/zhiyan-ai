# M5-B｜模型配置可视化与统一调用（2026-10-25）

用户复核发现“AI配置”仍是未启用的DeepSeek开关，无法看见上一轮真实调用的模型。原因是旧页面读写旧环境配置，AI建卷/分析/助手使用另一份私有服务端Provider。此次修复这一断层，并实现用户要求的三协议、多供应商/多模型、思考强度、上下文和最大输出Token。保持Vue3/ECharts、Spring Boot/MyBatis-Plus/MySQL8，动态追问继续关闭；交付后等待用户验收。

## 当前入口与行为

管理员进入 <http://localhost:5180/manage/system> → AI配置。现有供应商“本机推理网关”、模型`group/group`已导入并保留为默认，连接成功。配置实际进入MySQL；关闭真实AI后旧本地配置不会自动覆盖，刷新和真正重启均保留。

- 自定义供应商名称、API根地址、Key、超时；协议下拉包含OpenAI Chat Completions、OpenAI Responses、Anthropic Messages。同一供应商共享地址与Key，最多30个模型；最多20个供应商。
- 每模型有显示名、实际API模型ID、思考强度、上下文窗口、最大输出Token、历史提问轮数；可用同一模型ID创建不同强度/预算的配置档。选为默认并保存，问卷助手、AI建卷、报告立即共用，不必重启。
- 思考强度可选模型默认、none/minimal/low/medium/high/xhigh/max；Anthropic不显示minimal。默认不发送思考字段；具体值是否被接受取决于模型，不伪装所有模型都支持全部档位。
- 三协议分别发送正确请求路径、鉴权、思考及输出字段。Chat可显式选max_completion_tokens或旧网关max_tokens；Responses用max_output_tokens并store=false；Anthropic用max_tokens、adaptive+effort或disabled。未完成/被截断的响应不能冒充完整结果。
- 上下文为应用预算，按UTF-8字节加固定开销保守估算，不等于精确分词，也不扩展模型实际容量。输入与输出预留超限时拒绝/降级，不截断题目与证据。助手仅携带同一所有者/会话/问卷/版本的最近成功提问，按配置0–20轮截取；不携带答卷原文或工具结果，界面已更新传输确认。
- 新Key以AES-256-GCM随机nonce加密入库；服务端主密钥保存在忽略目录，管理员读取也不回显明文/密文。空白保持Key；修改地址或协议要重新输入Key确认目标。普通用户无法读取或修改供应商配置。revision防并发覆盖，测试连接发送固定OK探针并限流。

## 文件与Git

基线`b97b2c3`。主要改动为`backend-extensions/ai-config/`十份Java及说明；`db/tduck/008_ai_settings.sql`；构建与迁移脚本；原DeepSeek组件替换为统一配置页及新API；系统页手机样式；助手历史提问筛选/规划及传输文案；两个专项自动化脚本、当前范围及本轮证据。完整清单为[M5-B-FILES.txt](M5-B-FILES.txt)。保留原组件文件名以兼容现有系统页引用，界面不再显示旧开关。

本轮本地提交可由`git log -1 --format="%h %s" -- evidence/M5-B.md`查询，最终答复给出实际号；未推送或公网部署。既有其他未提交文件未混入提交。构建把增量源复制到私有目录，不修改上游工程；33份增量Java与构建副本哈希一致，构建/安装JAR一致，见`ai-settings/build-artifacts.json`。

## 实际验证结果

| 本轮执行项 | 成功 | 失败 |
| --- | ---: | ---: |
| JUnit：新增设置25、原草稿18、分析19、助手24 | 86 | 0 |
| 前端Vitest | 31 | 0 |
| 设置HTTP：真实管理员/MySQL/三协议fixture/参数生效/历史/加密/实际模型/恢复原配置 | 14 | 0 |
| 设置真实浏览器：多模型/自定义供应商/协议选项/保存刷新/Key空白/实际连接/手机 | 9 | 0 |
| 实际后端重启后权限、供应商/默认模型/凭据解密及真实连接 | 2 | 0 |
| 原助手真实浏览器及模型规划、MCP、原文来源、断网恢复 | 15 | 0 |
| 原分析HTTP：包括实际模型生成与证据校验 | 14 | 0 |
| AI建卷界面及真实保存/发布/匿名提交/统计（生成响应为合成fixture） | 10 | 0 |
| 追问保持停用 | 6 | 0 |
| 合计 | 187 | 0 |

前后端构建成功，JUnit无失败/错误/跳过。以上是执行的用例/脚本检查数，不代表穷尽全部组合。结构化结果和日志在`tduck-full/ai-settings/`及其`regression/`，未用历史成功数代替本轮执行。凭据扫描另3项通过，本轮文件0新增命中；旧`M1_VERSIONS.md:116`登记的遗留项仍未处理。

真实性区分：已有本机网关`group/group`真实完成配置连接探针、浏览器助手规划、分析报告生成，并在后端重启后再次连接成功。该标识只是网关配置别名，不推断底层供应商或模型版本。Responses/Anthropic及两个自定义模型档使用本地HTTP服务器返回明确Synthetic响应，核对协议原生请求及鉴权字段，**未声称持有或调用这两家的真实账号**。本地HTTP服务器仅为测试fixture，无新增Node业务服务。所有模型测试使用合成提问/回答，不发送真实健康数据。

先完成PID2364→31684的重启，加入追踪日志保护后再次重启为31684→24148；最新记录见`restart-process.json`、`restart-results.json`。对照配置指纹（不含revision）并实际解密、请求原模型。测试临时新增的供应商和模型均已移除，原有真实配置保留。

### 过程失败与修正

先建立界面回归，旧实现实测0成功/1失败并截图，确认看不到实际供应商：`baseline-ui.json`与`baseline-old-config.png`。替换实现后该项通过。

初次HTTP为12成功/2失败，原因是脚本把既有建卷状态URL误写为ai-draft/status，改为真实的ai/status；保存过程记录`initial-api-results.json`。连续多次运行随后触发应用分钟限流，9成功/5失败，见`rate-limit-api-results.json`；测试客户端改为尊重分钟窗口后重试，未提高或关闭服务端限流，并恢复原配置。最终14成功/0失败。

交付前检查发现上游可选HTTP追踪会记录完整头和正文。新增不记录请求/响应内容的替代过滤器及日志回归，实际捕获日志确认不含Key/token/query/响应正文；全部86项Java复测、重新构建安装和重启连接验证通过。默认追踪开关未改变。

最后一次重启后，网关的首次固定探针没有返回可用文本，检查1成功/1失败，保留`empty-probe-restart-results.json`；接口明确报错，没有当作连接成功。未修改配置或移除校验，再发同一探针复测2成功/0失败。该次空响应说明连接测试也可能受远端瞬态输出影响，可显式重试，应用不会静默改参数。

界面扩展用例首次8成功/1失败，重复成功通知导致Playwright严格定位冲突，见`initial-ui-results.json`；随后等待响应时漏考虑旧请求签名query参数，6成功/3失败，见`request-sync-ui-results.json`。改为等待正确pathname的POST响应并核对真实返回值，最终9成功/0失败。没有以通知出现代替保存成功。

## PowerShell执行与启动

已在本机完成升级，日常无需重做。以下从`D:\LcProject`执行；依赖已有隔离开发库与私有配置，原分析/助手迁移为前置。

```powershell
.\scripts\tduck\Build-FullBackend.ps1 -BuildName tduck-ai-settings-build
.\scripts\tduck\Apply-AiSettingsMigration.ps1
.\scripts\tduck\Install-AnalysisBackend.ps1 -BuildName tduck-ai-settings-build
$env:JAVA_HOME='D:\jdk\jdk17'
& 'D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd' -q -f .local/tduck-ai-settings-build/pom.xml -pl tduck-api -am test '-Dtest=AiSettingsTest,AiDraftServiceTest,AnalysisReportTest,AssistantQueryTest' '-Dsurefire.failIfNoSpecifiedTests=false' '-DfailIfNoTests=false'
node scripts/tduck/ai-settings-api.mjs --real
node scripts/tduck/ai-settings-ui.mjs
node scripts/tduck/assistant-ui.mjs
node scripts/tduck/analysis-api.mjs --real
node scripts/tduck/m2-usability.mjs
node scripts/tduck/verify-followup-retired.mjs
# 真正重启后再核对；仅运行replay不等于已重启：
.\scripts\tduck\Install-AnalysisBackend.ps1 -BuildName tduck-ai-settings-build
node scripts/tduck/ai-settings-api.mjs --replay
Set-Location .\tduck-vue3
npm.cmd run build
npm.cmd test
```

迁移新增一表，可重复执行，不修改问卷/答卷；主密钥首次生成，之后不覆盖、不打印。日常根目录运行`Start-FullBackend.ps1`，前端目录运行`npm.cmd run dev`；端口5180→8997，已运行时不重复启动。脚本测试写入Synthetic数据；API测试需本机私有管理员凭据及合成owner配置，UI读取API脚本保存的忽略会话文件。不要公开这些文件。测试后将原阶段证据恢复为既有提交，本轮回归结果单独复制归档。

## 截图与人工验收

- [完整配置页及实际连接成功](tduck-full/ai-settings/01-settings-desktop.png)
- [手机供应商配置](tduck-full/ai-settings/02-settings-mobile.png)
- [手机思考、上下文及输出设置](tduck-full/ai-settings/03-model-mobile.png)

截图为本轮实际管理员浏览器并已查看，不含真实Key。

1. 刷新系统配置 → AI配置，确认实际供应商与group/group、默认模型、Key“已保存”提示可见。
2. 点添加模型，填供应商支持的实际模型ID、显示名及参数。同一供应商可添加多个不同模型，或用不同强度保存不同配置档。
3. 若添加另一供应商，选API协议、根地址、Key；不要在根地址后重复填写/chat/completions、/responses或/messages。变更原地址或协议需重填Key。
4. 选择默认模型，保存；点测试连接，应显示成功耗时或清楚的错误。刷新检查设置未丢，Key应为空白并提示已保存。
5. 打开问卷助手切AI理解、确认提问传输，检查显示的默认模型一致；用自己的问卷提问并复核后端统计/原文。上下文设太小时应明确失败/降级；恢复合适设置，不影响普通答题。
6. 使用普通用户确认无配置权限；手机查看各项输入、保存与测试。反馈PASS/FAIL后再进入其他工作。

## 已知限制

当前为系统统一默认模型，没有每用户私有供应商、每功能独立默认或每次对话临时切模型。接口只支持这三种非流式文本协议；不自动拉取远程模型目录，也不预设模型能力。是否接受指定强度、输出值或协议需实际供应商验证，不会悄悄删除不支持的参数重试。

上下文预算为保守估计，不是tokenizer；可能提前拒绝实际仍可容纳的请求。历史只包含同范围提问，未实现把工具结果/答卷送入多轮自由对话；这与现有数据传输确认及统计可信边界一致。连接成功仅验证当前固定探针，不能保证所有任务都成功。原Sass旧API及包体积警告保留。未进行全量旧test:e2e、所有第三方真实账号互操作或负载/安全审计。

数据库中的密钥是密文，但持有数据库与对应主密钥的人可解密；备份两者需私下管理，丢失主密钥不能恢复旧Key。现有私有YAML保留为首次导入来源，本轮没有公开、删除或迁出用户原始凭据文件。
