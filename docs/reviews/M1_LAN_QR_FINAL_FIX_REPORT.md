# M1 局域网二维码分享 + 遗留缺陷修复报告(GLM-5.3)

日期:2026-10-24(Asia/Shanghai)。分支:`fix/m1-lan-qr-sharing`(基于 master `533e0df`)。**功能提交:`efd7b17`**(本报告为随后 docs 提交)。不进入 M2,未部署任何服务器,未修改数据库结构。

## 1. 任务与结果总览

| 任务 | 结果 |
|---|---|
| A1 局域网访问 | `npm.cmd run dev:lan` 监听 0.0.0.0:5173;后端 8080/MySQL 3306 仍仅本机;原 `dev` 不变。已实机验证绑定与 LAN IP 访问 |
| A2 正确局域网链接 | 发起者配置一次电脑 IPv4(localStorage),拒绝 localhost/127.0.0.1/0.0.0.0/::1;未配置不生成二维码;URL 恒为 `http://<IPv4>:5173/public/<token>`;HTTPS 域名预留 |
| A3 真实二维码 | 本地 `qrcode` 库 canvas 渲染;编码内容与显示 URL 逐字符一致(单测断言);复制/下载 PNG/打开答题页;轮换自动重绘;停收版本显示警示;手机布局适配;重开管理页从浏览器留存重建二维码;无 token 日志输出 |
| A4 Windows 说明 | 新增 [docs/LAN_SHARING_GUIDE.md](../LAN_SHARING_GUIDE.md):ipconfig/热点/同 Wi-Fi/防火墙(限定专用网络 5173)/localhost 原理/离网失效/公共 Wi-Fi 风险,全部命令可复制 |
| B 轮换后会话恢复 | PublicPage 重构:公开 token 请求失败不再阻断会话恢复;restore 新增 `collecting` 字段,停收后恢复页只读并禁用保存/提交;后端 410 校验未削弱 |
| C 轮换重复请求 | 采信并**验证**了 master 上 Codex 已实现的 CAS 防护(`shareRevision` 前置条件,重复请求 409 不再轮换);前端失败提示"结果不确定、不自动重试";M1_API.md 语义文档已核对补全 |

## 2. 修改文件与原因

后端(仅 3 处源码 + 1 个测试):

| 文件 | 原因 |
|---|---|
| `controller/SystemController.java`(新) | `GET /api/system/lan-addresses`:返回本机非环回/非链路本地 IPv4,供发起者点选;登录态只读,无敏感信息 |
| `service/ResponseService.java` | `restore()` 增加 `collecting`(调查 OPEN 且版本 OPEN);恢复响应供前端只读门控 |
| `service/SurveyService.java` | 新增只读 `surveyRow(id)` 供 restore 计算 collecting;无行为变化 |
| `test/.../M1PublicationLifecycleTest.java` | +3 用例(见第 3 节) |

前端:

| 文件 | 原因 |
|---|---|
| `api/sharing.ts`(新) | LAN 地址规范化/校验/持久化 + `buildLanShareUrl`;模块级响应式 origin,保存一次全部卡片更新 |
| `components/ShareQrCard.vue`(新) | 二维码 canvas(qrcode 库本地生成)、链接展示、复制/下载 PNG/打开、停收警示、本机预览区分;watch shareUrl 轮换自动重绘 |
| `components/LanOriginPanel.vue`(新) | 配置面板:手输/点选检测到的 IPv4、校验错误提示、清除 |
| `pages/SurveyEditorPage.vue` | 分享面板接入上述组件;发布/轮换把 `publicPath` 存入浏览器留存(旧数据自动回退为纯链接行) |
| `pages/PublicPage.vue` | **任务 B 核心**:`load()` 先试公开 token,无论成败都尝试会话恢复,错误信息区分"链接失效+会话可恢复/不可恢复";restore 后 `collecting=false` → 显示停收说明并禁用保存/提交(双保险,后端 410 仍生效) |
| `api/surveys.ts` | `ShareLink.publicPath`、`Session.collecting` 类型 |
| `style.css` | 面板/卡片/二维码样式与 ≤560px 适配 |
| `package.json` / `package-lock.json` | 新增 `qrcode@^1.5.4`;devDeps `vitest/jsdom/@vue/test-utils/@types/qrcode`;脚本 `dev:lan`、`test:unit` |
| `vitest.config.ts`、两个 `*.spec.ts`(新) | 前端单测基建与用例 |

