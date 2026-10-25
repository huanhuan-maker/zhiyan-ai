# 问卷助手后端增量（M5-A）

保持现有 Spring Boot / MyBatis-Plus / MySQL，不修改上游工程。`Build-FullBackend.ps1` 复制这些 Java 文件到私有构建目录；迁移 `db/tduck/007_assistant.sql` 新建会话与消息表，无旧业务表删改。

浏览器 MCP 客户端 → `/assistant-mcp` → `AssistantMcpFilter` → `AssistantMcpProtocol` → `AssistantTools` → MyBatis-Plus/版本快照。工具为 `search_surveys`、`survey_stats`、`search_answers`、`survey_report`，均只读业务数据。对话及工具执行状态独立保存到助手表。所有者检查对管理员同样生效，归档问卷不可读，历史结果读取也重新校验当前权限。

`AssistantPlanner` 复用服务端 Provider，仅传提问、所选编号/版本、日期和工具 Schema，输出受限工具名及参数。模型不能写答案数字、引文或 SQL。LOCAL 明确非模型，REAL 需要提问传输确认；超时/坏格式降级并显示原因。浏览器仍需通过真实 MCP 执行返回计划。幂等 UUID 与状态更新约束防止重试重复执行；未发送成功的 READY 可恢复，已经完成的结果作为带查询时间的历史快照。

协议固定支持 **2025-06-18**：Streamable HTTP JSON 响应，初始化协商、initialized 通知（202）、ping、tools/list、tools/call。POST 的 Accept 同时接受 JSON 与 event-stream；本版不启用 SSE/会话，GET 返回405。JSON-RPC 错误及工具错误不套旧 REST 信封。REST 历史/规划仍使用应用约定的响应格式。

认证为本应用 JWT 加数据库中有效 token，支持 Authorization Bearer 或应用 token 请求头，不接受 URL token。缺失/伪造凭据返回401；本机 Origin 白名单、参数白名单、JSON 深度/64KB大小、所有权及限流均在服务端执行。接口返回 no-store。本轮供站内和手动配置本应用凭据的本地客户端使用，未实现公网 OAuth 授权发现，不宣称所有远程 SDK 完整认证兼容性。

`search_answers` 为即时字面关键词 OR 匹配，无向量索引：最多5000份答卷、6个关键词、10条返回证据，超过4000字原文不展开但计入匹配。全量匹配数与返回数分开，不能把关键词出现率解释为总体观点比例。`survey_report` 只返回人工已通过、来源指纹仍一致的报告。默认最新发布版本，显式选择历史版本不会混入新版答卷。

官方协议依据：[传输](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports)、[生命周期](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle)、[工具](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)。本轮自定义实现未引入 MCP Java SDK；独立原生 HTTP 客户端与浏览器均实测协议，测试不等于全协议认证。

验收、启动、测试结果和已知限制见 `docs/ASSISTANT_STAGE.md`、`evidence/M5-A.md`。
