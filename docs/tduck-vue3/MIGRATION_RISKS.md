# 编辑器兼容性与迁移风险

检查日期：2026-10-24。只调查，不实施设计器替换。

## 本机现状

`D:\tduck-front\package.json` 声明 Vue 2.7.0、Element UI 2.15.14、Vue Router 3.4.9、Vuex 3.6.0、tduck-form-generator ^2.0.5。本地安装的 generator 确为 2.0.5；其 package.json 使用 Vue 2.7、Element UI、Vuex 3、vuedraggable 2，分发入口为 `dist/TduckForm.common.js`，没有 Vue 3 构建入口。

原 `src/views/form/editor/index.vue` 直接导入 FormDesign；TduckFormMixin 将原 Token 写入组件约定的 localStorage 键，组件包含自己的业务 API 依赖。仅修改主工程 Vue 版本不能迁移这个组件。原包还声明 vue-template-compiler 2.6.12，与 Vue 2.7.0 不同，需要单独评估旧工程构建兼容性，本轮没有更改或重建旧前端。

本机 generator 分发目录仅含 dist、配置及 README，没有实现源码目录，package.json 未标明 license，也未发现随包 LICENSE。外层 TDuck 前后端的 MIT LICENSE 不能自动证明该包和所有素材的独立授权。可保留已部署系统作参照，不应擅自把该分发包改造成新的可再分发设计器或引入商业版本。

registry 查询当前公开版本最高为 2.0.5；这只说明本次所查 npm 包，没有证明 TDuck 的所有私有或商业版本不支持 Vue 3。原 `scripts/toggle-formgen.js` 还会切换到本机不存在的 `tduck-front-full/src/formgen` 或 1.9.5；本阶段未运行它。

## Schema 可复用范围

后端 UserFormItemEntity 保存 formKey、formItemId、type、label、required、sort、scheme、regList 等，FormItemTypeEnum 有 37 种题型。稳定题目 ID、排序、标签、选项值及原始 JSON 可以作为迁移输入；现有数据库不需要为了只读页面改写。

但 schema **不能直接认为兼容另一个设计器**。scheme 内的组件专有配置、分页、矩阵、子表单、文件上传、考试正确答案、计价、预约、外部数据源及显隐逻辑，依赖原引擎行为。后续应建立显式适配层，保留原 schema、题目/选项 ID 与答卷关联，验证往返转换；不支持的类型应列明并阻止无损保存承诺。

本阶段新详情仅显示题目元数据和直接存在的 options，复杂组件不会伪装为完整渲染。统计、题目冻结、全问卷追问预算、证据定位等研究约束需独立实现，不能从“表单系统可用”推导已经满足。

## 已查证的 Vue 3 候选

| 候选 | 本次实际证据 | 可以得出的结论 |
|---|---|---|
| @form-create/element-ui 3.3.5 | npm 实包 package.json、LICENSE；peer vue ^3.5.12，包描述为 Element Plus 版本；MIT LICENSE，copyright 2022 xaboy | 可作为 Vue 3 渲染器候选，名称中的 element-ui 不代表此版本使用 Vue 2 |
| form-create-designer 3.2.10 | npm 实包 package.json、LICENSE；peer vue ^3.1.5，依赖 element-plus、vuedraggable 4、@form-create/element-ui 3.x；MIT LICENSE | 可作为社区 Vue 3 设计器候选；未安装进新工程、未做兼容性运行验证 |

来源：[form-create](https://github.com/xaboy/form-create)、[form-create-designer](https://github.com/xaboy/form-create-designer)。只检查普通社区版本，未采用 OEM/Pro 版本或付费素材。原始 tarball 与完整元数据保存在本地 `.local/tduck-research`，可审查的摘要在 `evidence/tduck-vue3/editor-packages.json`。后续若集成仍需锁定依赖、保留 MIT 版权与许可，审核具体插件和资源；本次的许可检查不替代完整依赖供应链审查。

## 成本及后续闸门

| 范围 | 相对成本 | 进入下一阶段前需要的证据 |
|---|---|---|
| 登录、列表、只读元数据 | 低，已完成本次实现 | 本阶段验收 |
| 单行/多行、单选/多选等基础题型适配 | 中 | 原 schema → 新引擎 → 原数据契约往返测试，真实保存/刷新 |
| 逻辑、分页、主题、考试、上传 | 高 | 逐行为差异清单、权限与答案格式对账 |
| 矩阵、子表单、预约、计价、专用数据源 | 高且不确定 | 有代表性的现存问卷与可复现答卷样本，不能只看演示页 |

当前无法负责任地承诺完整设计器只需若干天：实现源码、实际 schema 类型分布和复杂功能用量尚不完整。先以小样本证明适配可行，再估工期，可避免把 Vue 2 外壳升级误当作全部问卷能力迁移。

其他已知问题：上游 type 创建/读取不一致已记录，需在提供问卷写操作前专项回归；开发后端启动时出现存储初始化错误（缺少 request 上下文），当前只读业务正常，但上传未验证；本阶段依赖构建仍有约 1 MB 的 Element Plus 主包体积提示，不影响构建成功，后续可按组件导入优化。
