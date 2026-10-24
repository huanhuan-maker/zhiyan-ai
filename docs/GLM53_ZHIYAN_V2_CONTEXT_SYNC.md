# GLM53 知研 AI 2.0 上下文同步报告

- 日期：2026-10-24（Asia/Shanghai）
- 作者：GLM-5.3（表单设计器兼容性与 AI 追问策略负责人）
- 性质：上下文切换 + 只读分析。本轮**未修改任何业务代码**，仅新增本报告。

---

## 1. 项目识别结果（实测，非转述）

| 项 | 实测结果 |
|---|---|
| 工作区 Git | `D:\LcProject` 单仓库，当前分支 `codex/tduck-full-vue3` @ `0b4d6cc`；旧分支 `master`(533e0df)、`fix/m1-lan-qr-sharing`(501e4ac)、`fix/m1-publication-lifecycle`(60c081c) 均保留未动 |
| 新 Vue3 前端 | `D:\LcProject\tduck-vue3`（非嵌套仓库，属本仓库；phase1 已提交于 `7b6f7f9`，另有 Codex **未提交**的 phase2 工作区改动，见 §3.2） |
| TDuck 后端源码 | `D:\tduck-survey-form-master`（无 `.git`，社区 v6；Spring Boot 2.7.8 / MyBatis-Plus 3.5.3 / 编译目标 Java 8） |
| 原 Vue2 前端 | `D:\tduck-front`（Vue 2.7 + Element UI + tduck-form-generator 2.0.5，仅作参照） |
| 运行端口实测 | 8998=开发后端（`.local\tduck-dev\tduck-api.jar` + `application-local.yml`，`scripts/tduck/Start-Backend.ps1`）；5180=新前端；8999=原 TDuck 正式后端；5173=旧知研前端残留进程 |
| 数据库实测（3306） | `tduck`（正式）与 `tduck_vue3_dev`（隔离开发库，19 表）并存；dev 库 `fm_user_form_item` 仅 3 条合成 INPUT，`fm_form_template` 0 行 |

结论：新工程全部路径可访问、服务在运行、开发库就绪，具备工作条件。**已将 TDuck × Vue 3 工程作为知研 AI 2.0 的唯一主开发基线。**

技术栈合规（老师要求）：Vue 3.5.44 ✓、ECharts 6.1.0 ✓、Spring Boot 2.7.8 ✓（未升级 SB3，符合“不得假定已升级”）、MyBatis-Plus 3.5.3 ✓、MySQL 8 ✓；TypeScript/Vite/Pinia/Element Plus 为辅助 ✓。

## 2. 新旧项目边界

- **旧「知研 AI」（`backend/`、`frontend/`、`db/`、`docs/M1_*`、`evidence/` 旧条目、两个 fix 分支）**：停止开发，归档保留。不删除、不引用其 Java 类/Vue 组件/SQL/路径。M1 局域网二维码的手机实测**未执行**，随项目切换中止；`fix/m1-lan-qr-sharing` 保持未合并、未 push。
- **新基线**：TDuck 后端 + `tduck-vue3` 前端 + `tduck_vue3_dev` 数据库。V0–V6 阶段规划以此为准，与旧 M0–M6 无关。
- 借鉴旧项目功能前必须先做新工程兼容性分析（例如旧项目的“版本冻结/Token 轮换”思想与 TDuck 的 `fm_user_form` 单行状态模型完全不同构，不能搬代码）。

## 3. 当前源码真实结构（已逐项核对）

### 3.1 tduck-vue3 已提交部分（phase1，`7b6f7f9`）

`src/pages/{LoginPage,FormsPage,DetailPage,AboutPage}.vue`、`src/api/client.ts`、`src/api/index.ts`、`src/stores/auth.ts`、`src/components/StatusChart.vue`（ECharts 状态分布，取后端分页 total）。登录、页签退出、列表/搜索/筛选/分页、文件夹、详情元数据。Codex 记录的 Vitest 25/25、Edge 9/9、HTTP 15/15 属其交付记录，**我未复跑**，后续以我的测试执行为准。

