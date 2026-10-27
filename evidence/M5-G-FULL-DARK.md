# M5-G｜全站深色（含系统配置与公开填写页）（2026-10-27）

需求：全部页面深色，包括系统配置页；不留浅色块。

## 一、本轮补齐的部分

1. **系统配置页富文本编辑器（TinyMCE）**：改用自带深色皮肤 `skin: 'oxide-dark'` + `skins/content/dark/content.min.css`，并用 `content_style` 给 iframe 内容区兜底深色底与文字色；工具栏、下拉、内容区全部深色。
2. **公开填写页 `/s/:key`、`/project/write`**：原先按"受访者端保持浅色"的决策保留白色，本轮改为深色。问卷渲染组件 `biz-form-wrapper`（带内联背景样式）用 `!important` 压成深色；题干、描述、单选/多选标签、输入框、星级评分按其实际结构逐个覆盖；Element Plus 深色变量容器从 `.project-form-preview` 扩展到 `.write-container`。
3. **公开结果页 `/project/public/result`**：`el-container/el-main/el-page-header` 深色。
4. **登录 / 找回密码 / 账号校验 / 404 / 会员中心**：页面底色、卡片、标题与说明文字、页签选中态、链接与按钮全部改为深色令牌；404 的大号数字改为低饱和青色光晕。
5. **收尾**：TinyMCE iframe 元素自身白底、会员页 `h4`、登录页 `.link-item`、校验页返回按钮、公开页提示文案等低对比项逐条修正。

## 二、全站路由审计（1600×900，真实浏览器）

| 路由 | 修复前 白块/低对比 | 修复后 |
| --- | --- | --- |
| /login | 0 / 7 | **0 / 0** |
| /forget/password | 0 / 3 | **0 / 0** |
| /account/validate | 0 / 1 | **0 / 0** |
| /home | 0 / 0 | 0 / 0 |
| /home/member | 1 / 18 | **0 / 0** |
| /home/assistant | 0 / 0 | 0 / 0 |
| /manage/user | 0 / 0 | 0 / 0 |
| /manage/system（TinyMCE） | 1 / 0 | **0 / 0** |
| /project/my | 0 / 0 | 0 / 0 |
| /project/form/{editor,ai-draft,logic,theme,setting,publish,data,statistics,preview} | 0 / 0 | 0 / 0 |
| 404 | 0 / 5 | **0 / 0** |
| /s/{key}（问卷已停止） | 1 / 1 | 0 / 0（二维码画布除外） |
| /s/{key}（问卷收集中，渲染真实题目） | 2 / 11 | **0 / 0**（二维码画布除外） |
| /project/write | 1 / 1 | 0 / 0（二维码画布除外） |
| /project/public/result | 1 / 0 | **0 / 0** |

**唯一保留的白色**：公开填写页右上角二维码画布（98×98）。二维码需要浅底才能被扫码枪/相机识别，属于功能性元素，不是界面色块；已在深色卡片内做了边框包裹。

## 三、验证（实际执行）

| 项 | 成功 | 失败 |
| --- | ---: | ---: |
| `workbench-visual.mjs`（23 条路由 × 4 项：深色生效/无报错/无浅色块/对比度≥4.5） | 92 | 0 |
| `chart-theme.mjs`（统计图表深色） | 5 | 0 |
| 前端 Vitest | 59 | 0 |
| `vue-tsc --noEmit` + `vite build` | 通过（13.82s，dist 21:11:27） | — |

## 四、截图

- [系统配置（TinyMCE 已深色）](tduck-full/workbench-visual/dark-manage-system.png)
- [公开填写页（真实题目、深色）](tduck-full/workbench-visual/dark-public-fill.png)
- [登录页](tduck-full/workbench-visual/dark-login.png)
- [会员中心](tduck-full/workbench-visual/dark-member.png)
- [404](tduck-full/workbench-visual/dark-notfound.png)
- [公开结果页](tduck-full/workbench-visual/dark-public-result.png)

其余工作台/编辑器/管理页截图同目录（`dark-*.png`）。

## 五、复现

```powershell
node scripts\tduck\workbench-visual.mjs   # 23 条路由全站深色回归
node scripts\tduck\chart-theme.mjs
Set-Location .\tduck-vue3; npm.cmd test; npm.cmd run build
```

回归用管理员账号（`.local/tduck-credentials.json`）登录态 + 匿名访问公开页；公开填写页用收集中问卷 `dUJev0eA`（可用 `PUBLIC_FORM_KEY` 环境变量替换）。

## 六、已知边界

- 二维码画布保持白底（功能性，见上）。
- 登录页左侧的产品插画、问卷头图等**图片资源**本身是亮色（图片内容，不是界面色块），未做反色处理。
- `scripts/tduck/workbench-dark-mode.mjs` 仍是旧"浅/深切换"断言，已不适用（新回归为 `workbench-visual.mjs`）。
