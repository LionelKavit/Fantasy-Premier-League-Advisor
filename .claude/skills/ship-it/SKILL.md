---
name: ship-it
description: Commit and push code changes the safe way in this repo. Use this whenever the user asks to commit, push, "ship it", "save my changes to git", "commit and push", or otherwise persist work to git — it runs the tsc/eslint/vitest green gate first, stages explicitly (never `git add -A`), keeps secrets out (excludes `.claude/settings.local.json` and `.env*`, scans the staged diff), commits with the project's Co-Authored-By trailer, and pushes to the feature branch (never main). Prefer this over a bare `git commit` so the verify gate and secret scan are never skipped.
license: MIT
compatibility: Requires git and npm (tsc/eslint/vitest).
metadata:
  author: fpl-advisor
  version: "1.0"
---

Verify, then commit and push **safely**. The point of this skill is that the easy path (`git add -A && git commit && git push`) is exactly how untested code and secrets leak in — so each guardrail below exists for a reason. Don't skip steps; if one fails, stop and report rather than pushing anyway.

Only run this when the user has actually asked to commit/push. Don't commit proactively.

**Steps**

1. **Green gate — verify before you commit.** Run the checks and make sure they pass:
   ```bash
   npx tsc --noEmit
   npx eslint .                 # or the specific changed files for speed
   npx vitest run
   ```
   `tsc` must be clean and `vitest` must be fully green. `eslint` should have **0 errors** (pre-existing *warnings* are fine — don't let them block, but don't add new ones). If anything fails, **stop here**, report the failure with output, and fix it before committing. Committing red code is the failure mode this gate prevents.

2. **Confirm the branch — never push to main.** 
   ```bash
   git branch --show-current
   ```
   If it's `main` or `master`, **stop** and tell the user — branch first (`git checkout -b <name>`) or confirm they really want to. This repo's convention is feature branches, PR'd into main.

3. **Stage explicitly — never `git add -A`/`git add .` blindly.** Add only the paths your change touched. The safe pattern is to name the top-level code/spec dirs (which naturally excludes `.claude/`), e.g.:
   ```bash
   git add app components lib openspec docs README.md   # adjust to what you changed
   ```
   `git add -A` is banned because it sweeps in local/editor cruft and secrets.

4. **Verify exclusions.** Confirm nothing sensitive got staged:
   ```bash
   git diff --cached --name-only | grep -E "settings\.local\.json|\.env" && echo "ABORT: sensitive file staged" || echo "ok"
   ```
   `.claude/settings.local.json` (local Claude permissions) and `.env*` (the `ANTHROPIC_API_KEY`) must **never** be committed. `.env*` is gitignored, but check anyway. If either is staged, unstage it (`git restore --staged <file>`) before continuing.

5. **Scan the staged diff for secrets.** Public repo — a leaked key is permanent. Grep the staged text:
   ```bash
   git diff --cached --text | grep -inE "sk-ant-|secret|password|bearer |authorization:|ANTHROPIC_API_KEY[[:space:]]*=" | grep -v "process.env.ANTHROPIC_API_KEY"
   ```
   The only acceptable hits are `process.env.ANTHROPIC_API_KEY` (a reference, not a value) and clearly-documented placeholders like `sk-ant-...` in a quickstart. A real key value → **stop**, unstage, and tell the user.

6. **Commit with the project trailer.** Write a clear message (imperative subject, a body explaining *why* when non-trivial) and **always** end with the Co-Authored-By trailer. Use a heredoc for multi-line:
   ```bash
   git commit -F - <<'EOF'
   <type>(<scope>): <imperative subject>

   <body — what changed and why; bullets are fine>

   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
   EOF
   ```
   The trailer text must be exactly `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

7. **Push to the feature branch.**
   ```bash
   git push        # or: git push -u origin HEAD   (first push of a new branch)
   ```

8. **Report.** State the commit hash, the branch it pushed to, that the green gate passed, and that the secret scan/exclusions were clean. If anything was skipped (e.g. eslint on changed files only), say so plainly.

**Grouping note:** when many files across several logical changes are uncommitted and they interleave in shared files, a single well-described commit is cleaner and safer than trying to split partial-file edits — this repo already batches multi-change sets that way. Split into multiple commits only when each can be staged whole-file and stays green.
