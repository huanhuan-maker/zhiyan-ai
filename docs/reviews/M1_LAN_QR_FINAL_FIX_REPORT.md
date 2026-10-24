# M1 最终交付报告:局域网二维码分享 + Token 轮换后会话恢复 + 轮换重放防护(GLM-5.3)

日期:2026-10-24(Asia/Shanghai)。分支:**`fix/m1-lan-qr-sharing`**(独立本地分支,未 push,未合并 master)。本报告为该轮的**正式最终交付版本**,全部数据来自本轮(14:11–14:13)实际复跑,不引用 ae122a9/V4 阶段旧报告口径。

- 功能提交:**`efd7b17`**(19 文件,+1982/−51)
- 证据与本报告提交:见文末 Git 记录
- 基线确认:`git merge-base --is-ancestor 533e0df HEAD` 通过——**本分支完整包含 Codex master 提交 `533e0df` 的全部修复**,包括 `V5__backfill_historical_version_closures.sql` 迁移与 Token 轮换前置条件(`RotateToken.expectedShareRevision`,64 位十六进制校验,不匹配返回 409 `STALE_SHARE_LINK`),均已逐文件核实存在。

## 1. 实际修改的源码(本轮全部变更)

后端(3 个源码文件 + 1 个测试):

| 文件 | 变更与原因 |
|---|---|
| `controller/SystemController.java` | 新增。`GET /api/system/lan-addresses`:枚举本机非环回/非链路本地 IPv4,供发起者配置局域网分享地址;登录态只读 |
| `service/ResponseService.java` | `restore()` 响应新增 `collecting` 字段(调查 OPEN 且版本 OPEN),供恢复页只读门控;只读计算,无写路径 |
| `service/SurveyService.java` | 新增只读辅助 `surveyRow(id)`;其余为基线已有代码(V4/V5/CAS 均来自 533e0df 及更早,本轮未改) |
| `test/.../M1PublicationLifecycleTest.java` | +3 用例(轮换后恢复提交一次/关闭只读/LAN 地址权限),现有用例全部保留 |

前端(9 个源码文件 + 基建 + 2 个测试):

| 文件 | 变更与原因 |
|---|---|
| `api/sharing.ts` | 新增。LAN origin 规范化/校验(拒绝 localhost、127.0.0.1、0.0.0.0、::1)/localStorage 持久化/`buildLanShareUrl`(仅接受 `/public/` 路径) |
| `components/ShareQrCard.vue` | 新增。本地 `qrcode` 库 canvas 二维码;复制/下载 PNG/打开答题页;轮换 watch 自动重绘;停收警示;本机预览链接独立标注 |
| `components/LanOriginPanel.vue` | 新增。地址配置面板:手输/点选后端检测的 IPv4/错误提示/清除 |
| `pages/SurveyEditorPage.vue` | 分享面板接入两个组件;发布/轮换把 `publicPath` 写入浏览器留存;旧留存数据自动回退纯链接行 |
| `pages/PublicPage.vue` | **任务 B 核心**:`load()` 重构——公开 token 请求失败(轮换 404/关闭 410)不再阻断会话恢复;`collecting=false` 时恢复页只读并禁用保存/提交按钮;错误文案区分"链接失效"与"会话恢复失败" |
| `api/surveys.ts` | `ShareLink.publicPath`、`Session.collecting`、`Version.shareRevision`(基线已有)类型 |
| `style.css` | 面板/二维码卡样式与 ≤560px 手机适配 |
| `package.json`/`package-lock.json` | 依赖:`qrcode@^1.5.4`;devDeps `vitest@^5.0.5`、`jsdom`、`@vue/test-utils`、`@types/qrcode`;脚本 `dev:lan`、`test:unit` |
| `vitest.config.ts`、`api/sharing.spec.ts`、`components/ShareQrCard.spec.ts` | 新增前端单测基建与 14 个用例 |

