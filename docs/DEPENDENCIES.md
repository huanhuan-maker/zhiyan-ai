# M0 依赖锁定与兼容依据

核对日期 2026-10-23。Boot 与 MyBatis-Plus 官方页面已通过 HTTPS 实际获取，以下官方内容用于版本兼容核验。

| 依赖 | 锁定版本 | 依据 |
|---|---|---|
| Java | 编译目标 17；本机 Microsoft OpenJDK 17.0.20.1 | [Boot 系统要求](https://docs.spring.io/spring-boot/3.5/system-requirements.html)：3.5.16 至少 Java 17、Maven 3.6.3 |
| Spring Boot | 3.5.16 | 同上，选择 3.x |
| MyBatis-Plus | 3.5.17 | [官方安装页](https://baomidou.com/getting-started/install/) Spring Boot3 示例：`mybatis-plus-spring-boot3-starter:3.5.17`；未重复引入其他 MyBatis starter |
| Wrapper / Maven | 3.3.4 / 3.9.11 | [Maven Wrapper](https://maven.apache.org/wrapper/)，满足 Boot 要求 |
| MySQL | 本机 8.0.46；要求 8.x | 实际 `mysql --version` 及 SQL `SELECT VERSION()`；InnoDB / utf8mb4 |
| Vue | 3.5.44 | [TypeScript 指南](https://vuejs.org/guide/typescript/overview)；升级修复 npm audit 报告的 server-renderer 问题 |
| ECharts | 6.1.0 | [容器与生命周期](https://echarts.apache.org/handbook/zh/concepts/chart-size/)；ResizeObserver/dispose；升级修复 XSS 公告 |
| Vite / Vue 插件 | 7.3.7 / 6.0.1 | [Vite 指南](https://vite.dev/guide/)：Node 20.19+ / 22.12+；本机 22.23.1；修复已报告的路径访问问题 |
| TypeScript / vue-tsc | 5.9.3 / 3.1.1 | build 先做类型检查 |
| Vue Router | 4.5.1 | 仅用于四页导航，无额外状态库 |

Spring Security、JUnit、Flyway（含 flyway-mysql）、Connector/J 由精确锁定的 Boot parent 管理，不另行覆盖。实际解析树见 `evidence/m0-dependencies.txt`。前端版本若因安全修复调整，以最终 package.json、lockfile 和本表更新为准。

无 JPA/Hibernate、React、Node.js 业务服务端；Vite 仅作前端开发/构建。真实测试不使用 H2、Mock Mapper。兼容性再由实际构建与数据库测试验证。
