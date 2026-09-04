## Tasks — captain live-eval (prospective, full pipeline)

> Standing offline harness under `research/squad-eval/`. Reuses `squad-eval-captain-replay`'s metrics and the app's full captain pipeline. No runtime change. Results accrue over 2026-27.

### Task 0: Extract a shared metric helper
**Capability:** captain-live-eval
- [x] Refactor the hit-rate / points-captured / head-to-head / baseline aggregation out of `research/squad-eval/replay.ts` into a shared module (e.g. `research/squad-eval/metrics.ts`); have `replay.ts` import it (behavior-unchanged) so floor and full use one implementation.

### Task 1: Capture command (pre-deadline)
**Capability:** captain-live-eval
- [x] `research/squad-eval/capture.ts`: run the app's full captain pipeline for the manager, append a per-GW record to `live-log.json` (captain + vice + ranked candidates/scores, the XI + actual captain, `ep_next`/LLM inputs, `captured_at`).
- [x] Idempotent before the deadline; never overwrite a record once the GW has started. Flag post-deadline captures.

### Task 2: Score command (post-GW)
**Capability:** captain-live-eval
- [x] `research/squad-eval/score-live.ts`: for logged GWs whose fixtures are finished, fetch realized points and run the shared metrics; write `live-report.md` including a **side-by-side vs the replay's deterministic-floor** numbers. State `n` + "provisional" for partial seasons.

### Task 3: Verify
- [x] App gate stays clean (`tsc` / `eslint` / `vitest`); harness + log excluded from the build.
- [x] Dry-run the capture against the current manager/GW to confirm it records the full-pipeline inputs (a single capture is enough to validate the format before the season starts).

> **As-built (2026-08-01):** metric extraction verified behavior-identical (replay re-run → `report.md` byte-unchanged). Dry-run against the live 2026-27 API (GW1 deadline 2026-08-21) with only the picks endpoint stubbed (a synthetic best-XV — real picks are never public pre-deadline): full pipeline ran end-to-end, record carries all designed fields (ranked candidates with `ep_next`/LLM signals/breakdowns, XI + actual captain, `captured_at`/deadline/`postDeadline` flag), LLM marked `unavailable — ANTHROPIC_API_KEY not set` honestly. Score command verified on the synthetic log: pending GWs deferred, n stated, provisional label, floor side-by-side rendered. Synthetic log deleted — the season log starts empty.
>
> **Constraint discovered:** the public API never exposes picks before a GW's deadline and manager entries 404 until the 2026-27 team is created, so a **GW1 pre-deadline capture is impossible without auth** — the first capturable gameweek is **GW2** (using the GW1-locked squad, during the GW1→GW2 week). Season yield is therefore ≤37 GWs, comparable to the replay's 36. The manager's 2026-27 entry is **2558300** (registered 2026-08-02; entries reset each season — 2025-26 was 10815578) and is the harness default.

### Decide
- [x] Cadence: run capture/score manually each GW, or wire a scheduler (`/loop` / cron) — out of scope to build here, but note the chosen approach. **Decided (2026-08-02): manual capture is primary (run after finalizing the team each week); the `deadline-brief-email` change adds a launchd-scheduled safety-net capture 5h before each deadline.**