### 3.2 Codex 未提交的 phase2 工作区改动（我只读确认，未触碰）

- 修改：`package.json`、`src/{App.vue,main.ts,router.ts,api/index.ts}`
- 新增：`src/migration/{Editor,QuestionControl,PublicForm,Publish,Projects,FormShell}.vue`、`src/migration/{schema.ts,api.ts,style.css}`、`src/td/**`（原 Vue2 api/assets 移植）、`scripts/tduck/migrate-source.mjs`
- **方向**：手写 Vue3 编辑器/填写引擎直连 TDuck 题目 API（`/user/form/item/create|update|delete|sort`），Element Plus 原生控件渲染；公开填写走 `details/{key}` + `data/public/create`，对逻辑/微信/设备限制/复杂题型/regList 显式阻断并提示。router 已挂 `/home`、`/project/recycle`，编辑/填写/发布**尚未接线**，未交付未验收。

### 3.3 TDuck 后端关键事实（`D:\tduck-survey-form-master`，全部读源码确认）

- **状态机**：`FormStatusEnum` CREATE(1 未发布)/RELEASE(2 收集中)/STOP(3 停止发布)；发布要求 ≥1 个题目（`UserFormController.publishForm`）。
- **题型**：`FormItemTypeEnum` 共 37 种。首批四题型对应：单选=RADIO、多选=CHECKBOX、量表=RATE（评分，另有 SLIDER 滑块、MATRIX_SCALE 矩阵量表为相关项）、开放文本=INPUT/TEXTAREA。
- **题目存储**：表 `fm_user_form_item`，列 `form_item_id`（"field"+8 位十六进制，稳定 ID）、`type`、`label`、`required`、`placeholder`、`sort`、`span`、`show_label`、`default_value`、`scheme`(JSON)、`reg_list`(JSON)。
- **选项权威结构**（`OptionSchemaStruct.java`）：`scheme.config = { optionsType: "0"静态|"1"动态|"2"字典, options: [{label, value}], dictOptionType }`；Java 侧 `Option.value` 为 String。另有名额结构 `OptionQuotaListStruct`（options + quotaBlankWarning + quotaCycleRule FIXED/PER_DAY/…）。**动态/字典选项在静态读取时返回空列表**——无损转换的显式雷区。
- **答卷存储**：`fm_user_form_data.original_data` 为 JSON Map（`UserFormDataEntity.originalData`，JacksonTypeHandler），**以 formItemId 为键**；`serial_number` 由 Redis 自增；写入后同步 ES（`FormDataUtils.syncSaveFormData`）。值形态：RADIO→选项 value 标量、CHECKBOX→value 数组、RATE→数字、INPUT/TEXTAREA→字符串（Vue2 `write/index.vue:228` `originalData = data.formModel` + Codex WIP 渲染器绑定一致）。
- **关键端点**：研究侧（`token` 请求头，无 Bearer）`POST /user/form/create|update|publish|stop`、`GET /user/form/item/list?key=`、`POST /user/form/item/create|batch/create|update|delete|sort`、`POST /user/form/data/query|export`；公开侧（`@PermitAll`）`GET /user/form/details/{key}`（返回 form+formItems+theme+logic，考试题型会剔除正确答案）、`POST /user/form/data/public/create`（服务端校验填写设置：密码/设备次数/微信，**必填校验目前只在客户端**）；统计 `GET /user/form/report/{stats,situation,position,device,source,analysis}`。
- **Vue2 黑盒**：渲染/设计核心在 `tduck-form-generator@2.0.5` 的 `dist/TduckForm.common.js`（4.9MB 压缩，无源码目录、无随包 LICENSE，Codex 已警示许可风险）。`BizProjectForm` 内部完成 题目→控件 映射并输出 `formModel`；dist 中确认存在选项名额（quota）与 `formItemId+expression` 逻辑求值逻辑。

## 4. 已有 / 未完成功能（核对结论）

