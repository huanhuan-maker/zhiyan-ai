# M5-D-DESIGN｜AI 单题优化与问卷体检交付

2026-10-27，工作区 `D:\LcProject`，分支 `codex/tduck-full-vue3`。用户明确选择先做这两项；本轮已完成并停在验收，不推进其他功能。

实现提交：`632477063ac2e01d3d7459f799b6b68036bbb032`（`feat: add single-question AI optimization and evidence-based survey review`）。本文件与证据随后单独提交。

## 可用行为

AI 建卷审核草稿区和普通问卷编辑器都能点“AI 优化”生成单题候选，查看前后对比、理由、提醒和真实模型身份，再选择取消或采用。只采用当前题，保留其他题、原题型、必填和评分范围。编辑器保留字段身份和配置；选项重排复用原选项值，删除选项会清理失效默认值。存在跳转逻辑/动态选项时，服务端限制选项保持原样。

“问卷体检”逐项显示题号、分类、问题、建议和原文，区分规则与 AI 来源；可定位题目或把建议带入优化窗口。服务端逐字检查模型引用，不存在的证据导致明确降级，不显示为通过校验的语义结论。题目、顺序、编辑器配置或调查需求变动后，旧候选/报告失效。

采用不会自动发布。AI 建卷页点原有“暂时保存”，或导入编辑器；普通编辑器点原有“保存”。接口只返回建议，不写问卷；正在收集的核心题禁止优化，可只读体检。跨账号请求拒绝访问；网络/模型错误保留原题和普通编辑能力。

## 本轮文件

新增后端：

- `backend-extensions/assistant/tduck-form/src/main/java/com/tduck/cloud/form/ai/AiSurveyDesignService.java`：输入边界、Provider 调用、候选约束、规则检查、原文证据校验、降级。
- `backend-extensions/assistant/tduck-api/src/main/java/com/tduck/cloud/api/web/controller/AiSurveyDesignController.java`：两个登录接口、限流、no-store。
- `backend-extensions/assistant/tduck-api/src/test/java/com/tduck/cloud/api/ai/AiSurveyDesignTest.java`：17项设计助手测试。

前端：

- `tduck-vue3/src/td/generator/SurveyDesignAssistant.vue`：共用优化/体检弹窗、过期保护、原文定位、主题样式。
- `tduck-vue3/src/td/generator/design-assistant.js`：最小题目上下文、保留身份的单题采用。
- 修改 `tduck-vue3/src/td/generator/FormDesign.vue`、`tduck-vue3/src/td/views/form/ai-draft/index.vue`、`tduck-vue3/src/td/api/project/ai.js`，连接现有编辑与保存流程。
- `tduck-vue3/tests/unit/design-assistant.test.js`：7项转换/身份/默认值/快照测试。

验证：`scripts/tduck/ai-design-api.mjs`、`ai-design-ui.mjs`、`ai-design-visual.mjs`。文档：`docs/AI_DESIGN_ASSISTANT_STAGE.md`、`docs/DEVELOPMENT_PLAN.md`、`docs/ACCEPTANCE_GUIDE.md`、本报告及 `evidence/tduck-full/ai-design-assistant/`。

没有数据库结构变化，无需 SQL 迁移。没有修改上游源码目录、其他会话代码或既有真实问卷。所有验收题目为合成数据；界面测试前后恢复了合成账号原暂存。

## 实际执行和结果

| 验证 | 成功 | 失败 | 结果文件/说明 |
| --- | ---: | ---: | --- |
| 后端选定 AI/助手/分析 JUnit 套件 | 148 | 0 | `unit-build.json`；含本轮17项 |
| 前端 Vitest，8个测试文件 | 57 | 0 | `unit-build.json`；含本轮7项 |
| 实际 REST、所有权、真实模型、冻结保护 | 6 | 0 | `api.json` |
| 新功能 Edge 浏览器流程 | 11 | 0 | `ui.json` |
| 原有手动改单题、预览、导入/刷新回归 | 11 | 0 | `manual-regression/after.json` |
| 最终桌面/390px、深浅主题视觉断言 | 8 | 0 | `visual.json`；标题和分类标签对比度≥4.5，无弹窗横向溢出 |
| 凭据扫描 | 3 | 0 | `credential-scan.json`；本轮0新增命中，单独列出已有M1遗留记录 |
| 后端 clean package / 前端生产构建 | 通过 | 0 | `unit-build.json`；现有 Sass 弃用和 chunk 体积警告仍在 |

上述是不同层次的测试和检查，不把构建或模型调用次数混成单元测试数。未运行全仓库所有历史用例。后端套件也覆盖现有 AI 配置、助手查询/管理和分析，普通单题编辑回归覆盖实际导入与数据库刷新。

实际命令（PowerShell，完整启动步骤见功能文档）：

