# M5-E-STREAM：校验后的 SSE 分块响应

2026-10-28。本轮实现 `POST /user/form/assistant/chat/stream`，前端通过 fetch ReadableStream 接收 `status/answer/delta/done/error`。请求开始先 flush 状态，继续使用所有权校验、保存的规划、工具和知识库分析；回答完整验证并保存后按 Unicode 码点分块返回。没有用定时器伪装模型 token，也没有在前端添加打字动画。

源码提交：`717a545`。实际页面中响应头到达约1104ms，完整结束18318ms；模型为 `group/group`。Controller 封装 class 与测试 class 相同，安装 JAR 哈希与测试构建相同。相关回归计数见下文，密钥检查实际匹配为0。

**边界：这是校验后分块，不是上游模型逐 token 透传。** 检索、模型生成、事实检查与必要精简期间只有真实阶段状态；首段正文仍需等待这些工作完成。现有多协议 Provider 仍使用非流式生成。这样保留来源和数值核对，未确认的模型草稿不会提前展示。分块可能被网络合并，一次浏览器绘制不保证只显示几个字。

## 文件与运行

- `backend-extensions/assistant/tduck-api/src/main/java/com/tduck/cloud/api/web/controller/AssistantController.java`：认证后的同步 SSE 编排，禁用代理缓冲，分块和断线处理。管理操作仍只返回待确认预览。
- `tduck-vue3/src/td/assistant/stream.js`：UTF-8/SSE 增量解码、错误和缺少 done 检查、释放 reader。
- `tduck-vue3/src/td/views/assistant/index.vue`：实时状态、增量正文、卸载 AbortController、完成后读持久化历史；旧未完成消息仍可继续处理。
- `tduck-vue3/tests/unit/assistant-stream.test.js`：跨字节帧、emoji、异常与中断。
- `scripts/tduck/assistant-stream-ui.mjs`：当前用户社团问卷35份答卷，真实 `group/group` 模型，实际网络和页面测试。

没有数据库结构变更，不需要 SQL 迁移；没有修改题目、答卷、模型配置。仅创建演示对话和读取/刷新现有知识库。

```powershell
Set-Location D:\LcProject
# 将最新扩展源码覆盖到上一阶段隔离构建后：
$env:JAVA_HOME='D:\jdk\jdk17'
& 'D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd' -q -f .local/tduck-knowledge-build/pom.xml '-Dtest=Assistant*Test,SurveyKnowledgeTest,KnowledgeMcpContextTest,Analysis*Test,AiSettings*Test' '-Dsurefire.failIfNoSpecifiedTests=false' clean package
.\scripts\tduck\Install-AnalysisBackend.ps1 -BuildName tduck-knowledge-build
npm run test --prefix tduck-vue3 -- --reporter=dot
npm run build --prefix tduck-vue3
node scripts/tduck/assistant-stream-ui.mjs
```

从零隔离构建先运行 `Build-FullBackend.ps1 -BuildName tduck-knowledge-build`。后端已装到8997；独立启动可在端口空闲时用 `Start-FullBackend.ps1 -Background`。前端在 `D:\LcProject\tduck-vue3` 运行 `npm run dev -- --host 127.0.0.1 --port 5180`。

## 实际验证

Java相关回归 **147 成功 / 0 失败**；前端 **75 成功 / 0 失败**，生产构建成功，仍有原有 Sass/包体积提示。页面与网络 **5 成功 / 0 失败**，无页面脚本错误。不是仅检查 HTTP 200：验证状态先到、多条 delta、真实分析、正文等于已存历史、刷新恢复。

- [状态截图](tduck-full/assistant-stream/01-progress.png) / [回答截图](tduck-full/assistant-stream/02-answer.png)
- [页面结果](tduck-full/assistant-stream/results.json) / [实际 SSE 帧及到达耗时](tduck-full/assistant-stream/wire.json)

网络中断会明确报错；已保存的回复可以刷新恢复。切换离开页面会取消客户端读取，已经进行中的同步模型调用可能继续到服务端结束，不代表已经取消模型推理。旧消息不重播分块。新建对话发送问卷问题验收，本轮结束等待 PASS/FAIL。
