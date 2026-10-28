# M5-L 我的问卷卡片：用「收集份数」替换「类型编号」

- 日期：2026-10-28
- 需求：卡片上的「类型编号」没有信息量，改成能看到实际收集了多少份
- 结论：卡片三项信息变为「状态 / 收集份数 / 更新时间」，份数由新增的批量接口一次取回，数字与数据页总答卷数一致

## 1. 为什么要加后端接口

`/user/form/page` 只返回 `fm_user_form` 的字段，没有答卷数。逐卡片调用 `/user/form/report/stats` 会变成「每页 12 次请求 × 每次 3 个查询」。
新增批量接口后，整页只多 1 次请求、1 条分组统计 SQL。

- 新增：`GET /user/form/answer-counts?keys=k1,k2,...`
- 返回：`{ "k1": 5, "k2": 0 }`，只包含当前用户自己的问卷
- 限制：一次最多 100 个 key；未登录返回 401；不属于自己的 key 直接忽略（不泄露存在性）
- 统计口径：`fm_user_form_data` 里该问卷的答卷总数（与「数据」页的总数一致；问卷删除走软删除，答卷删除是物理删除）
- 后端来源：`backend-extensions/form-counts`（新扩展目录，构建脚本 `Build-FullBackend.ps1` 的扩展列表加入 `form-counts`）

## 2. 前端改动

| 文件 | 改动 |
| --- | --- |
| `views/project/my/card.vue` | 第二项指标改为「收集份数」，显示 `answerCount`；0 份用次级色，有答卷用强调色；卡片加 `data-form-key` 便于回归定位 |
| `views/project/my/index.vue` | 列表加载后批量取份数并与当前页合并；失败只降级为占位符，不影响列表 |
| `utils/answerCounts.js` | 纯函数：按 formKey 合并、未知值返回 null（不编造 0）、容错非数字响应 |
| `api/project/form.js` | 新增 `listFormAnswerCountRequest` |

## 3. 验证

| 命令 | 结果 |
| --- | --- |
| `mvn -Dtest=FormAnswerCountControllerTest test`（form-counts-build） | 4/4 通过：只返回本人问卷、缺失即 0 份、空 key 不查库、超 100 个 key 拒绝 |
| `cd tduck-vue3; npm.cmd test` | 63/63 通过（新增 4 个 answer-counts 单元测试） |
| `node scripts/tduck/form-card-counts.mjs` | 8/8 通过：卡片无「类型编号」、逐卡数字与接口一致、有答卷显示真实份数、0 份次级色、未登录拒绝、他人 key 不返回、移动端不溢出 |
| `node scripts/tduck/workbench-visual.mjs` | 92/92 通过 |
| `cd tduck-vue3; npm.cmd run build` | 成功 |
| 真实接口交叉核对 | `k78wY4hN` 卡片 1 = 数据页 1；`RCFB5MH9` 卡片 2 = 数据页 2 |

## 4. 截图

- `evidence/tduck-full/form-card-counts/01-desktop.png`：卡片显示「收集 1 / 收集份数」，草稿显示 0（次级色）
- `evidence/tduck-full/form-card-counts/02-mobile.png`：390px 单列仍显示三项信息
- `results.json`：逐项结果与接口返回

## 5. 已知限制

- 份数是该问卷**全部版本**的答卷总数（数据页同口径）；按版本拆分的数字在统计分析页
- 列表页只在翻页/筛选时重新拉取份数，新答卷需要刷新页面才更新
- 「AI 暂存」卡片不属于问卷，不显示份数
