# Live-eval automation — one scheduler runs capture, scoring, dataset, and reporting unattended

## Why

Today the capture runs automatically only as a side effect of the deadline-brief LaunchAgent, and everything after it — scoring, the dataset build, any fit — is manual. A gameweek's data therefore only exists if someone remembers to run `score-live.ts`, and the season log is not persisted anywhere but this working tree. The goal is a system that captures before every deadline, scores every finished gameweek, rebuilds the datasets, and reports — without anyone at the keyboard — and tells you when it could not.

## What Changes

- **A dedicated hourly LaunchAgent**, `com.pocketscout.live-eval`, runs `scripts/live-eval-tick.ts`. Each tick, in order and each idempotent: (1) capture inside the `deadline − 5h` window; (2) score every recorded gameweek that FPL reports `finished && data_checked` and that has not been scored; (3) rebuild `live-dataset.csv` / `live-pool-dataset.csv` and derive Parquet; (4) hand off to the refit gate (`composite-refit-gate`) when new labelled rows exist; (5) write a status file and, on failure or a missed deadline, send an alert email.
- **The brief stops spawning the capture.** `scripts/deadline-brief.ts` no longer runs `capture.ts`; two hourly agents writing `live-log.json` in the same window is a race. The brief keeps emailing.
- **A data branch.** Season artefacts (`live-log.json`, `pool/`, `live-*.csv/md`, fit outputs) are synced by the tick into a separate git worktree on branch `live-eval-data` and committed + pushed there, so they survive checkouts and are visible remotely without polluting code branches.
- **Status and alerts.** `research/squad-eval/live-status.md` is rewritten every tick (next deadline, last capture, last scored GW, last fit, last error). Alerts go through the Resend configuration the brief already uses.
- **Per-step state** in `scripts/.live-eval-state.json` (last captured GW, last scored GW, last dataset build, last fit GW, consecutive failure counts) written only after a step succeeds, so a failed step retries next tick.

## Capabilities

### New Capabilities
- `live-eval-automation`: capture, scoring, dataset build, and reporting run unattended on a single hourly scheduler with idempotent steps, persisted state, a data branch, a status file, and failure alerts.

### Modified Capabilities
<!-- The archived deadline-brief-email change's "capture safety net" behaviour is removed; expressed here as a new capability's requirement (archive is closed). -->

## Impact

- New: `scripts/live-eval-tick.ts`, `scripts/com.pocketscout.live-eval.plist`, `scripts/.live-eval-state.json` (gitignored), `research/squad-eval/live-status.md`.
- Modified: `scripts/deadline-brief.ts` (remove capture spawn), `.gitignore` (state file), `research/squad-eval/score-live.ts` (accept `--gw` to score specific gameweeks; already idempotent).
- Machine requirements this cannot remove: the Mac must be awake inside the capture window and after results; `.env.local` provides `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `BRIEF_EMAIL_TO` (all present on 2026-09-06); git push auth exists via the osxkeychain helper.
