# M5-B界面复验：移除按钮配色（2026-10-25）

按用户截图反馈，将AI配置中“移除供应商”“移除模型”改为浅红底`#fff1f0`、深红字`#b42318`及浅红边框；悬停/键盘焦点加深文字并显示焦点框。修改仅在本页作用域。

修改文件：`tduck-vue3/src/td/views/manage/system/subconfig/DeepSeekConfig.vue`；`scripts/tduck/check-ai-button-colors.mjs`；本记录及`evidence/tduck-full/ai-settings-button-fix/`四份前后证据。无SQL迁移，无后端变更或重启。

先跑浏览器回归：正常/悬停两状态、两个按钮共4项，旧实现0成功/4失败；正常文字对比1.22，悬停2.70。改后4成功/0失败，对比度分别5.98和7.04，且背景亮度符合浅色要求。截图已实际采集并查看：[修改前](tduck-full/ai-settings-button-fix/before.png)、[修改后](tduck-full/ai-settings-button-fix/after.png)，数值在同目录`before.json`、`after.json`。没有点击删除按钮或修改模型数据。

PowerShell从根目录执行`node scripts/tduck/check-ai-button-colors.mjs`验证（需本机已有忽略管理员会话及5180/8997服务）；进入`tduck-vue3`执行`npm.cmd run build`，构建成功，保留原包体积/Sass警告。前端日常启动仍为该目录`npm.cmd run dev`，已经运行时刷新系统配置→AI配置即可。

基线`9bf44a4`；本轮提交可用`git log -1 --format="%h %s" -- evidence/M5-B-BUTTONS.md`查询。其他既有未提交文件保持原状。此轮仅验证按钮样式，不重复宣称完整业务测试；交付后等待用户视觉复验。