- 已交付（phase1）：登录、页签退出、工作台、列表/搜索/筛选/分页、文件夹、详情元数据、ECharts 状态分布（非答卷统计）。
- 进行中（未提交、未验收）：编辑器、公开填写、发布 UI（Codex phase2 WIP）。
- 未迁移：问卷创建入口、发布→填写→提交→统计完整闭环、答卷 ECharts 统计、分享链接/二维码、复杂题型、逻辑/主题/考试等。**与“不得声称已完成全部迁移”一致。**

## 5. 四题型 Schema 字段映射（我的核心交付）

TDuck 侧 → form-create 3.x rule 侧（rule 结构经检索官方文档核对：`{type, field, title, value, options, props, validate}`，rate 的 max 在 `props`）：

| 概念 | TDuck（列/scheme） | form-create rule | 备注 |
|---|---|---|---|
| 题目 ID | `form_item_id`（field+8hex，**稳定不可变**） | `field` | 必须同名，否则答案键错位 |
| 类型 | `type`：RADIO/CHECKBOX/RATE/INPUT/TEXTAREA | `type`：radio/checkbox/rate/input/textarea | 大小写差异；TEXTAREA 也可 `input`+`props.type='textarea'` |
| 标题 | `label` | `title` | |
| 选项 | `scheme.config.options[] {label,value}` | `options[] {label,value}` | value 类型需统一（Java=String，前端习惯 number） |
| 选项来源 | `config.optionsType` 0/1/2 + `dictOptionType` | 无原生对应 | 1/2 必须标记为不可无损转换 |
| 必填 | `required` | `validate:[{required:true,…}]` | 文案需自定义 message |
| 占位 | `placeholder` | `props.placeholder` | |
| 默认值 | `default_value` | `value` | |
| 布局跨度 | `span`（24 栅格） | 无原生对应 | 白名单丢弃并记录 |
| 量表最大值 | RATE 的 scheme 内 el-rate 配置（默认 5） | `props.max` | **量表语义待确认**（1-5 星 vs 0-10 分） |
| 答案 | `original_data[formItemId]` | `formData[field]` | 同构；CHECKBOX 为数组 |

**读取（TDuck→Vue3）**：`details/{key}` 或 `item/list` 取 `UserFormItemEntity[]` → adapter 生成渲染模型（Codex WIP `schema.ts` 的 `optionsOf` 即此路径：`scheme.config.options ?? scheme.options`）。**回写（Vue3→TDuck）**：编辑结果反序列化为 `UserFormItemEntity` 走 `item/create|update`（顺序用 `item/sort`），**不整包覆盖**未支持题型的 scheme（Codex WIP 已实现“复杂题型保留原配置，暂不允许覆盖保存”，方向正确，应保持）。

## 6. 方案比较与建议

| 方案 | 说明 | 评估 |
|---|---|---|
| A. 手写 Vue3 渲染/编辑器 | Codex WIP 现路线：Element Plus 直连 TDuck API | 无第三方/许可风险，渐进可控，四题型成本可接受；缺点是题型行为需逐一对齐原 generator 细节 |
| B. @form-create/element-ui 3.3.5 + form-create-designer 3.2.10 | MIT、peer vue ^3（Codex 已取实包证据 `evidence/tduck-vue3/editor-packages.json`，未安装验证） | 设计器能力强，但 rule 与 TDuck scheme 不同构，37 型无法一一对应，往返转换成本高 |
| C. 混合 | V2 走 A；B 作为独立研究项保留评估 | **建议**：与 Codex 现路线一致、不阻塞 V2；adapter 层独立成模块，未来可换引擎 |

无论 A/B，我都建议把 **TDuck schema ↔ 渲染模型** 的双向转换做成独立 adapter 模块（拟 `src/schema-adapter/`，纯新增文件），这是 AI 追问（V3）读取答案、写入追问原文的前置依赖。

## 7. 不支持 / 无法无损转换清单（首批四题型边界外）

