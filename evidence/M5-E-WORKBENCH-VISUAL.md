# M5-E｜工作台视觉修复与浅色主题升级（2026-10-27）

用户截图反馈：用户管理等页面在深色下出现"部分模糊、部分变白"——表格整块白底、单元格深底深字、标签和操作按钮是浅色块；浅色主题整体发灰发平。要求参考 `D:\Project\vue\guangxi-tourism-screen` 的质感改观感。经确认采用"先修深色残留 + 浅色按参考质感升级"。

## 一、问题定位（真实浏览器审计）

用管理员账号在 5180/8997 上逐页审计（亮度 > 0.72 的大块 + 文字对比度 < 4.5 的节点）：

| 页面 | 修复前浅色残留块 | 修复前低对比文字 |
| --- | ---: | ---: |
| 工作台 /home（深色） | 0 | 0 |
| 用户管理 /manage/user（深色） | 8（表头 8 个 `th` 白底 `#fafbfc`） | 45（表格单元格 `#334155` 在深底上，对比度 1.55） |
| 系统配置 /manage/system（深色） | 2（富文本编辑器白底） | 6 |
| 问卷助手 /home/assistant（深色） | 1（提问气泡浅底 + 浅色文字，对比度 1.01） | 12 |
| 工作台 /home（浅色） | —（浅色主题本就是白底） | 21 |
| 用户管理（浅色） | — | 30（分页、标签、提示文字偏淡） |

根因：Element Plus 的表格/标签/分页在深色下仍走浅色默认值，而 `.zy-dark` 里缺对应覆盖；组件 scoped 样式与全局深色规则特异性相同又后注入，导致原有的 `.zy-dark .xxx` 规则被压掉。

## 二、改动

1. **`workbench.scss`（令牌）**：新增两组语义令牌（浅色 `:root` / 深色 `.zy-dark`）——分层阴影 `--zy-shadow-card`、悬浮阴影、光环 `--zy-ring`、画布渐变 `--zy-page-glow`、网格线 `--zy-grid-line`、侧栏/顶栏渐变、强调色 `--zy-accent-cyan`、选中底色 `--zy-tint`。**原有的深色底值全部保持不变**（`#0c1829/#142235/#17313a/#111e30`），避免改坏既有断言。
2. **新增 `workbench-premium.scss`**（在 `index.scss` 最后引入）：参考大屏的分层手法翻成浅色为主的版本——
   - 画布：径向光晕 + 渐变底 + 极淡 52px 网格（`mask-image` 只在上半可见）；
   - 侧栏：渐变白底 + 右侧描边，菜单项 hover/选中带浅蓝渐变、左侧 3px 发光线与柔和光环；
   - 顶栏：白到极浅蓝渐变 + 底部渐变发丝线；
   - 页标题：左侧 4px 渐变强调竖条（对应参考项目的 panel 标题条）；
   - 卡片：白底 + 1px 描边 + 双层柔和阴影 + 悬浮上浮；AI 暂存卡左侧主色竖条与渐变；
   - 表格：表头 `#f3f7fd` 带字距、行内操作按钮幽灵态、分页与标签加深；
   - 按钮：主按钮渐变压光、成功/危险实心加深（保证白字对比度）、幽灵按钮 hover 主色描边；
   - 助手页：提问气泡浅蓝描边、回答气泡白底浮起、输入区卡片化；
   - 深色差异段：表格改为深色表头 + 亮色单元格 + hover 深蓝、标签深底亮字、提问气泡深底亮字、分页容器透明、深色主按钮改实心蓝（`--zy-primary` 在深色下是浅蓝，白字会看不清）。
3. **`scripts/tduck/workbench-visual.mjs`（新增回归）**：真实浏览器逐页断言 24 项——无运行时报错、深色无浅色残留块、正文对比度 ≥ 4.5、深色表头为 `rgb(17, 30, 48)`、深色既有底值未被改坏、浅色画布有渐变与标题强调条。

## 三、实际执行结果

| 执行项 | 成功 | 失败 |
| --- | ---: | ---: |
| `workbench-visual.mjs`（浅/深 × 4 页，24 项断言） | 24 | 0 |
| `chart-theme.mjs`（上一轮图表回归，确认未被改坏） | 7 | 0 |
| 前端 Vitest 全量 | 59 | 0 |

审计复核（修复后）：深色 4 个页面浅色残留块 8/2/1 → **0/0/0**（系统配置页富文本编辑器内部仍为白底，属编辑器自带皮肤，已加边框适配并列为已知边界）；深色用户管理低对比文字 45 → **0**；浅色页面低对比文字 21/30 等 → **0**（仅剩装饰性头像字母 3.77:1，属允许清单）。

## 四、前后对比

| 场景 | 修复前 | 修复后 |
| --- | --- | --- |
| 深色 用户管理 | [before-dark-manage-user.png](tduck-full/workbench-visual/before-dark-manage-user.png) | [dark-manage-user.png](tduck-full/workbench-visual/dark-manage-user.png) |
| 浅色 工作台 | [before-light-home.png](tduck-full/workbench-visual/before-light-home.png) | [light-home.png](tduck-full/workbench-visual/light-home.png) |
| 深色 工作台 | [before-dark-home.png](tduck-full/workbench-visual/before-dark-home.png) | [dark-home.png](tduck-full/workbench-visual/dark-home.png) |
| 浅色 用户管理 | [before-light-manage-user.png](tduck-full/workbench-visual/before-light-manage-user.png) | [light-manage-user.png](tduck-full/workbench-visual/light-manage-user.png) |
| 深色 助手 | [before-dark-assistant.png](tduck-full/workbench-visual/before-dark-assistant.png) | [dark-assistant.png](tduck-full/workbench-visual/dark-assistant.png) |

"修复前"截图是同一脚本在移除本次样式文件后拍摄，不是旧图复用。

## 五、复现与验证命令

```powershell
# 前提：MySQL80 Running、8997 后端、5180 前端
Get-Service MySQL80
.\scripts\tduck\Start-FullBackend.ps1 -Background
Set-Location .\tduck-vue3; npm.cmd run dev
# 回到项目根目录
node scripts\tduck\workbench-visual.mjs
node scripts\tduck\chart-theme.mjs
Set-Location .\tduck-vue3; npm.cmd test
```

回归读取私有凭据 `.local/tduck-credentials.json`（管理员账号），只做只读浏览，不新增/修改业务数据。

## 六、已知边界

- 系统配置页的富文本编辑器（TinyMCE）内容区仍是白底：编辑器皮肤在 iframe 内，改它需要动组件配置，本轮只加了边框与圆角适配。
- 头像字母"admin"是白字深绿底，对比度 3.77:1，属装饰性元素，未改。
- 本轮只覆盖工作台外壳、我的问卷、用户管理、系统配置、问卷助手；编辑器/AI 建卷/统计页内部样式未重做（统计页图表与深色容器已在 M5-D 处理）。
- 深色既有底值全部保留，因此深色主题是"修残留 + 加质感"，不是换配色。
