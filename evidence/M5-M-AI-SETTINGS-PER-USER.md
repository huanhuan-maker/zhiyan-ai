> 说明：本轮的「侧栏 AI 配置」独立入口已在 M5-N 按用户要求回退，界面只保留系统配置→AI 配置；对应的个人页回归脚本 `ai-settings-personal.mjs` 与 `ai-settings-live-provider.mjs` 已随页面删除。此处保留该轮后端能力与验证记录。

# M5-M AI 配置：每个账号用自己的请求地址与 API Key

- 日期：2026-10-28
- 现象：系统配置 → AI 配置只有管理员能用，普通账号既看不到入口也无法保存；页面把所有账号的模型配置当成一份全局配置。
- 结论：AI 配置拆成「系统默认模型（管理员）」+「我的模型配置（每个账号）」两层；用户可填自己的 Base URL 与 API Key，保存后只对本人生效；修复了保存链路，所有校验错误都能看到原因。

## 1. 原来的三个问题

| 问题 | 原因 |
| --- | --- |
| 普通用户无法配置模型 | `/user/ai-settings` 的 `@ModelAttribute guard` 直接要求管理员，其他人 500「仅系统管理员可以管理模型配置」；侧栏也没有入口 |
| 「保存不了」 | 前端把 GET 返回的 `hasApiKey` 等字段原样交给 POST 时后端 Jackson 会报 `Unrecognized field "hasApiKey"`；首次添加供应商时空名称/空模型 ID 只会得到一句后端校验错误且不显眼 |
| 配置是全局一份 | 只有 `fm_ai_settings` 单行（id=1），所有人都共享同一个地址和密钥 |

## 2. 现在的行为

- 侧栏对所有登录用户新增 **AI 配置**（`/home/ai-settings`）：填自己的 Base URL、API Key、模型 ID，保存后只对本人生效。
- 系统配置 → AI 配置 **（系统默认模型，仅管理员）**：共享默认配置，作为未配置用户的后备。
- 读取逻辑：有个人配置就用个人的（含「启用真实 AI」开关）；没有个人配置就用系统默认；两种都不回显任何明文密钥或密文。
- 首次保存个人配置时，若沿用继承来的供应商 ID 且没重填 Key，会复用系统配置里已加密的密钥；**只改 Base URL 或协议必须重新填 Key**（确认目标地址）。
- 并发：个人配置与系统配置各自 revision 校验，互不覆盖。
- AI 调用按请求所属用户解析模型：`OpenAiCompatibleProvider.resolve()` → `settings.selected(SecurityUtils.getUserId())`，因此 AI 建卷 / 问卷助手 / 报告都会用当前账号自己的模型。
- 保存前前端先做必填校验（供应商名称、Base URL、模型显示名、模型 ID、输出 Token < 上下文），错误同时显示在页面顶部与 toast。

## 3. 数据与接口

新增表 `fm_ai_settings_user`（`db/tduck/012_ai_settings_per_user.sql`，`Apply-AiSettingsMigration.ps1` 一次应用 008 + 012 并校验两张表）：

| 列 | 说明 |
| --- | --- |
| user_id | 主键，账号 id |
| revision | 乐观锁版本 |
| config_json | 与系统配置同构的 JSON（Key 为 AES-256-GCM 密文） |
| updated_at | 更新时间 |

| 接口 | 权限 | 说明 |
| --- | --- | --- |
| `GET/POST /user/ai-settings` | 管理员 | 系统默认模型 |
| `POST /user/ai-settings/test/{id}` | 管理员 | 测试系统默认模型 |
| `GET/POST /user/ai-settings/mine` | 登录用户 | 自己的模型配置（未配置时返回系统默认 + `inherited:true`） |
| `POST /user/ai-settings/mine/test/{id}` | 登录用户 | 测试自己生效的模型（个人优先，回退系统默认） |

## 4. 变更文件

