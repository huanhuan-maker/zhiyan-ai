# TDuck Vue 3 第一阶段 API 对照

检查日期：2026-10-24（Asia/Shanghai）。以本地源码和本地部署二进制、真实 HTTP 返回为依据，不根据在线文档猜测接口。

## 来源与版本

后端本地目录 `D:\tduck-survey-form-master` 没有 `.git`，因此无法声称已知其上游 commit。运行横幅和 README 为社区 6.0。部署 JAR SHA-256：`1525BE989421ABD92C6C02C975EBFAC50DC0CAEB032C96C26B8197137B0648BE`。JAR 内实际依赖 Spring Boot 2.7.8、MyBatis-Plus 3.5.3、mysql-connector-j 8.0.32。

UserLoginController、UserFormController、AuthorizationInterceptor、JacksonConfig 四个 class 与本地 `target/classes` 哈希相同；这不等同于重新构建源码验证。原 Vue 2 HEAD 为 `00db10874910b8225498ba7735e86652254cd9eb`，原有 package.json、lockfile、vue.config.js 的未提交改动已连同整个工程备份，未修改它们。

前端请求路径为 `/tduck-api/...`，Vite 将前缀移除后代理到本机 8998，生产部署需单独配置代理。

## 实际使用的接口

| 方法与后端路径 | 参数/数据 | 响应 data | 源码依据 |
|---|---|---|---|
| POST `/login/account` | JSON `{account,password}`；账号为邮箱或手机号 | `{name,token,admin,needChangePassword,...}` | UserLoginController.accountLogin；UserServiceImpl.accountLogin/getLoginResult |
| GET `/user/current/detail` | 请求头 `token` | 当前用户的 name/admin 等 | UserController.queryCurrentUser |
| GET `/user/form/page` | current、size、folderId（根目录为 0）、可选 name/status/folder | MyBatis-Plus Page：records、total、current、size、pages | UserFormController.queryMyForms；QueryFormRequest.Page；PageRequest |
| GET `/user/form/{key}` | 路径中的 formKey，请求头 token | UserFormEntity；不存在时可为 null | UserFormController.queryFormByKey；FormAuthUtils.hasPermission |
| GET `/user/form/item/list` | query `key={formKey}` | 按 sort 排序的 UserFormItemEntity[] | UserFormController.queryFormItems；FormAuthUtils.hasPermission |

`records` 内本次实测包括 id、formKey、name、textName、type、typeDesc、status、statusDesc、folder、folderId、createTime、updateTime。题目内包括 formItemId、type、label/textLabel、required、sort、scheme 等。不把 scheme 当作新的题型格式写回。

`/user/form/details/{key}` 在上游标有 `@PermitAll`，是公开填写用途，**未用于后台详情**。新界面先读取受所有权保护的单份元数据，再读取同样受保护的题目接口。管理员可查看非本人问卷，这是原版 FormAuthUtils 的管理权限；普通账号必须属于所有者。

## 认证及错误

- `platform.jwt.header=token`。发送原始 Token 于自定义 `token` 请求头，不加 Bearer 前缀，不放 URL，不依赖 Cookie。
- 默认 Token 有效期为 604800 秒，且 AuthorizationInterceptor 还调用 UserTokenService.verifyToken；不能只按 JWT 格式判定登录成功。
- 原版常用响应为 HTTP 200 + `{code,msg,data}`，成功 code=200，失效 code=401，业务失败通常 code=500。除 HTTP 状态外必须检查 code。
- 普通账号越权实测是 HTTP 200、code=500、msg=无表单权限；另一处管理权限可抛 AuthorizationException。前端识别权限语义，保留登录；真正过期才清除当前 Token 并回到登录页。
- HTTP 401/403、代理失败、非 JSON、超时、断网均有明确错误。12 秒请求超时，避免界面永久加载。服务端内部异常原文不直接展示给用户。
- code=416 为验证码要求。本阶段明确提示使用原版验证，不实现验证码绕过。`needChangePassword=true` 时不存储凭证进入工作台。
- 源码未找到注销 API，原 Vue 2 的 logout 也只清除本地状态。新前端使用 sessionStorage 保存当前页签凭证，退出清除；不声称服务端撤销。
- 并发请求的旧 401 不能清除新会话；登录请求晚于退出返回时，也不能恢复已退出的凭证。均有单元验证。

## CORS、数据范围与异常观察

上游 FilterConfig 当前允许所有 origin/method/header；原 Vue 2 withCredentials=false。本阶段采用同源代理、credentials=omit，不为新前端修改生产 CORS 配置，也不新增服务端。

工作台每次列表查询同时查询四个 Page total：当前目录全部非文件夹，以及三个状态分别的非文件夹总数。图表和总数直接使用这些后端值；按问卷名过滤、不含子目录，不是受访样本/答卷比例。状态筛选只影响表格，概览保持三个状态全景。目录导航通过 folderId 查询真实数据。

实测发现上游类型往返问题：合成验收创建请求 type=1，后续读取 type=2/typeDesc=流程表单；文件夹请求 type=3，读取 type=4，但 folder=true。已在 `http-results.json` 记录；本阶段不提供创建功能、不纠正数据库值，优先展示后端 typeDesc。不能将本轮只读迁移验收解释为已验证上游创建/设计完整正确。
