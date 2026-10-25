# M2 导入续传修复与复验

日期：2026-10-25。用户授权修复独立复验发现的两项问题。本轮仍属于M2，停止在人工复验节点，不进入M3。基于`cd710aa`及前一agent留在工作区的草稿刷新/续传改动继续修复，没有抹掉其实现。最终提交为本报告所在本地提交，可用`git log -1 --format="%h %s" -- evidence/tduck-full/import-recovery/M2_IMPORT_RECOVERY.md`查询；不推送。

## 修改与行为

1. **重新生成混入旧内容**：原导入标识仅含标题、题型、题干，改选项/描述后仍复用旧问卷。现在`draftKey()`包含完整题目对象、标题、描述，覆盖选项、必填、量表范围、开放题提示等。只有内容一致才续传。新内容单独建稿并提示用户上一份草稿仍在“我的项目”，不会静默混用旧题。
2. **查询断网重复建卷**：移除查询原问卷失败后回退至新建的逻辑。网络失败/服务端拒绝时保留原续传记录并停止本次导入；刷新、恢复网络后重试，仍复用原问卷补齐剩余题目。原问卷已发布等状态也明确阻止自动替换。
3. **兼容边界**：旧版仅按题干标识的导入记录无法证明内容一致，因此提示先检查原问卷；不会自动重复建卷。需要全新问卷时可清空结果后重新生成。生成、清空和导入增加互斥，防止一个导入过程中切换草稿内容。
4. **保留前一agent实现**：生成草稿与生成时的输入保存在本标签页sessionStorage，刷新恢复；普通第N题失败后重试及刷新后续传仍可用。关闭标签页后的持久化不作保证。

产品修改文件：`D:/LcProject/tduck-vue3/src/td/views/form/ai-draft/index.vue`。新增回归：`scripts/tduck/m2-import-recovery.mjs`。一并纳入前一agent的`m2-fixes.mjs`和本轮重跑证据；更新`tduck-vue3/README.md`、`evidence/tduck-full/FILES.txt`及旧验收记录的后续报告链接。本轮未改后端、未增加表或SQL迁移。

## 测试先行及实际结果

修复前先运行前三项回归，成功1、失败2（`before.json`）：内容仍为旧选项/旧描述；网络错误导致导航到第二份问卷，无法留在原页继续续传。此前独立审计已记录createForm=2、原残缺问卷保留1题。第三项“题目已落库但响应丢失后重试”原本通过。本轮修复后扩充到10项，全部通过。

| 实际命令 | 成功 | 失败 | 范围与证据 |
|---|---:|---:|---|
| 根目录`node scripts/tduck/m2-import-recovery.mjs` | 10 | 0 | 同题干改选项；分别只改描述/必填/提示/量表上限；网络失败后刷新恢复；题目已保存但响应丢失；查询被403拒绝后重试；已发布问卷保护；旧版会话保护。`edge-results.json` |
| `node scripts/tduck/m2-fixes.mjs` | 41 | 0 | 原agent回归重新运行：慢响应、刷新/清空、六题属性保真、失败续传及刷新续传。`../m2-fixes.json` |
| `node scripts/tduck/m2-usability.mjs` | 10 | 0 | 题数、滚动、四题型答题预览不写库、导入刷新、正常编辑器预览、停收编辑、真实答卷及统计。`../usability/results.json` |
| `node scripts/tduck/m2-real-usability.mjs` | 5组 | 0 | 真实模型13题，生成→预览→导入刷新→人工编辑保存/预览→UI发布→390px匿名手机填写→持久化与全部13题统计。`../usability/real-flow.json` |
| `cd tduck-vue3; npm.cmd test` | 31 | 0 | 4文件，含历史原型测试，不能全算作新迁移UI验收。 |
| `cd tduck-vue3; npm.cmd run test:e2e` | 12 | 0 | 完整真实后端流程、登录/权限；`../e2e-results.xml`，耗时1.6分钟。 |
| `cd tduck-vue3; npm.cmd run build` | 1 | 0 | 18.20秒，保留原有大包提示。 |

所有表格命令均在本轮实际执行。真实模型样本：Provider“本机推理网关”、返回模型标识`group/group`、13题、10607ms；不推断网关内部实际模型，也不输出API Key。专项10项与41项使用明确标注的合成生成响应及故障注入；建卷、保存、查询走8997/MySQL真实隔离链路。41项中的31秒Provider为本地stub，状态REAL代表Provider协议路径，不能当作真实模型推理。

## 截图与日志

- `D:/LcProject/evidence/tduck-full/import-recovery/01-regenerated-content.png`：新稿导入后显示新选项New X/New Y，API断言卷首语为新值且没有旧选项。
- `D:/LcProject/evidence/tduck-full/import-recovery/02-network-interruption.png`：断网后停留草稿页并显示保留续传记录提示，createForm保持1次。
- `D:/LcProject/evidence/tduck-full/import-recovery/03-network-recovered.png`：刷新恢复后在同一问卷补齐2题，没有重复。
- `D:/LcProject/evidence/tduck-full/24-timeout-31s-success.png`至`27-resume-complete.png`：41项原回归的本轮截图。
- `D:/LcProject/evidence/tduck-full/usability/03-real-13-questions.png`、`04-real-answer-preview.png`：本轮真实AI生成及答题预览。

修复前后JSON位于本报告目录。日志保存在忽略的`.local/tduck-full-audit/m2-recovery-{before,after,existing-fixes,usability,real,unit,build,e2e}.log`；不发布原始配置或密钥。

## 本地启动与复验

当前5180前端和8997隔离后端已运行，后端未重启；临时8996慢Provider测试实例仅由测试脚本启停。原8890/8999与旧项目未操作。数据库仍为`tduck_vue3_dev`。服务关闭后PowerShell终端A：

```powershell
cd D:\LcProject
.\scripts\tduck\Start-FullBackend.ps1
```

终端B：

```powershell
cd D:\LcProject\tduck-vue3
npm.cmd run dev
```

不要重复启动已经占用端口的实例。浏览器强制刷新`http://localhost:5180/project/form/ai-draft`，正常生成后可预览/导入。需要故障注入复现时运行专项脚本，不必手工破坏用户问卷。测试仅停止自己创建的合成问卷，不删除用户数据。对完整内容不同的新草稿，明确保留旧草稿供用户管理；这是独立建稿，不是断网重试产生副本。

## 仍保留的范围限制

导入仍使用逐题接口，没有引入服务端事务和建卷幂等键。因此“新建问卷已落库但创建响应丢失”、多标签页并发导入、用户手动删除缓存后再导入，仍不能承诺全局恰好创建一次；本轮覆盖同标签页已有formKey续传及题目保存响应丢失。中断后主动放弃的草稿不自动删除。AI设计假设/维度仍只在生成页供审核。第三方服务和M3追问不属于本次验收。