```powershell
.\scripts\tduck\Build-FullBackend.ps1 -BuildName tduck-workspace-build
$env:JAVA_HOME='D:\jdk\jdk17'
& 'D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd' -q -f .local/tduck-workspace-build/pom.xml '-Dtest=Ai*Test,Assistant*Test,Analysis*Test' '-Dsurefire.failIfNoSpecifiedTests=false' test
.\scripts\tduck\Install-AnalysisBackend.ps1 -BuildName tduck-workspace-build
node scripts/tduck/ai-design-api.mjs
node scripts/tduck/ai-design-ui.mjs
node scripts/tduck/ai-design-visual.mjs
Set-Location D:\LcProject\tduck-vue3
npm run test -- --reporter=dot
npm run build
```

原手动编辑脚本通过 `.local/ai-design/manual-regression.mjs` 运行，其内容与 `scripts/tduck/ai-draft-edit-ui.mjs` 相同，仅把输出改到本轮目录，避免覆盖旧证据。凭据扫描也仅替换输出路径后运行既有 `credential-scan.mjs`，不改扫描规则。

真实模型：**本机推理网关 / `group/group`**。REST 两项模型调用均成功，记录为 `real-optimization.json` 和 `real-review.json`。浏览器中的单题优化、整卷体检和普通编辑器优化也实际调用模型；反复取消/采用/过期/移动端测试重放已录制的真实候选和报告，网络失败用例明确中断请求。视觉用例仅重放结果并实际渲染，不冒充额外模型调用。

### 失败与修复记录

1. 首次后端套件148项中147成功、1错误：Mockito 重设已配置抛异常的方法时触发旧异常，改为 `doReturn`，最终148全部通过。不是将失败断言移除。
2. 首次新功能界面验证3成功、8失败（`ui-initial.json`）：脚本按完整 URL 后缀等待，漏掉签名查询参数；实际结果已显示，却被脚本当作超时，并造成后续弹窗阻挡。改为按 URL pathname 匹配。
3. 复跑10成功、1失败（`ui-retest-1.json`）：对未改题使用整行深比较，把现有“保存所有题”产生的更新时间和默认空提示规范化当成内容变化。改为仅排除更新时间、统一空提示，仍比较其他完整字段/题目配置，最终11成功。
4. 视觉检查发现深色标题和分类标签问题，修复标题样式优先级，分类改为稳定的文字标签。一次视觉断言5成功、1失败、2未执行（`visual-initial.json`）：浅色标签对比度4.14，调深文字后复验；最终8成功、0失败、0未执行。已实际查看最终深色体检、移动端深浅对比截图。

## 安装与持久化证据

前端5180、后端8997已可访问，安装到当前入口，原 JAR 已由既有安装脚本私下备份。`installed.json` 记录构建/安装 JAR SHA-256 相同、设计服务源码与构建副本一致、两端口监听及原账号暂存恢复检查成功。数据库仅使用 `tduck_vue3_dev`。

浏览器验证了：取消无改动；采用只改一题；暂时保存后新浏览器上下文恢复；普通编辑器采用前数据库不变、原保存后刷新保留，字段 ID不变；其他题内容/配置不变；过期候选不可采用；体检建议跳转；失败后仍能手动编辑和暂存；发布后冻结。

## 最终截图

- [深色桌面单题对比](tduck-full/ai-design-assistant/visual-dark-desktop-optimization.png)
- [深色桌面体检与原文证据](tduck-full/ai-design-assistant/visual-dark-desktop-review.png)
- [深色手机单题对比](tduck-full/ai-design-assistant/visual-dark-mobile-optimization.png)
- [浅色手机单题对比](tduck-full/ai-design-assistant/visual-light-mobile-optimization.png)
- [浅色手机体检](tduck-full/ai-design-assistant/visual-light-mobile-review.png)
- [普通编辑器采用并保存后](tduck-full/ai-design-assistant/03-editor-adopted.png)

完整八张 `visual-*.png` 来自最终视觉复验；配色旧截图不作为最终结果。

## 验收与限制

打开 [AI 建卷](http://127.0.0.1:5180/project/form/ai-draft)，生成/恢复草稿后试“AI 优化”→“生成优化建议”→“采用修改”→“暂时保存”，再试“问卷体检”→“开始体检”。普通编辑器也可使用，采用后需点保存。

支持最多100道题的输入上下文；本轮真实模型验收使用3/4道合成题，未宣称真实模型已完成100题体检。长卷受配置的上下文、输出和超时限制，失败会明确降级。原文校验保证引用存在，不证明模型的调查方法判断正确。数值区间规则需人工核对单位与边界；不包含信效度计算、文献核验、自动拆题或修改复杂跳转。体检报告/候选为临时预览，不单独持久化；采用内容由现有保存链路持久化。没有质量总分，不能把“未发现问题”作为问卷有效性证明。

请反馈本轮 PASS/FAIL；本轮交付至此，不自动增加其他功能。
