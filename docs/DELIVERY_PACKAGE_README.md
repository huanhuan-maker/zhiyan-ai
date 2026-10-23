# 知研 AI｜老师技术栈版 · 分阶段开发与验收包 V2.0

本包是**给开发 Agent 的完整书面要求和学生自己验收的操作指南**，不包含已经完成的前后端业务程序。

## 一分钟上手（推荐按这个顺序）

1. 新建项目文件夹 `zhiyan-ai`（若已有仓库，先备份/Git commit），将本压缩包解压到项目根目录。
2. **不要混用上一版 `AGENTS.md` 和技术架构**。本包明确要求老师的技术栈：Vue 3 + ECharts，Spring Boot + MyBatis-Plus，MySQL 8.x。旧版文件如有“JPA 或 MyBatis 二选一”的说法，以本版为准。
3. 打开 Codex，把 `CODEX_KICKOFF.md` 全文发给它，让它从 **M0** 动手写代码。
4. Codex 完成后，照 `docs/ACCEPTANCE_GUIDE.md` 的 M0 指南，**自己在 Windows 上运行并测试**；失败就使用 `prompts/PHASE_PROMPTS.md` 最后的修复指令。
5. 只有在你回复“通过 M0 验收，允许进入 M1”后，才复制 `prompts/PHASE_PROMPTS.md` 里的 M1 指令。之后依次推进。
6. 每阶段将实际证据写进 `evidence/M0.md`、`evidence/M1.md` 等（模板见 `evidence/TEMPLATE.md`）。

## 你优先阅读这三个文件

- `docs/DEVELOPMENT_PLAN.md`：详细开发范围、M0–M6 每阶段任务与闸门。
- `docs/ACCEPTANCE_GUIDE.md`：面向学生的 Windows 本地启动、点击验证、负面测试、错误修复步骤。
- `prompts/PHASE_PROMPTS.md`：M1–M6 直接复制给 Codex 的指令。

## 其他资料

- `AGENTS.md`：强制技术栈和 Agent 工作原则。
- `CODEX_KICKOFF.md`：首次开发 M0 的指令。
- `docs/ARCHITECTURE_AND_API.md`：仓库结构、表、MyBatis-Plus、ECharts、API、AI Provider 的约束。
- `docs/PRODUCT_SPEC.md`：前一轮确定的产品规则，不得与本版技术架构冲突。
- `docs/RESEARCH_EVAL.md`：论文与对照实验草案。
- `fixtures/example_survey.json`：虚构调查样例，仅作测试。
- `evidence/TEMPLATE.md`：阶段交付的证据报告模板。

## 研发范围（已冻结）

- 产品服务任意调查主题，先实现单选、多选、量表、开放题。
- AI 自适应追问以开放题为核心；支持澄清、深化、受访者新线索探索、主动停止，并限制受访负担。
- 跨受访者发现相关新维度，**只在本轮分析阶段汇总，不能实时把其他人的发现加入当前受访者问题**。
- 统计由程序计算、报告引用真实数据；AI 模型的“置信度”不等于真实统计概率。
- Jev 可替换、可关闭，不能作为所有功能跑通的前提。

## 合格与不合格的简单判断

合格：本地能够启动、真实数据库存取、刷新仍存在、图表从接口变化、失败路径有处理、测试报告可复现。

不合格：只有页面原型、写死调查结果、同一会话重复提交增加数量、无权限隔离、Mock AI 伪称真实 AI、主题证据找不到原文。

**最重要：开发 Agent 的“完成”只是交付申请，你自己的测试通过才是验收。**
