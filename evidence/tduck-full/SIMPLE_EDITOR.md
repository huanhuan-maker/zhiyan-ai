# 简化问卷编辑器｜四种核心题型

2026-10-24。依据用户本轮要求，新建题型入口精简为单选题、多选题、量表题、开放题。本次是现有迁移阶段的 UI 调整，不开始 AI 开发；此前暂停的全量迁移目标继续暂停。

## 实际改动

- FormDesign.vue：左侧只保留四个入口和通俗用途说明。新建题型分别沿用 RADIO、CHECKBOX、RATE、TEXTAREA 协议；新建标题使用对应中文名称。量表默认 1–5 分，开放题为多行文字。删除 JSON 技术配置入口。
- SimpleFieldSettings.vue：右侧默认只显示题目标题、必填、选择题选项增删、量表分值（5/7/10）、开放题填写提示。完整属性收在默认折叠的“更多设置”。简单标题编辑转义 HTML，读取已有富文本标题时显示文字，未编辑则保留原内容。
- style.css：四张题型卡片的单列布局。
- smoke-full.mjs：从 UI 添加四种题型，断言面板恰好四个按钮、文件上传不在面板、更多设置默认折叠；真实保存刷新、发布、公开填写四题、后台查询。
- feature-flows.mjs / choice-flows.mjs：适配简化标题输入，以及展开更多设置后访问互斥属性。

旧题型定义、渲染及数据库内容均保留；原有 27 题型兼容回归继续运行。仅新建面板收敛，不自动删除、转换已有问卷。新增或删除选项保留现有选项值，新增值递增；不改后端 API、业务表或数据库结构。

## 执行证据

- `npm run build`：通过（仍有既有主包体积与 Sass 弃用提示）。
- `npm test`：31 项通过，0 失败。
- `npm run test:e2e`：11 项通过，0 失败，见 e2e-results.xml。
- `node scripts/tduck/check-templates.mjs`：Template failures: 0。
- `scripts/tduck/Verify-HTTP.ps1`：15 项通过，0 失败。
- 移除 JSON 入口后再次运行 build 与 smoke-full，均通过；截图已实际生成并查看：12-simple-editor.png。

首次浏览器回归因旧合成测试账号登录返回“账号或密码错误”失败（该失败不证明页面实现有错）。私有旧 fixture 已备份到 .local/tduck-full-audit/acceptance-before-simple-editor.json；使用现有 New-AcceptanceFixture.ps1 在 tduck_vue3_dev 新建随机合成测试账号及样例后，整套复跑通过。没有重置任何已有用户密码或删除旧问卷。管理员工作流 finally 恢复了隔离库管理员资料。

Git：本文件所在提交，可用 `git log -1 --format="%h %s" -- evidence/tduck-full/SIMPLE_EDITOR.md` 查询；只作本地提交，不 push。改动完整路径仍汇总在 FILES.txt。

## 使用

打开 http://localhost:5180/home，进入问卷编辑页后刷新。左侧单选四种题型之一；右侧输入题目和选项，保存即可。量表以评分控件呈现，默认 1–5 分；该 UI 调整没有加入 AI 分析能力，也不代表此前待验收的幂等、版本、统计准确性已经全部验收完成。