文档:`docs/LAN_SHARING_GUIDE.md`(新)、`docs/M1_API.md`(lan-addresses、restore.collecting)、`README.md`(dev:lan、二维码说明、测试计数)。

## 3. 实际执行的测试(全部真实运行)

| 命令 | 结果 |
|---|---|
| `cd backend && ./mvnw.cmd clean test`(真实 MySQL `zhiyan_ai_test`,Git Bash + JAVA_HOME=D:\jdk\jdk17,读取 .env) | **42/42 通过,0 失败/错误/跳过,BUILD SUCCESS**(M0 9、M1 集成 16、生命周期+会话恢复 11、迁移 1、并发 4、限流 1)。日志 `.local/m1lan-test.log` |
| `cd frontend && npm.cmd run test:unit`(vitest/jsdom) | **14/14 通过**:URL 组装(host+port+/public/+token)、QR 编码内容===显示 URL、轮换后二维码重绘、未配置不渲染 canvas 且按钮禁用、localhost/127.0.0.1/0.0.0.0/::1/乱串全部拒绝、HTTPS 域名兼容、持久化读写 |
| `cd frontend && npm.cmd run build`(vue-tsc + vite) | 成功(SurveyEditorPage 47.7 kB 含二维码逻辑) |
| 开发库实测(`mvnw package` + jar 启动) | 健康 UP;`/api/system/lan-addresses` 返回 4 个真实 IPv4 |

后端新增 3 个用例(其余 39 个为既有用例全量回归):

1. `restoreSurvivesTokenRotationAndStillCompletesExactlyOnce`:轮换后旧 token 404/不能新开会话;旧会话 restore 200(collecting=true、答案在、响应字段面=白名单);继续保存→提交→幂等重放,completedCount=1。
2. `restoreAfterCloseIsReadOnlyAndCannotBypassSubmissionBlock`:关闭后 restore 只读(collecting=false)、保存/提交 410、统计 0;关闭后再发布 V2,旧会话仍 410 VERSION_CLOSED,V2 正常收集。
3. `lanAddressesRequireLoginAndNeverExposeLoopback`:匿名 401;登录后数组元素均为 IPv4 且绝无 127.*。

任务 D 自动化清单对照:①链接构造=单测;②QR=显示 URL=组件单测;③无效地址=单测;④⑤旧码失效/新码有效=既有 `rotateTokenIssues...` + 浏览器实测;⑥轮换后恢复=后端用例 1+浏览器实测;⑦关闭绕过=用例 2;⑧重复提交不重复计数=既有幂等用例+用例 1;⑨轮换重复=Codex 既有 `rotationRetryAfterLostResponse...`(409 防重放,已核对其存在并随本次 42/42 通过);⑩M0–M1 原有测试全部保留(计数从 39→42,只增未删)。

## 4. 浏览器实测(Windows 本机,内置浏览器自动化,合成账户 lan_qr_gl53)

全部实际操作通过:

