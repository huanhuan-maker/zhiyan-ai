# M5-K 系统配置页深色收口（AI 配置白块修复）

- 日期：2026-10-28
- 触发：用户截图 `/manage/system` 的「AI 配置」标签页，供应商卡片与模型卡片仍是白底
- 结论：系统配置页 6 个标签页全部深色，浅色残留 0、低对比 0；新增标签页级回归脚本防止再退化

## 1. 根因

| 位置 | 问题 |
| --- | --- |
| `subconfig/DeepSeekConfig.vue` | 样式写死浅色：`.provider-card{background:#fff}`、`.model-card{background:#f7f9fc}`、`.save-bar{background:white}`、`input[type=number]{background:white;color:inherit}`、文字 `#243449/#66758b`、危险按钮浅红底 |
| `subconfig/OssConfig.vue` | 提示条 `#fffaf0` 底 + `#dd6b20` 链接（深色下对比 4.11，不达标） |
| `subconfig/SystemInfoConfig.vue` | `V6.0` 标签 `#eff6ff` 浅蓝底、输入文字 `#334155` 在深色输入框里不可读 |
| `manage/system/index.vue` | 卡片 `#ffffff`、页签与表单提示/边框均为浅色十六进制 |
| `assets/styles/element-custom.scss` | `.el-switch__label` 用 SCSS 变量写死 `$text-regular/#3b3f46`，「启用真实 AI」在深色下几乎不可见 |
| `components/tinymce/index.vue` | 深色编辑器占位符仍是深灰，等于看不见 |

旧回归 `workbench-visual.mjs` 只打开 `/manage/system` 默认标签页，异步配置内容与其余标签页未被审计，因此漏掉了这次的白块。

## 2. 修复

- 四个系统配置文件内的浅色字面量全部换成 `--zy-*` 设计令牌（卡片/边框/文字/输入/页签/提示/危险按钮）
- `OssConfig` 提示条改为深色 amber（半透明底 + 半透明描边），链接改 `#f0cd85`
- `SystemInfoConfig` 版本标签改 `var(--zy-tint)` 底 + `var(--zy-primary)` 字
- `workbench-premium.scss` 新增第 29 节：`.zy-dark.zy-dark .el-switch__label` 及 `.is-active` 覆盖 element-custom 的写死颜色
- TinyMCE 深色 `content_style` 增加占位符颜色 `#8496ab`

## 3. 新增回归

`scripts/tduck/system-dark-tabs.mjs`：逐个点击 6 个标签页，等待异步内容后审计
1. `zy-dark` 生效
2. 没有浅色残留块（亮度 > 0.72 且 ≥40×24）
3. 正文文字对比度 ≥ 4.5
4. 输入框文字与背景对比度 ≥ 4.5

结果写入 `evidence/tduck-full/system-dark-tabs/results.json`，截图 `system.png / file.png / email.png / sms.png / wxmp.png / ai.png`。

## 4. 验证

| 命令 | 结果 |
| --- | --- |
| `node scripts/tduck/system-dark-tabs.mjs` | 19/19 通过（6 标签页 × 3 项 + 无运行时报错） |
| `node scripts/tduck/workbench-visual.mjs` | 92/92 通过 |
| `cd tduck-vue3; npm.cmd test` | 59/59 通过 |
| `cd tduck-vue3; npm.cmd run build` | 成功（仅既有 chunk 体积告警） |

## 5. 已知限制

- `workbench-visual.mjs` 仍只覆盖系统配置默认标签页；标签页级覆盖由 `system-dark-tabs.mjs` 承担，两者需一起跑
- TinyMCE 工具栏的深色来自 `oxide-dark` skin，占位符颜色是在 iframe 内容样式里补的；若升级 TinyMCE 需复验
