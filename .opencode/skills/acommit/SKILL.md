---
name: acommit
description: 分析工作区改动，自动生成中文 commit message 并直接提交，不询问确认，不推送。
---

## 工作流程

1. 执行 `git status` 查看所有变更和未跟踪文件。
2. 执行 `git diff`（含暂存和未暂存）理解具体改动内容。
3. 执行 `git log --oneline -5` 了解仓库已有的 commit message 风格。
4. 按 AGENTS.md 中的 Commitlint 规范撰写 commit message，格式为 `<type>: <中文描述>`。type 从以下取值：`build`、`chore`、`ci`、`docs`、`feat`、`fix`、`perf`、`refactor`、`revert`、`style`、`test`。描述简洁（1-2 句），重点说明**为什么**改。
5. 用 `git add` 暂存相关文件。不得暂存可能包含密钥的文件（`.env`、credentials、token 等），发现时需警告用户。
6. 直接执行 `git commit`，无需询问用户确认。
7. 提交后执行 `git status` 验证结果，告知用户 commit hash 和 message。

## 规则

- **直接提交，不询问确认，不推送**。
- 绝不执行 `git push`，由用户自行决定何时推送。
- 绝不使用 `--amend`、`--no-verify` 或任何强制/破坏性选项。
- 绝不修改 git config。
- 若无任何改动，告知用户并停止。
- Commit message 使用中文，格式遵循 Commitlint 规范：`<type>: <描述>`。
