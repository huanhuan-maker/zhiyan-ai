# M5-I｜问卷助手对话历史：深色抽屉 + 删除功能（2026-10-27）

需求：对话历史抽屉要是深色，并且能删除对话。

## 一、后端（新增删除接口）

- `AssistantChatService.delete(id, owner)`：先 `requireConversation` 校验编号格式与归属，再按 `conversationId + ownerId` 删除 `fm_assistant_turn` 下的消息，最后删除 `fm_assistant_conversation` 会话本身；返回 `{id, deleted:true}`。
- `AssistantController`：`POST /user/form/assistant/conversations/{id}/delete`，沿用现有 `conversation` 速率桶（15 次/窗口），不新增表、不改 SQL。
- 新增 `AssistantHistoryDeleteTest`（3 项）：本人可删且同时删消息；他人对话被拒且不落删除；不存在/非法编号被拒。

## 二、前端

- `api/project/assistant.js` 增加 `deleteAssistantConversation(id)`。
- 历史抽屉重做：标题 + 时间两行排布、当前对话高亮（青色标题 + 浅底）、每条右侧删除图标；删除走 `ElMessageBox` 二次确认（提示"消息会一并删除，且不可恢复"）。
- 删除后行为：从列表移除；若删的是当前对话，则自动切到最近一条，没有剩余对话时清空消息与问卷上下文。
- 深色：抽屉容器、标题栏、**body（Element Plus 默认白底，单独覆盖）**、遮罩、条目 hover/选中、删除按钮 hover 全部走深色令牌。

## 三、验证（实际执行）

| 项 | 成功 | 失败 |
| --- | ---: | ---: |
| Java `AssistantHistoryDeleteTest`（新增 3 项） | 3 | 0 |
| Java `AssistantSimpleTest`（既有回归，同批运行） | 14 | 0 |
| `scripts/tduck/assistant-history.mjs`（后端 3 项 + 抽屉/删除 UI 5 项） | 8 | 0 |
| `workbench-visual.mjs` 全站深色 23 路由 | 92 | 0 |
| 前端 Vitest | 59 | 0 |
| `vue-tsc --noEmit` + `vite build` | 通过（14.25s，dist 21:48:46） | — |

接口实测结果：新建 → 出现在列表；删除 → 返回 `{deleted:true}` 并从列表消失；再次删除 → 500 "对话不存在或无权访问"；非法编号 → 500。UI 实测：抽屉 `rgb(20,34,53)` 深色底、11 条历史每条都有删除按钮、确认后条目 11 → 10 且后端确认已删。

## 四、截图

- [历史抽屉（深色）](tduck-full/assistant-layout/history-drawer.png)
- [删除二次确认](tduck-full/assistant-layout/history-delete-confirm.png)
- [删除后](tduck-full/assistant-layout/history-after-delete.png)

## 五、复现

```powershell
# 改后端源码后：重新构建并安装（会重启 8997 上的补丁后端）
.\scripts\tduck\Build-FullBackend.ps1 -BuildName assistant-history-build
$env:JAVA_HOME='D:\jdk\jdk17'
& 'D:\maven\apache-maven-3.8.8-bin\bin\mvn.cmd' -q -f .local/assistant-history-build/pom.xml -pl tduck-api -am test "-Dtest=AssistantHistoryDeleteTest,AssistantSimpleTest" "-Dsurefire.failIfNoSpecifiedTests=false" "-DfailIfNoTests=false"
.\scripts\tduck\Install-AnalysisBackend.ps1 -BuildName assistant-history-build
# 回归
node scripts\tduck\assistant-history.mjs
```

## 六、已知边界

- 删除只清理 `fm_assistant_turn` 与 `fm_assistant_conversation`；问卷、答卷、分析报告等业务数据不受影响。
- 历史列表仍只取最近 20 条（沿用原 `list` 限制），删除不影响该上限。
- 回归脚本新建/删除的都是它自己创建的临时对话，不触碰用户真实历史。
