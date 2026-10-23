# 复制到 Codex / 其他开发 Agent 的首轮指令

你现在开发中国大学生计算机设计大赛项目「知研 AI」：**通用结构化问卷 + 开放式回答有限预算主动追问 + 跨受访者相关新主题发现 + ECharts 可信统计与报告**。

## 绝对不可更改的老师规定
- 前端 **Vue 3 + Apache ECharts**；可以用 TypeScript + Vite + Vue Router + Pinia。
- 服务端 **Spring Boot + MyBatis-Plus**；数据库选 MySQL 8.x。
- **禁止**以 JPA/Hibernate、React、Express/NestJS/FastAPI 等代替规定技术。MyBatis-Plus 必须实际用于 Mapper 数据读写。

## 开始前必读
1. `AGENTS.md`
2. `docs/DEVELOPMENT_PLAN.md`
3. `docs/ACCEPTANCE_GUIDE.md`
4. `docs/ARCHITECTURE_AND_API.md`
5. `docs/PRODUCT_SPEC.md`
6. `docs/RESEARCH_EVAL.md`

## 本轮只允许实现：M0
1. 检查当前代码仓库和 Windows 运行需求，不覆盖已有正常代码；若为空则创建前后端与数据库工程。
2. **实际编写代码**完成 Vue 3 + ECharts 初始化、Spring Boot + MyBatis-Plus 配置、MySQL 的 Mapper 读写、启动/健康检查、环境配置、基础目录与 README。
3. 固定 Spring Boot / MyBatis-Plus / Java 的兼容版本，注明从官方文档核对的依据；优先最少技术依赖，不引入微服务。
4. 编写真实的 Mapper 集成测试，启动并运行项目，执行前端 build、后端 test。
5. Windows PowerShell 能复制执行；若使用 Docker，必须另给不使用 Docker 的 MySQL 启动方法。
6. 生成 `evidence/M0.md`：已实现/未实现、改动文件、Git commit、执行过的命令、成功/失败测试数、截图路径、下一步阻碍。

**不要继续实现 M1 或后续 AI 算法，也不要只汇报设计。** 完成 M0 后停止，等待用户验收。对于非阻塞细节自己采用简单默认并在 README 说明；遇到确实无法执行的环境操作，诚实说明阻碍，交付可复现的剩余部分。
