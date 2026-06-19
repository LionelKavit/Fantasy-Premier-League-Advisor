# Captain live-eval — score the FULL pipeline going forward, no anachronism

## Why
`squad-eval-captain-replay` could only measure the **deterministic floor**: replayed on history, `ep_next` and the LLM context can't be faithfully reconstructed (not in the API per-GW; re-running the LLM now would "know" the outcomes). So the live pipeline's two strongest extra signals were starved.

The only sound way to measure the **full** captain pipeline — `ep_next` + LLM context included — is **prospectively**: capture the app's recommendation **at each gameweek deadline** (when those signals are real and point-in-time), then score it against realized points after the gameweek. No backfill, no anachronism.

## What changes
- **`squad-eval-captain-live`** — a standing offline harness (under `research/`, **no runtime change**) with two phases per gameweek:
  - **Capture (pre-deadline):** run the app's full captain pipeline for the manager and persist the recommendation + the inputs it used (`ep_next`, LLM signals, ranked candidates, the manager's current XI). Append to a season log.
  - **Score (post-gameweek):** once results are in, fetch realized points and compute the same metrics as the replay — hit-rate, points-captured, head-to-head vs the manager's actual captain, vs baselines — over the accumulated log.
- **Floor-vs-full comparison:** report the full-pipeline numbers next to `squad-eval-captain-replay`'s deterministic-floor numbers, to quantify the lift from `ep_next` + LLM.

## Impact
- Offline tooling; app gate stays clean. Reuses the replay's metric code and the app's captain pipeline (`lib/captain/*`).
- **Results accrue over the 2026-27 season** — this is a season-long log, not a one-shot backtest. The capture step is only valid if run **before each deadline**.

## Out of scope
- Transfers (that's `squad-eval-transfer-replay`).
- Any historical/backward evaluation (that's the archived-data replay; this is forward-only).
- Automating the cadence — the harness exposes capture/score commands; scheduling them (cron, `/loop`) is the user's choice, not part of this change.

## When and how to implement (recommendation)
This change produces **no data until the 2026-27 season is being played** — it's a measurement harness, not a runtime feature, and each capture must run **before a real gameweek deadline** (that's what makes `ep_next` + LLM point-in-time). So its value is gated by the season calendar, not by readiness.

**Recommendation: do NOT implement now.** As of June 2026 the FPL API is mid-rollover — `bootstrap` still reflects the finished 2025-26 and `ep_next` won't be meaningful pre-deadline until 2026-27 fixtures go live. Building months early risks drift against whatever the 2026-27 API/pipeline looks like.

- **Implement in early August 2026** (just before 2026-27 GW1, ~mid-August). Build the capture/score commands, then run the Task 3 dry-run capture once to confirm the record format.
- **Run captures from GW1.** One capture per gameweek deadline (manual or scheduled — the open `Decide` in tasks).

**When it shows effect** (accumulating measurement, not app behavior):
| Milestone | When | Meaning |
|---|---|---|
| First data point | 2026-27 GW1 deadline (~mid-Aug 2026) | one captured pick |
| Provisional signal | ~GW8–12 (~Oct 2026) | hit-rate / head-to-head start to mean something; reports labeled provisional with `n` |
| Full read | end of 2026-27 (~May 2027) | ~38 GWs — comparable to the replay's 36; the definitive full-vs-floor verdict |

## Depends on
`squad-eval-captain-replay` (reuses its metric computation + report format) and the app's captain pipeline + FPL fetch helpers.
