# M5-N AI 配置收口：系统默认模型切成指定网关，并只保留系统配置入口

- 日期：2026-10-28
- 要求：把这个网关设为默认；AI 配置不再作为单独标签页，只把系统配置里的 AI 配置弄好
- 结论：默认模型已切到 `huanhuan666 网关 / deepseek-v4.1-flash`；侧栏「AI 配置」入口、路由与个人页面已删除；系统配置 → AI 配置 成为唯一的模型配置界面

## 1. 现在的模型配置

| 项 | 值 |
| --- | --- |
| 唯一入口 | 系统配置 → AI 配置 |
| 系统默认模型 | `deepseek-v4.1-flash`（供应商 `huanhuan666 网关`，Base URL `https://huanhuan666.cc.cd/v1`，协议 OpenAI Chat Completions，输出参数 `max_tokens`） |
| 备用供应商 | `本机推理网关`（`http://127.0.0.1:3425/v1`，`group/group`），未设为默认 |
| 启用状态 | 启用真实 AI = 开 |
| 密钥 | 服务端 AES-256-GCM 加密保存，任何读取接口与页面都不回显 |

## 2. 界面回退

- 删除侧栏「AI 配置」菜单项、`/home/ai-settings` 路由与个人配置页面
- `DeepSeekConfig.vue` 回到单一模式：标题固定「系统默认模型」，去掉个人/继承相关提示与 scope 参数
- `api/ai-settings.js` 默认走系统配置接口
- 访问旧地址 `/home/ai-settings` 现在落到 404 兜底页
- 账号级配置（`fm_ai_settings_user` 与 `/user/ai-settings/mine`）后端保留但界面不再暴露，且已清空个人配置行，所有账号统一使用系统默认模型

## 3. 验证

| 检查 | 结果 |
| --- | --- |
| `node scripts/tduck/ai-settings-default.mjs`（新增） | 5/5：侧栏无 AI 配置项、旧地址 404、系统配置显示默认模型与指定网关、密钥不回显、页面深色无浅色残留 |
| 真实生成（系统默认模型） | `/user/form/ai/draft` 200，`provider=huanhuan666 网关`，`model=deepseek-v4.1-flash`，3 题，11.3s |
| AI 状态接口 | `{"mode":"REAL","provider":"huanhuan666 网关","model":"deepseek-v4.1-flash","configured":true}` |
| `ai-settings-ui.mjs`（系统配置 AI 页） | 9/9 |
| `system-dark-tabs.mjs` | 19/19 |
| `workbench-visual.mjs` | 92/92 |
| `cd tduck-vue3; npm.cmd test` | 63/63 |
| `npm.cmd run build` | 成功 |

过程说明：验证过程中该第三方网关出现过一段约 40 分钟不可达（连接超时，AI 建卷一次 500），恢复后直连 1.2s、系统默认模型生成成功。这说明故障来自上游可达性，不是应用配置；若再次长时间不可达，可在同一页把「本机推理网关」的 `group/group` 点「设为默认模型」临时切回。

## 4. 截图

- `evidence/tduck-full/ai-settings-default/01-system-ai-default.png`：系统配置 → AI 配置，侧栏已无独立入口
- `evidence/tduck-full/ai-settings-default/02-default-provider.png`：`huanhuan666 网关 / deepseek-v4.1-flash` 标记为默认模型
- `evidence/tduck-full/ai-settings-default/results.json`：逐项检查结果

## 5. 已知限制

- 该第三方网关的可用性不受本项目控制；建议保留 `本机推理网关` 作为随时可切回的默认模型
- 个人模型配置后端仍在（表与接口未删），只是界面不再提供；如需恢复多账号各自配置，可重新接回页面
