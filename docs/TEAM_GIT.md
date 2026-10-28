# 团队协作（Git）

面向加入本项目的成员。环境安装、数据库初始化和启动命令见根目录 [README.md](../README.md)；本文只讲"怎么和别人一起改代码不打架"。

## 仓库与分支

- 远程仓库为 **私有**，需要仓库管理员在 GitHub 里邀请你（Settings → Collaborators → Add people），邀请通过前你只能看到 404。
- `main` 是唯一主干，所有人从这里拉、往这里合。
- `master` 是旧原型（M0/M1）的历史归档，不再开发，不要基于它建分支。
- 个人开发一律用功能分支，命名 `feat/简述`、`fix/简述`，例如 `feat/report-export`。

## 一次性准备

```powershell
git config --global user.name  "你的名字"
git config --global user.email "你的邮箱"   # 建议与 GitHub 账号一致
git clone https://github.com/<组织或账号>/zhiyan-ai.git
cd zhiyan-ai
Copy-Item .env.example .env    # 然后按 README 初始化数据库
```

`.env` 里是**你自己的**数据库口令和管理员初始密码，每台机器一份，永远不提交。仓库里只保留 `.env.example` 模板。

## 日常流程

```powershell
git switch main
git pull --rebase              # 开工前先同步，避免基于旧代码开发
git switch -c feat/你的功能     # 一天一个分支，别在 main 上直接改

# ……改代码……

git add <具体文件>             # 用具体路径，别用 git add .
git commit -m "feat(模块): 做了什么"
git push -u origin feat/你的功能
```

然后在 GitHub 上对 `main` 发 Pull Request，等一个人看过再合并。合并后删掉分支。

提交信息沿用仓库现有风格：`feat/fix/docs/chore/test(范围): 说明`，一句话说清"改了什么"，正文再写"为什么"。

## 绝对不要提交的东西

以下已在 `.gitignore` 里，正常操作不会被带上；但 `git add -f` 能强行绕过，别这么做：

| 路径 | 原因 |
|---|---|
| `.env`、`.local/` | 真实口令、API Key、8997 补丁 JAR |
| `node_modules/`、`dist/`、`backend/target/` | 依赖和构建产物，各自 `npm ci` 重建 |
| `*.zip`、`*.jar` | 发布包，走网盘/群文件，不进 Git |
| `artifacts/`、`test-results/`、`*.log` | 临时产物 |

提交前自查一次：

```powershell
git status --short
git diff --cached --stat
```

## 冲突怎么处理

1. 先 `git pull --rebase`，冲突会停在逐个文件上。
2. 打开冲突文件，找 `<<<<<<<` / `=======` / `>>>>>>>`，留下正确内容，删掉标记。
3. `git add 文件` → `git rebase --continue`。想放弃就 `git rebase --abort` 回到原状。
4. `package-lock.json` 冲突不要手工合并：接受任意一方后重跑 `npm install`，再提交生成的 lock 文件。

拿不准就停下来问，不要 `git push -f`。强推会覆盖别人的提交。

## 约定

- **换行**：仓库 `.gitattributes` 已统一——源码按平台、`*.cmd`/`*.ps1` 用 CRLF、`*.png` 按二进制处理。不要改这个文件。
- **大文件**：单个文件超过 50 MB 不要进仓库（GitHub 会直接拒收 100 MB 以上的文件），放共享网盘并在 README 里写链接。
- **数据库**：每人本地一套 MySQL，不共享数据库；迁移脚本放 `db/`，改动要能重复执行。
- **截图证据**：`evidence/` 下的 PNG/JSON 是验收材料，可以提交，但一次提交只放本次真正重跑出来的结果，别把无关截图刷进去。
