---
name: acommit
description: 分析工作区改动，自动生成中文 commit message 并在用户确认后提交。
---

## 工作流程

1. 执行 `git status` 查看所有变更和未跟踪文件。
2. 执行 `git diff`（含暂存和未暂存）理解具体改动内容。
3. 执行 `git log --oneline -5` 了解仓库已有的 commit message 风格。
4. 撰写简洁的中文 commit message（1-2 句），重点说明**为什么**改，而非罗列改了什么。参考仓库已有风格。
5. 用 `git add` 暂存相关文件。不得暂存可能包含密钥的文件（`.env`、credentials、token 等），发现时需警告用户。
6. 向用户展示提交方案并请求确认：
   - 列出将被提交的文件清单。
   - 展示草拟的 commit message。
   - 询问用户：确认 / 修改 / 取消。
7. 仅在用户明确确认后才执行 `git commit`。
8. 提交后执行 `git status` 验证是否成功。

## 规则

- 未经用户确认，绝不提交。
- 绝不推送到远程——仅创建本地 commit。
- 绝不使用 `--amend`、`--no-verify` 或任何强制/破坏性选项。
- 绝不修改 git config。
- 若无任何改动，告知用户并停止。
- Commit message 使用中文。