文档:`docs/LAN_SHARING_GUIDE.md`(新增,Windows 局域网/热点/防火墙全命令指南)、`docs/M1_API.md`(lan-addresses、restore.collecting、轮换 CAS 语义)、`README.md`(dev:lan、二维码、测试计数)。

## 2. 数据库迁移变更

**本轮零迁移。** 当前迁移链为 V1–V5,其中 V4(`survey_versions.status`)与 V5(历史版本关闭回填)为基线 `533e0df` 已含内容,本轮未新增、未修改任何迁移文件;测试与开发库启动时 Flyway V1–V5 全部 success。

## 3. 最终测试总数与实际执行结果(2026-10-24 14:11–14:13 复跑)

原始摘要已存 `evidence/m1-lan-qr-final-verification.txt`(随 ZIP 交付);完整日志在 `.local/final-backend-test.log`、`.local/final-frontend-unit.log`、`.local/final-frontend-build.log`(本机,不入库)。

| 验证 | 命令 | 结果 |
|---|---|---|
| 后端全量(真实 MySQL `zhiyan_ai_test`,JDK17,Git Bash 加载 .env) | `./mvnw.cmd clean test` | **42/42 通过,0 失败/错误/跳过,BUILD SUCCESS**(M0 9、M1 集成 16、生命周期+会话恢复 11、迁移 1、并发 4、限流 1) |
| Token 轮换后会话恢复(专项) | 含于上 | `restoreSurvivesTokenRotationAndStillCompletesExactlyOnce`:轮换→旧 token 404/不可新开会话→旧会话恢复(collecting=true,答案完整)→保存→提交→幂等重放→completedCount=1。`restoreAfterCloseIsReadOnly...`:关闭后恢复只读、保存/提交 410、统计 0、关闭后新发布不复活旧会话 |
| 轮换重放防护(CAS,基线用例) | 含于上 | `rotationRetryAfterLostResponseDoesNotInvalidateCommittedLink`:响应丢失后重试 409,不再轮换、审计仅 1 条、已提交链接存活;重读+确认后可再轮换一次 |
| 二维码 URL 编码(专项) | `npm.cmd run test:unit`(vitest/jsdom) | **14/14 通过**:`ShareQrCard` 断言 `QRCode.toCanvas` 收到的编码串 === 页面显示的局域网 URL(host+port+`/public/`+token);轮换后二维码以新 token 重绘;未配置不渲染 canvas 且按钮禁用 |
| LAN 链接构造/无效地址(专项) | 含于上 | `sharing.spec.ts`:192.168.137.1→`http://192.168.137.1:5173`;localhost/127.0.0.1/0.0.0.0/::1/ftp/乱串全部拒绝并给理由;`/public/` 之外的路径拒绝;HTTPS 域名兼容 |
| 前端构建 | `npm.cmd run build`(vue-tsc + vite) | 成功 |
| 开发库链路(上轮实测,环境未变) | curl | `http://172.29.192.1:5173`(局域网 IP)→页面 200;`/actuator/health` UP;`/api/auth/csrf` 经 LAN IP 的 Vite 代理正常 |

测试计数演变:39(基线 533e0df)→ **42 后端 + 14 前端 = 56**,只增未删,无跳过。

## 4. 专项检查结果

### 4.1 局域网分享页过期链接展示风险

