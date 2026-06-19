## Tasks — captain live-eval (prospective, full pipeline)

> Standing offline harness under `research/squad-eval/`. Reuses `squad-eval-captain-replay`'s metrics and the app's full captain pipeline. No runtime change. Results accrue over 2026-27.

### Task 0: Extract a shared metric helper
**Capability:** captain-live-eval
- Refactor the hit-rate / points-captured / head-to-head / baseline aggregation out of `research/squad-eval/replay.ts` into a shared module (e.g. `research/squad-eval/metrics.ts`); have `replay.ts` import it (behavior-unchanged) so floor and full use one implementation.

### Task 1: Capture command (pre-deadline)
**Capability:** captain-live-eval
- `research/squad-eval/capture.ts`: run the app's full captain pipeline for the manager, append a per-GW record to `live-log.json` (captain + vice + ranked candidates/scores, the XI + actual captain, `ep_next`/LLM inputs, `captured_at`).
- Idempotent before the deadline; never overwrite a record once the GW has started. Flag post-deadline captures.

### Task 2: Score command (post-GW)
**Capability:** captain-live-eval
- `research/squad-eval/score-live.ts`: for logged GWs whose fixtures are finished, fetch realized points and run the shared metrics; write `live-report.md` including a **side-by-side vs the replay's deterministic-floor** numbers. State `n` + "provisional" for partial seasons.

### Task 3: Verify
- App gate stays clean (`tsc` / `eslint` / `vitest`); harness + log excluded from the build.
- Dry-run the capture against the current manager/GW to confirm it records the full-pipeline inputs (a single capture is enough to validate the format before the season starts).

### Decide
- [ ] Cadence: run capture/score manually each GW, or wire a scheduler (`/loop` / cron) — out of scope to build here, but note the chosen approach.
