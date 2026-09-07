## 1. Tick script

- [x] 1.1 `scripts/live-eval-tick.ts`: env loading (reuse the brief's dotenv-tolerant loader), state file read/write (`scripts/.live-eval-state.json`, success-only, failure counters), structured log lines with timestamps.
- [x] 1.2 Step: capture — if next deadline within 5h, spawn `npx tsx research/squad-eval/capture.ts <teamId>` (timeout 5 min); on exit 0 record `lastCapturedGw`/`lastCaptureAt`.
- [x] 1.3 Step: score — read bootstrap; for recorded pre-deadline GWs newer than `lastScoredGw` with `finished && data_checked`, spawn `score-live.ts` (timeout 10 min); on success set `lastScoredGw`.
- [x] 1.4 Step: datasets — after a successful score, run `to_parquet.py` for `live-dataset.csv` (and `live-pool-dataset.csv`); record `lastDatasetAt`.
- [x] 1.5 Step: refit hand-off — if `composite-refit-gate` is present, invoke its entry point when `lastScoredGw > lastFitGw`; otherwise log `refit: not installed`.
- [x] 1.6 Step: missed-window detection — if a deadline passed since the last tick and no clean record exists for that GW, send one alert (dedupe by GW in state).
- [x] 1.7 Step: status — write `research/squad-eval/live-status.md` (branch + HEAD, next deadline, last capture/score/fit, dataset counts, last error).
- [x] 1.8 Step: sync — ensure worktree `.worktrees/live-eval-data` on branch `live-eval-data` (create if absent); rsync artefacts; commit `data(live-eval): GW<n> <steps>`; push; failures counted, never touching the main checkout.
- [x] 1.9 Alerts — Resend send helper (same payload shape as the brief); triggers: missed window, two consecutive failures of any step, refit gate passed (message content supplied by Change C).

## 2. Decouple the brief

- [x] 2.1 `scripts/deadline-brief.ts`: remove the `capture.ts` spawn and its log lines; update the header comment.
- [x] 2.2 `BRIEF_DRY_RUN=1 BRIEF_FORCE=1` dry-run: email composes; `live-log.json` mtime unchanged.

## 3. Scheduler and hygiene

- [x] 3.1 `scripts/com.pocketscout.live-eval.plist`: hourly `StartInterval`, `RunAtLoad`, logs to `~/Library/Logs/pocketscout-live-eval.log`; install/uninstall instructions in the header (mirroring the brief's plist).
- [x] 3.2 `.gitignore`: `scripts/.live-eval-state.json`, `.worktrees/`.
- [x] 3.3 `score-live.ts`: accept `--gw <n>` (optional) to restrict scoring/sync to specific gameweeks; default behaviour unchanged.

## 4. Verify

- [x] 4.1 Unit tests for the pure parts (`research/squad-eval/` or `scripts/__tests__/`): window gate, scoring trigger selection from a bootstrap fixture, missed-window detection, state transitions (success resets failures).
- [x] 4.2 Forced dry tick (`LIVE_EVAL_FORCE=1 LIVE_EVAL_DRY_RUN=1`): each step logs its decision without spawning; status file written.
- [x] 4.3 Real tick outside any window: quiet exit, status file rewritten, no sync commit when nothing changed.
- [x] 4.4 Sync step against a throwaway branch name (`LIVE_EVAL_DATA_BRANCH=live-eval-data-test`): worktree created, commit made, push succeeds with the keychain credential; delete the test branch and worktree afterwards.
- [x] 4.5 App gate green (`tsc`/`eslint`/`vitest`); research harness typechecks.
- [x] 4.6 As-built note listing the operator steps that remain (install the LaunchAgent from the main checkout; keep the Mac awake around deadlines and Monday results; keep `main` checked out after merges); archive via `/opsx:archive`.

> **As-built (2026-09-07):** `scripts/live-eval-tick.ts` (steps capture → score → dataset → refit hand-off → status → sync; per-step state in `scripts/.live-eval-state.json`, success-only writes, consecutive-failure counters; Resend alerts on missed window / second consecutive failure / refit pass flag) with the decisions factored into pure `scripts/live-eval-logic.ts` (12 unit tests). `Gameweek.data_checked` added to the type (raw passthrough). Shared `scripts/lib/env.ts` loader; `deadline-brief.ts` no longer spawns the capture (dry-run: `live-log.json` mtime unchanged). `score-live.ts --gw a,b` restricts sync/scoring. `com.pocketscout.live-eval.plist` (hourly, RunAtLoad, `~/Library/Logs/pocketscout-live-eval.log`). Data branch via `.worktrees/<branch>`; orphan created with `hash-object`/`commit-tree` plumbing (git 2.33 has no `worktree add --orphan`). **Verified:** forced dry tick logs every decision and spawns nothing; a real tick against `LIVE_EVAL_DATA_BRANCH=live-eval-data-test` scored GW2 (finished + data_checked), derived Parquet, wrote the status file, created the orphan branch + worktree, committed `data(live-eval): score GW2, dataset …` and pushed with the keychain credential — main checkout HEAD unchanged; a second real tick was quiet with no commit; the test branch, worktree and remote ref were deleted. Gate: `tsc` clean (app + research), `eslint` 0 errors, `vitest` 363/363 (50 files). **Operator steps that remain** (the tick cannot do these): (1) install the LaunchAgent from the MAIN checkout after merge — `cp scripts/com.pocketscout.live-eval.plist ~/Library/LaunchAgents/ && launchctl load ~/Library/LaunchAgents/com.pocketscout.live-eval.plist`; (2) keep the Mac awake inside `deadline − 5h` and after Monday-night results (missed windows are alerted, not recovered); (3) keep `main` checked out in `~/Desktop/fpl-advisor` after merging — the tick runs whatever branch is there (the status file prints branch + HEAD). The first scheduled tick creates the real `live-eval-data` branch. Not exercised live: a real missed-window alert and a real two-failure alert (unit-tested; the send path is the brief's proven Resend call).