1. 注册/登录 → 创建"局域网二维码验证问卷"(调查 7)→ 发布 V1。
2. 未配置 LAN:显示"未配置局域网地址,暂不生成二维码",无 canvas,复制/下载按钮禁用——**不会生成手机打不开的码**。
3. 面板检测并列出 4 个本机 IPv4(10.74.104.31/172.29.192.1/192.168.153.1/192.168.231.1);点选 192.168.153.1 → 二维码真实渲染(截图证据),链接 `http://192.168.153.1:5173/public/TR1g0...`,本机预览链接单独标注。
4. 受访者(新标签):同意→选"好"→保存进度(1/1 入库)。
5. 管理页轮换 → 新链接 `.../public/sBv3SA-...`,二维码/链接即时更新。
6. **受访者刷新旧链接(任务 B 核心):恢复已保存答案("好"仍选中,1/1),可继续提交**——修复前此处为 404 空状态。
7. 提交→成功页;再次刷新仍成功,回收数 1。
8. 新链接可正常打开;关闭调查后:新链接显示"调查已关闭…请索取最新链接",管理页二维码卡显示"版本 1 · 已停止收集…无法再填写或提交";已提交受访者刷新仍为成功页。

## 5. 手机端验收教程与状态

完整图文步骤见 `docs/LAN_SHARING_GUIDE.md`(第 1–6 节):启动 dev:lan → 查/配电脑 IPv4 → 组网(电脑热点推荐/同 Wi-Fi/手机热点三场景与 AP 隔离说明)→ 防火墙仅放行专用网络 TCP 5173 → 扫码填写/保存/刷新恢复/提交 → 电脑端查看统计。

**未实测项(如实声明):**

- **真实手机扫码未执行**(本机无手机可控)。已做的替代验证:①本机经局域网 IP `http://172.29.192.1:5173` 访问 200,`/actuator/health` 与 `/api/auth/csrf` 经 LAN IP 的 Vite 代理正常返回——手机访问的完整网络路径(除手机自身浏览器)已通;②二维码为标准本地生成,内容与链接一致有单测保证。首次真机验收请按指南第 6 节执行。
- Windows 防火墙弹窗/规则命令未在本机执行(当前网络已可直达,未动系统防火墙设置;命令仅写入文档)。
- 三种热点场景的互通性受路由器/运营商策略影响,无法在本机穷尽,指南已给排查路径。
- IAB 无 console 日志读取能力,浏览器"全程零报错"以页面状态替代,留人工 F12 复核(沿用上次验收口径)。

## 6. 剩余风险与说明

- dev:lan 暴露的是开发服务器,无 HTTPS/访问控制,仅限可信网络使用(指南第 9 节红线);局域网内为 HTTP 明文。
- 二维码=参与凭证,同网可扫;误发用轮换立即作废(已有 CAS 防重放)。
- LAN 配置存于发起者浏览器 localStorage,换浏览器需重配(检测按钮一键完成)。
- 轮换语义为"显式非幂等 + CAS 防重放":成功响应丢失后无法取回同一明文链接(数据库只存哈希,这是安全设计),需重新读取发布记录并确认后再轮换一次——已在 M1_API.md 固化。

## 7. Git 与集成

- 分支 `fix/m1-lan-qr-sharing`,功能提交 **`efd7b17`**(19 文件,+1300/−30 左右),基线 master `533e0df`;本报告随后单独提交。未触碰他人未跟踪文件(`docs/M1_WINDOWS_ACCEPTANCE_CHECKLIST.md`、`evidence/m1-merge-*`、两个 zip 均保持原样)。
- **Codex 集成注意**:①`git merge fix/m1-lan-qr-sharing`,无数据库迁移;②前端有新依赖,集成后需 `npm.cmd ci`(lockfile 已提交);③CI/验收脚本若跑前端测试,新增命令 `npm.cmd run test:unit`(14 项);④`dev:lan` 与 `dev` 并存,验收文档引用指南时以 `docs/LAN_SHARING_GUIDE.md` 为准;⑤环境现状:8080 后端为新代码 jar(含 V5 迁移),5173 已切 `dev:lan` 模式运行,浏览器中留有验证标签页(调查 7 已关闭,含 1 份合成答卷,可删)。

**当前停止于 M1 补充修复交付节点,未进入 M2,未执行任何服务器部署。**
