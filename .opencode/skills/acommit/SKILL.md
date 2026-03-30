---
name: acommit
description: Analyze working tree changes and create a git commit with an auto-generated message. Asks for user confirmation before committing.
---

## Workflow

1. Run `git status` to see all changed and untracked files.
2. Run `git diff` (staged + unstaged) to understand what changed.
3. Run `git log --oneline -5` to learn the repo's existing commit message style.
4. Draft a concise commit message (English, 1-2 sentences) that focuses on **why**, not what. Follow the style of recent commits in the repo.
5. Stage all relevant files with `git add`. Do NOT stage files that likely contain secrets (`.env`, credentials, tokens, etc.) — warn the user if such files are detected.
6. Present the proposed commit to the user for confirmation:
   - Show the list of files to be committed.
   - Show the draft commit message.
   - Ask the user to confirm, edit, or cancel.
7. Only run `git commit` after the user explicitly confirms.
8. Run `git status` after committing to verify success.

## Rules

- NEVER commit without user confirmation.
- NEVER push to remote — only create local commits.
- NEVER use `--amend`, `--no-verify`, or any force/destructive flags.
- NEVER update git config.
- If there are no changes to commit, inform the user and stop.
- Commit messages should be in English.