1. 其余 33 种题型（矩阵/子表单/上传/考试 examConfig/预约/计价/图片选择等）——读取展示元数据可以，渲染与回写不做承诺。
2. `optionsType` 1（动态）/2（字典）选项、选项名额 quota（含周期重置）、`reg_list` 自定义正则。
3. 显隐逻辑（`fm_user_form_logic`，expression 求值在原 generator 内）——Codex WIP 现选择“阻断提交”，正确，不应假装兼容。
4. `span` 布局、主题（`fm_user_form_theme`）、分页题型、微信身份链路。
5. **后端无服务端必填/选项合法性校验**（`public/create` 只查填写设置）——对统计可信是实质风险，V3 前需以独立新增模块补服务端校验，不改 TDuck 核心。
6. 已知上游缺陷：type 创建/读取不一致（Codex API.md 记录）、dev 后端存储初始化报错（ES/上传未验证）、generator dist 无许可证据（不得拷贝其代码再分发）。

## 8. 测试方案（我的模块，获授权后执行）

- **单元（vitest）**：adapter 双向转换 golden 用例——四题型 × {新建、读取既有、回写} 固定 JSON 快照；选项 ID 不重排、未知字段保留不动为红线断言。
- **集成（8998 + tduck_vue3_dev）**：真实往返 `item/create → details/{key} → data/public/create → data/query`；含必填、选项 value 稳定性回归；只写 dev 库。
- **E2E（playwright）**：创建→编辑→发布→填写→提交→统计（依赖 Codex 的页面接线完成）。
- 证据落 `evidence/GLM53/`，如实记录失败用例，不删失败测试。

## 9. 与其他 Agent 的冲突风险

- Codex 活跃文件（**我不改**）：`src/migration/**`、`src/td/**`、`src/{App.vue,main.ts,router.ts,api/index.ts}`、`package.json`、`scripts/tduck/migrate-source.mjs`。
- 我的文件面（**纯新增**）：`docs/GLM53_*`、未来 `src/schema-adapter/**`。若引入 form-create 需动 `package.json`——必须先与 Codex 协调由谁执行。
- Kimi 负责页面视觉：我的 adapter 不含 UI；DeepSeek 审查面不受影响。
- 本轮实际改动：仅新增本报告文件（未触碰上述任何文件，未提交 Codex 的未提交改动）。

## 10. 下一步推荐任务（按优先级，等授权后开工）

1. **T1 schema-adapter + 四题型往返测试**（纯新增文件，V2 前置，1 轮交付）。
2. **T2 量表语义确认**：量表=RATE 1-5 星还是 0-10 分？需老师/用户拍板后固化 golden 用例。
3. **T3 dev 库集成探针**：创建含四题型的真实问卷，走完 创建→发布→填写→提交→查询，留 HTTP 证据（补上当前 dev 库无真实 RADIO/RATE 样本的空白）。
4. **T4 V3 AI 追问策略设计稿**：预算/停止条件/诱导风险约束/会话与日志表设计（依赖 T1 的答案格式稳定）。

---

**已将 TDuck × Vue 3 工程作为知研 AI 2.0 的唯一主开发基线；旧版知研 AI 停止开发，仅保留归档参考。**

本轮证据来源（全部本机实测/读源码）：`tduck-vue3/{package.json,vite.config.ts,src/router.ts,src/migration/*}`、`D:\tduck-survey-form-master` 各 Controller/Entity/Struct、`D:\tduck-front\src/views/form/write/index.vue` 与 `src/api/project/{form,data}.js`、`node_modules/tduck-form-generator/dist`（字节探查）、MySQL 3306 两库表结构与行数、`netstat` 端口、Codex 文档 `docs/tduck-vue3/{API,MIGRATION_RISKS}.md` 与 `evidence/tduck-vue3/editor-packages.json`；form-create rule 结构经官方文档检索核对（[form-create-designer](https://github.com/xaboy/form-create-designer)、[@form-create/designer npm](https://www.npmjs.com/package/@form-create/designer)、[组件规则说明](https://www.cnblogs.com/xaboy/p/13390438.html)、[v3 文档](https://pro.form-create.com)）。
