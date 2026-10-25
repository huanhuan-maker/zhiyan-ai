# 统一AI设置增量

`Build-FullBackend.ps1`在原补丁和analysis/assistant之后复制本目录Java源文件。`form/ai/OpenAiCompatibleProvider`保留原类名及测试构造器，Spring环境中改为动态读取`AiSettingsService`，使既有建卷、分析和助手共享默认配置。每次业务`available()`捕获该次调用的模型配置，后续调用及元数据使用同一快照，避免调用过程中切换默认模型导致标识变化。无新Node业务服务。

管理员API：`GET/POST /user/ai-settings`，`POST /user/ai-settings/test/{modelProfileId}`。按服务端真实管理员身份校验，返回no-store；保存20次/分钟、测试6次/分钟。MyBatis-Plus读写`fm_ai_settings`单行文档，revision进行并发比较更新。最多20个供应商、每个30个模型；拒绝重复配置ID、无效默认模型、错误预算和携带凭据的URL。

供应商Key由AES-256-GCM加密，32字节Base64主密钥默认读取运行目录`ai-config.key`（可设`ai.config-key-file`）。本机运行目录为`.local/tduck-dev`。迁移脚本只首次生成，不打印、不重置；丢失主密钥不能解密旧记录，应恢复备份或在重新准备密钥后重新填写供应商Key。数据库备份必须配套该私有文件。管理员读接口只返回`hasApiKey`，不返回Key、密文或尾号。地址/协议改变且空Key时拒绝保留旧Key。网络错误不输出请求/响应正文或凭据；不跟随重定向。

替换上游可选`HttpTraceLogFilter`：即使开启`platform.request.trace-log`，也只记录方法、无query的路径、HTTP状态和耗时，不读取/记录请求头、参数、请求体或响应体。JUnit实际捕获日志并确认合成Key、token、query和响应正文均未进入日志，响应仍正常传递。

协议映射：

| 配置协议 | 追加路径与鉴权 | 思考参数 | 输出上限 |
| --- | --- | --- | --- |
| OPENAI_CHAT | `/chat/completions`；Bearer | `reasoning_effort` | `max_completion_tokens`；兼容网关可显式选`max_tokens` |
| OPENAI_RESPONSES | `/responses`；Bearer | `reasoning.effort` | `max_output_tokens` |
| ANTHROPIC | `/messages`；x-api-key及anthropic-version | 显式强度用adaptive thinking与`output_config.effort`，none用disabled | `max_tokens` |

auto不发送思考参数，不假设所有模型都支持每个强度。Anthropic不提供minimal选项；老模型若不支持adaptive/effort应使用auto。Responses发送instructions/input、store=false。三者均非流式，提取最终文本，不把思考块当答案。输出被截断/未完成时拒绝作为完整结果；超时1000–120000ms，响应最多2MB，不将远端错误正文返回前端。

官方依据：[Chat Completions请求字段](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)、[Responses输入与状态迁移](https://developers.openai.com/api/docs/guides/migrate-to-responses)、[Anthropic思考控制与effort](https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost)。强度可用性取决于实际模型，输出上限也包含思考开销。

上下文窗口1024–2097152，最大输出64–262144且小于窗口。使用UTF-8字节+1024作为保守输入预算，与输出预留合并检查；这是应用限额估算，不是模型精确tokenizer。超限不截断来源。助手从同一所有者/会话/问卷/版本的成功消息中取最近提问，按模型historyTurns限制最多20轮；不发送答案或工具结果。

独立HTTP验收使用本地三协议服务器作为测试fixture，不冒充真实第三方模型。已配置本机网关完成真实连接、助手规划与分析生成，协议分别验证的真实性见M5-B报告。
