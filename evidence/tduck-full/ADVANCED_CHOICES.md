# 高级选项迁移补齐记录

2026-10-24，延续 M0 迁移验收，不进入 AI 或外部服务配置阶段。

## 原版依据与问题

本地原版 tduck-form-generator 2.0.5 的可读分发代码显示：动态选项采用 lodash 路径读取数据、文字和值字段；选中互斥值会替换其他值，选中普通值会取消互斥值。上一提交已经提供配置入口和基本动态加载，但答题提交/修改仍从静态 Schema 中查标签，导致远程选项标签可能为空；原版多选互斥属性也没有行为实现。

## 改动

- `generator/options.js`：读取嵌套/数组路径，递归映射级联子项，拒绝错误数据结构；按原版协议处理互斥值。
- `QuestionField.vue`：动态加载状态、15 秒超时、失败提示和重试；请求取消避免旧响应覆盖新配置；题目自己的 disabled 属性生效，签名禁用时停止手写交互。
- `GenerateForm.vue` / `FormDesign.vue`：每个表单实例独立保存运行时选项；不修改持久化的发布 Schema。设计器的互斥选项也读取当前运行时选项。
- `FieldSettings.vue`：多选互斥开关、互斥选项选择。
- `validation.js` / `ViewOrUpdate.vue`：提交和后台答卷修改共用带有动态文字标签的答案序列化，覆盖级联及子表单递归路径。
- `admin-flows.mjs`：使用 Windows 自带 PowerShell 的绝对路径，解除对 pwsh.exe 搜索路径的依赖。

## 实际验证

`node scripts/tduck/choice-flows.mjs` 独立运行通过。随后纳入 `npm run test:e2e`，当前整套 11 项测试全部通过、0 失败（见 e2e-results.xml）；构建通过、31 项单元测试通过、15 项 HTTP 检查通过、模板检查 0 失败。

新增工作流实际在设计器打开互斥、选择选项并保存；公开页面在第一次动态请求返回 503 后点击重试，操作真实控件，提交到隔离后端并查询原始答案；再在后台更改动态选择，核对值和标签，并确认发布 Schema 没有被改写。动态接口使用明确标注的合成 Playwright fixture，**未声称任何真实第三方接口通过**；问卷、发布、提交、答卷修改和查询全部调用 8997 的真实 Spring Boot/MySQL。

截图：`11-advanced-choices.png`。结构化断言结果：`choice-flows.json`。全部测试使用合成数据，没有在原库写入问卷。管理员工作流 finally 已恢复隔离库的账号资料。

调试中发现并修正了测试请求 defaultValue 必须为字符串、Element Plus 隐藏 input 的定位方式，以及把首次故障限定为公开答题请求。一次外部重跑的管理员脚本因 pwsh.exe ENOENT 失败，替换 PowerShell 路径后独立运行和最终整套复跑通过。不把这些早期失败当成最终成功结果。

启动方式与端口不变，见 tduck-vue3/README.md。本提交没有 SQL/后端代码变更。原有本地备份、旧工程和数据库均保留。体积警告、未实现的原版公开结果接口、外部服务、头像裁剪差异和其他高级组合的边界仍见 FULL_MIGRATION.md；本记录不能单独证明全部 TDuck 功能逐项等价。
