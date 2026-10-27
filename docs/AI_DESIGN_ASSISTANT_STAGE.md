# AI 单题优化与问卷体检

本轮 M5-D-DESIGN 对应用户授权的两项功能。入口在 AI 建卷审核草稿区和普通问卷编辑器；不改变现有聊天、作答和统计流程。

## 单题优化

每道受支持的题旁有“AI 优化”。填写要求或选用“措辞更中立”“选项更全面且互斥”“语言更适合目标人群”，生成原题与候选的对照。模型身份、调整理由和待核对事项会显示在窗口中。

只有点击“采用修改”才更新当前题；不会自动发布或保存到问卷。AI 建卷页可继续手动编辑、右上角暂时保存，或导入编辑器；普通编辑器沿用“保存”。取消、网络失败或候选校验失败都不改原题。题目、顺序、编辑器配置或研究需求在生成后变化，候选失效，需要重新生成。

支持单选、多选、评分、单行和多行文本，最多100题的上下文。保留原题型、必填和评分范围。编辑器有跳转逻辑或动态选项时，选项按原样保留；不自动更新关联逻辑。其他复杂题型使用原有手动设置。模型不拆分、新增或删除题目。

## 问卷体检

点击“问卷体检”→“开始体检”。报告逐项显示具体题号、问题、建议和原题摘录；可定位到题目，或把建议带入单题优化窗口，再由用户生成并采用候选。

本地规则检查明确的重复题干/选项、部分诱导词和可能重叠的数值区间；真实模型补充一题多问、含义不清、题干选项不匹配、覆盖和平衡等语义问题。模型证据必须是对应题干或选项中的原文，每个关联题号均须有引用。证据不存在时不展示为已验证的模型结论。

没有质量总分，也不将“未发现明确问题”等同于科学有效。数值区间规则不了解单位和开放/闭合边界，需人工核对。复杂组件仅检查文字，不证明跳转逻辑或量表效度。内容变化后报告明确提示已过期，禁用旧题号定位/优化。

## 接口、权限和保存

- `POST /user/form/ai/optimize-question`
- `POST /user/form/ai/review-survey`

登录用户调用，合计每用户每分钟20次。指定已有问卷时校验所有权；正在收集的版本禁止优化，可只读体检。客户端发送当前草稿的题干、选项、标题和研究需求，不发送答卷、受访者身份或 API 密钥。统一使用服务端现有默认 Provider，显示真实供应商和模型；未启用模型时不伪造优化候选，体检仅提供明确标注的本地检查。失败时可重试，普通编辑和作答继续可用。

本轮无需 SQL 迁移，接口不写问卷。候选与体检报告为临时预览，不单独持久化；采用后的题目走既有账号暂存或编辑器保存接口，刷新后从原数据库恢复。编辑现有草稿不会修改历史冻结版本。尚不包含信效度计算、文献核验或跨研究自动比较。

## Windows 运行与验证

在 `D:\LcProject` 的 PowerShell 中执行，现有 MySQL 隔离开发库与私有配置沿用：

```powershell
.\scripts\tduck\Build-FullBackend.ps1 -BuildName tduck-workspace-build
$env:JAVA_HOME='D:\jdk\jdk17'
& 'D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd' -q -f .local/tduck-workspace-build/pom.xml '-Dtest=Ai*Test,Assistant*Test,Analysis*Test' '-Dsurefire.failIfNoSpecifiedTests=false' test
.\scripts\tduck\Install-AnalysisBackend.ps1 -BuildName tduck-workspace-build
Set-Location D:\LcProject\tduck-vue3
npm run test -- --reporter=dot
npm run build
npm run dev -- --host 127.0.0.1 --port 5180
```

后端8997、前端5180；安装脚本只重启自己的隔离后端，并备份旧 JAR。验收脚本 `node scripts/tduck/ai-design-api.mjs` 和 `node scripts/tduck/ai-design-ui.mjs` 使用现有私有合成账号夹具，需要真实默认模型；界面脚本保留并恢复测试账号原暂存，测试问卷不包含真实答卷。

视觉检查：`node scripts/tduck/ai-design-visual.mjs` 重放已通过后端校验的真实模型结果，在桌面和390px两种宽度检查深浅主题、标题/标签对比度和弹窗横向溢出，不写数据库。

交付实测与截图见 [M5-D-DESIGN](../evidence/M5-D-DESIGN.md)。本轮完成后等待用户验收。
