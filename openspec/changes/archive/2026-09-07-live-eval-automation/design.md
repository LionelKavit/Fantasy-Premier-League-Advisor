# Design — live-eval automation

## Context

Existing pieces: `capture.ts` (idempotent pre-deadline, guard-protected), `score-live.ts` (idempotent: re-syncs realized picks, re-scores, rebuilds datasets), `scripts/deadline-brief.ts` (hourly LaunchAgent, `StartInterval 3600`, `RunAtLoad`, gates on `deadline − 5h`, spawns `capture.ts` as a safety net, emails via Resend, state file `.deadline-brief-state.json`). launchd coalesces missed `StartInterval` ticks on wake, so a sleeping Mac fires once on wake.

FPL signals: `bootstrap.events[].finished` and `data_checked` (bonus finalised) mark a gameweek scoreable; `deadline_time` marks the capture window.

## Goals / Non-Goals

**Goals:**
- No manual step between "deadline approaches" and "datasets + reports updated".
- Every step idempotent and independently retryable; one failing step never blocks the others' outputs.
- One writer for `live-log.json` at any time.
- Artefacts persisted off-machine (data branch) without touching code branches.
- The operator learns of failures and missed windows by email, and can read current state in one file.

**Non-Goals:**
- Making the Mac wake itself (a `pmset` schedule is a system setting the operator owns; the design tolerates sleep and alerts on a missed window).
- Auto-merging or auto-deploying anything (Change C opens branches; humans merge).
- Self-updating the code the tick runs (the tick runs whatever is checked out; see Open Questions).

## Decisions

**D1 — One new agent that owns the eval; the brief keeps only email.** *Alternative:* extend the brief tick. Rejected: email and evaluation have different failure modes and the brief's once-per-GW state machine would tangle with per-step eval state. Two agents are fine as long as only one writes the log — hence the brief's capture spawn is removed.

**D2 — Sequential steps in one process per tick.** Capture → score → datasets → refit hook → status. A step that throws is logged, its failure count incremented, and the tick continues to the next step that does not depend on it (status always runs). Dependencies: datasets need score; refit needs datasets.

**D3 — Scoring trigger = `finished && data_checked`, per recorded GW.** `score-live.ts` already re-syncs all finished GWs; the tick invokes it when any recorded pre-deadline GW newer than `lastScoredGw` is `finished && data_checked`. Waiting for `data_checked` avoids scoring on provisional bonus points.

**D4 — Data branch via a git worktree.** `git worktree add .worktrees/live-eval-data live-eval-data` (created on first tick if absent, from an orphan or from main). Each tick rsyncs `research/squad-eval/{live-log.json,pool/,live-*.csv,live-*.md,live-status.md}` and `research/composite-backtest/out/live-*` into it, commits with a fixed message (`data(live-eval): GW<n> <step>`), and pushes. Push auth: osxkeychain helper already configured. *Alternative rejected:* commit on the current code branch — pollutes PRs and breaks if the checkout is mid-rebase.

**D5 — State written after success only.** `scripts/.live-eval-state.json`: `{ lastCapturedGw, lastCaptureAt, lastScoredGw, lastDatasetAt, lastFitGw, failures: {capture, score, dataset, fit, sync}, lastError }`. A step's failure count resets on its next success.

**D6 — Alerts are rare and specific.** Email (Resend, same env as the brief) when: (a) a capture window closes (deadline passes) with no clean pre-deadline record for that GW; (b) any step fails on two consecutive ticks; (c) the refit gate passes (Change C). No "all good" mails; the status file is the heartbeat.

**D7 — Status file is human-first.** `live-status.md`: next deadline and hours left, last capture (GW, time, captain, transfer summary), last scored GW, rows in each dataset and complete-label counts, last fit result line, last error with timestamp. Rewritten every tick; synced to the data branch.

**D8 — Time source.** All window and deadline logic uses the FPL `deadline_time` and the machine clock (as `capture.ts` does). NTP is assumed; the guard tolerates skew in the safe direction.

## Risks / Trade-offs

- [Mac asleep through an entire 5h window] → no capture; alert (D6a) on the next tick; the scheduled brief's capture no longer exists as a fallback. Mitigation is operational: keep the machine awake around deadlines (see Open Questions).
- [`npx tsx` cold start under launchd] → the brief already runs this way; timeouts per spawned step (capture 5 min, score 10 min, fit 10 min).
- [Worktree drift or a stuck rebase in the data worktree] → the sync step fails, counts, and alerts; code branches are never involved.
- [The tick runs stale code after a merge] → status file prints the checkout's branch and HEAD so drift is visible; flagged as an operator step.

## Migration Plan

1. Merge; from the main checkout: `cp scripts/com.pocketscout.live-eval.plist ~/Library/LaunchAgents/ && launchctl load …`.
2. Remove the brief's capture spawn in the same merge (already in this change).
3. First tick creates the data worktree and pushes the branch.
Rollback: `launchctl unload` the new agent; the brief continues to email; capture reverts to manual.

## Open Questions

- Operator decision, not a design blocker: whether to add a `pmset repeat wake` schedule for Friday/Saturday deadline windows and Monday-night results, or accept occasional missed captures with alerts.
- Whether the tick should `git pull --ff-only` when on `main` and clean before running (self-update). Default in this change: **no**; the status file surfaces the branch/HEAD instead.
