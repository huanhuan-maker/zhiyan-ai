# M1 前端实现与静态对齐记录

本文件是前端交接记录，不替代主验收报告或真实浏览器端到端测试。

## 修改范围

- `src/api/client.ts`：通用 CSRF JSON mutation、注册；登录仍使用 Cookie 会话，不持久化管理凭据。
- `src/api/surveys.ts`：四题型、草稿、版本、公开会话和统计类型；稳定题目/选项 ID；仅在 localStorage 保留公开分享链接。
- `src/main.ts`、`src/App.vue`：新建/编辑/结果/公开链接路由，保留 `/statistics` 原 M0 数据库诊断。
- `src/pages/LoginPage.vue`：注册、登录和退出；注册密码 12–72 字符。
- `src/pages/WorkspacePage.vue`：真实账户调查列表和真实空状态。
- `src/pages/SurveyEditorPage.vue`：四题型编辑、顺序调整、预览、草稿乐观锁保存、保存后发布、版本和一次性分享链接、关闭调查。
- `src/pages/PublicPage.vue`：参与说明、独立 AI 同意、真实匿名会话、手动保存进度、同标签刷新恢复、必填校验、最终提交和成功恢复状态。
- `src/pages/ResultsPage.vue`、`src/components/ResultsChart.vue`：按版本查询真实后端统计，ECharts 人数柱图与数字表，明确有效分母/总样本/缺失和多选比例说明。
- `src/components/QuestionInput.vue`：四题型统一填写和预览控件。
- `src/style.css`：编辑器、答题、统计与移动端布局。

## 已实际执行

在 Windows PowerShell、`D:\LcProject\frontend` 下执行 `npm run build`；真实运行 Vue TypeScript 检查与 Vite production build，退出码 0，转换 632 modules。没有执行或声称通过前端测试用例；编译构建不是端到端验收。

## 对照后端源码的检查

1. 创建直接发送 Draft；更新发送 `{draft, revision}`；发布前如果草稿修改，先等更新成功再用返回 revision 发布。409 草稿冲突显示服务端错误，只有主动重新读取才覆盖本地编辑。
2. `GET /api/surveys/:id` 的历史版本使用 `versions[].id/versionNumber/publishedAt`，更新返回没有 versions 时保留此前列表；发布后重新读取版本列表。
3. 所有公开写请求也经 CSRF。参与者 token 只保存在 sessionStorage，按公开链接隔离，不把答卷正文存进 localStorage。
4. 保存未填题时传空字符串，让后端作为缺失值处理；提交时将未填单选/量表/开放题、空多选统一规范为 null。空可选题不会发送 0 或强制选择第一项。
5. 单选传 option.id，多选传 string[]，量表传整数，开放题传字符串；引用展示均为 Vue 插值，无 v-html。
6. 关闭/链接无效/会话过期/网络错误展示服务端错误，不显示虚假成功。公开页只访问 public 接口，统计只访问需登录的调查结果接口。
7. 提交成功由服务端返回 SUBMITTED；刷新恢复该状态后不再展示可提交表单。重复提交是否幂等由服务端保证。
8. 一次性分享 token 不依赖后台再次读取；localStorage 不可用时保留当前页上的完整链接并提示手动复制，首次发布不自动导航以免丢失它。
9. 图表数据直接使用 results.options[].numerator；比例/均值使用服务端值，图表 resize/dispose 由组件生命周期管理；tooltip 为 richText，用户文本不经过 HTML 插入。

## 待主流程真实验证

由主智能体运行实际浏览器路径并截图：登录/建卷/发布/两个独立会话保存刷新提交/版本编辑前后不混淆/统计 2 份各 50%/关闭拒绝新增。此次前端子任务没有操作浏览器、启动新服务或创建新测试数据。

## 当前产品边界

仅 M1 固定问卷；AI 设置仅保存预留配置，界面明确不调用 AI。匿名会话在同标签页恢复；关闭标签页或清理 sessionStorage 后无法找回原填写会话。分享链接仅在发布时返回，请发起者另行保存。未实现 M2–M6。