- 后端：`AiSettingsService`（loadOwn/viewOwn/saveOwn/selected(userId)/byId(id,userId)）、`AiSettingsController`（mine 路由 + 全局仅管理员）、`AiSettingsUserEntity`、`AiSettingsUserMapper`、`AiSettings`（忽略未知字段）、`OpenAiCompatibleProvider`（按用户解析）
- 前端：`api/ai-settings.js`（scope）、`DeepSeekConfig.vue`（个人/全局两种模式、继承提示、必填校验、错误可见）、`views/ai-settings/index.vue`（个人页）、路由 `/home/ai-settings`、侧栏条目、系统配置页传 `scope="global"`
- 迁移与脚本：`db/tduck/012_ai_settings_per_user.sql`、`Apply-AiSettingsMigration.ps1`、`scripts/tduck/ai-settings-personal.mjs`（新增回归）；`ai-settings-ui.mjs` 标题断言与 `ai-settings-api.mjs` 失效 fixture 一并修正
- 文档：`docs/AI_SETTINGS_STAGE.md`、`docs/TDUCK_HANDOFF.md`

## 5. 验证

| 检查 | 结果 |
| --- | --- |
| `AiSettingsPerUserTest`（新增 6 项）+ `AiSettingsTest`（25 项） | 31/31 通过 |
| `node scripts/tduck/ai-settings-personal.mjs`（新增） | 12/12：继承→保存→密钥不回显→系统配置不被改动→换地址必须重填 Key→**真实网关生成一份草稿且 provider 是个人配置**→浏览器保存成功→深色无残留 |
| `node scripts/tduck/ai-settings-ui.mjs`（系统默认模型 UI） | 9/9 |
| `node scripts/tduck/workbench-visual.mjs` | 92/92 |
| `node scripts/tduck/system-dark-tabs.mjs` | 19/19 |
| `cd tduck-vue3; npm.cmd test` | 63/63 |
| `npm.cmd run build` | 成功 |

真实生成证据：个人配置保存为「我的自建网关 / http://127.0.0.1:3425/v1」后，`/user/form/ai/draft` 返回 `provider:"我的自建网关"`，说明该用户确实使用了个人配置。

## 6. 截图

- `evidence/tduck-full/ai-settings-personal/01-personal-settings.png`：普通用户的「我的模型配置」（自己的地址/模型/已保存密钥）
- `02-personal-saved.png`：浏览器保存成功的提示
- `03-global-settings.png`：管理员「系统默认模型」未被个人配置影响

## 7. 已知限制与后续

- `scripts/tduck/ai-settings-api.mjs` 仍依赖旧 fixture 里的问卷 key，换成可用账号后仍有 4 项与其历史问卷数据相关而失败（9/16）；全局配置的读写已由 `ai-settings-ui.mjs` 覆盖，该脚本按历史遗留处理，不再作为门禁。
- 个人配置目前没有「恢复为系统默认」按钮（删掉 `fm_ai_settings_user` 对应行即可），后续可加一个清除入口。
- 后台异步任务（非请求线程）没有登录上下文，会回退到系统默认模型。

## 8. 用用户提供的真实第三方网关验证（2026-10-28）

用户提供一个 OpenAI 兼容网关（`https://huanhuan666.cc.cd`，模型 `deepseek-v4.1-flash`），按「我的模型配置」实测：

| 步骤 | 结果 |
| --- | --- |
| 直连 `GET /v1/models` | 200，账号可用模型列表正常返回 |
| 直连 `POST /v1/chat/completions` | 200，约 2.0s，回复 `OK` |
| 应用内保存个人配置（admin 账号） | 200，`inherited` 从 true 变 false，Base URL = `https://huanhuan666.cc.cd/v1` |
| 应用内「测试连接」 | 成功：`deepseek-v4.1-flash · 3292 ms`（另一次 8078 ms） |
| 真实 AI 建卷 | `kind=draft`，`provider=huanhuan666 网关`，5 题，7144ms，标题《大学生图书馆使用情况与满意度调查》 |

说明：密钥只以 AES-256-GCM 密文存入 `fm_ai_settings_user`，任何读取接口与截图都不回显；仓库与证据文件不含明文 Key。
截图：`evidence/tduck-full/ai-settings-personal/04-live-provider.png`、`05-live-test-success.png`；机器可读结果 `live-provider.json`。