- **同一浏览器**:轮换/发布后 `shares` 状态与 localStorage 即时更新,二维码自动重绘(单测+浏览器实测覆盖)——无过期展示。
- **跨浏览器/设备(已知限制,如实报告)**:发起者在浏览器 A 轮换后,浏览器 B localStorage 里留存的旧链接及二维码会继续展示,但手机扫码会得到 404"资源不存在或无权访问"页面(不会产生错误数据,只会引导联系发起者索取新链接)。客户端无法自行验证 token 是否仍有效(服务端只存 SHA-256 哈希,`shareRevision` 是哈希的哈希,不回传 token 本身)。**缓解**:①发布记录文本已提示"服务器只保存链接摘要,不能再次读取原链接,但可安全轮换生成新链接";②版本收集状态徽标实时反映停收;③文档(LAN_SHARING_GUIDE 第 3.5 节、M1_API)已写明"地址只保存在当前浏览器"。若需跨浏览器强制失效提示,需新增"发起者上传自家留存 token 哈希供校验"类接口,属新需求,本轮按约定未扩大范围。
- 展示的"本机预览"链接(127.0.0.1)与手机链接字段分离,并标注"仅此电脑可打开",不会误导扫码。

### 4.2 明文 Token 日志输出

逐项审计,结论:**无**。

- 前端源码(非测试文件)`grep -rn "console\."` **零命中**;错误提示均为固定文案,不拼接 token。
- 后端源码无 `System.out`/logger 调用;异常处理器只返回固定 code/message。
- 审计事件仅存 `actor/survey/action("ROTATE_TOKEN")/时间`,不存 token 或哈希(后端测试断言 `events.action doesNotContain(token)`)。
- 轮换成功响应带 `Cache-Control: no-store`,新 token 只出现在 HTTP 响应体和页面输入框;浏览器地址栏出现 token 属链接本身的既定形态,非日志。

## 5. 真实手机验证状态

**真实手机未验证。** 本机无手机可控,未执行真机扫码。已完成的替代验证:①局域网 IP 直达 Vite 及其 `/api` 代理全链路 200(上表);②二维码编码内容与显示 URL 一致有组件级单测钉死;③浏览器完整流程(发布→配置→二维码渲染→填写→保存→轮换→恢复→提交→关闭拒绝)实测通过。首次真机验收请严格按 `docs/LAN_SHARING_GUIDE.md` 第 1–6 节执行(dev:lan → 查 IP → 配置 → 组网 → 防火墙专用网络放行 5173 → 扫码→保存→刷新恢复→提交→电脑端统计 +1),并在 `evidence/` 补充截图。

## 6. 未验证项与剩余风险汇总

1. 真实手机扫码(上述)。
2. 跨浏览器留存链接的过期展示(已知限制,见 4.1,无数据风险)。
3. Windows 防火墙命令未在本机实际执行(本机网络已通;命令照抄微软官方参数写入指南)。
4. 三种热点场景互通性受路由器 AP 隔离策略影响,无法穷尽;指南给了排查路径。
5. `dev:lan` 暴露开发服务器:无 HTTPS/访问控制,仅限可信网络;局域网内 HTTP 明文;M1 问卷不含实名信息。
6. IAB 无 console 读取能力,浏览器"零报错"以页面状态替代,留人工 F12 复核。

## 7. Git 提交(独立本地分支,未 push)

```
48a84ec docs: add M1 LAN QR final fix report (feat efd7b17)
efd7b17 feat: LAN QR sharing, post-rotation session restore, rotation retry semantics
533e0df merge: reviewed M1 publication lifecycle fixes and retry guards   ← 基线(含 V5/CAS)
```

本轮复核后追加:证据文件 + 本报告更新(见 git log 最新提交)。

## 8. 交付 ZIP 与后续

- ZIP:`zhiyan-ai-m1-lan-qr-2026-10-24.zip`(git archive,仅 git 跟踪文件,含本报告与 `evidence/m1-lan-qr-final-verification.txt`;排除 .env/.local/target/node_modules/.git)。
- **Codex 集成注意**:①合并 `fix/m1-lan-qr-sharing` 即可,无迁移;②前端新依赖,集成后 `npm.cmd ci`;③新增前端测试命令 `npm.cmd run test:unit`(14 项)可纳入验收脚本;④真机验收按 LAN_SHARING_GUIDE 执行后回填 evidence。
- **当前停止于 M1 最终交付节点:未进入 M2,未 push,未合并 master,未部署服务器。**
