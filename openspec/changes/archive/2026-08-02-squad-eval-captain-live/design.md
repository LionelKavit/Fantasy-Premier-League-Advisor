# Design — captain live-eval (prospective, full pipeline)

## Context
The replay measured the deterministic floor because `ep_next`/LLM aren't reconstructable historically. Here we capture them when they ARE real — at the deadline — and score after the fact. The capture must happen pre-deadline; everything else is bookkeeping.

## Two-phase, per gameweek

### Phase A — capture (run before the GW deadline)
- Run the app's **full** captain pipeline for the manager: `runCaptainPipeline(teamId)` (or `runCaptainWithContext` over a freshly built context) — this uses live `ep_next` from `bootstrap` and the real batched LLM context, exactly as the app ships it.
- Persist one record to a season log (`research/squad-eval/live-log.json`), keyed by `gw`:
  - the recommended `captain` (+ vice, + the full ranked candidate ids/scores),
  - the manager's current XI (element ids) and their **actual** captain at capture time,
  - the inputs that drove it: each candidate's `ep_next`, `rotationRisk` (and other LLM signals), captain score breakdown,
  - `captured_at` timestamp + the deadline, so a late (post-deadline) capture can be flagged/discarded.
- Idempotent: re-running before the deadline overwrites that GW's record; never overwrites a record once the GW has started.

### Phase B — score (run after the GW finishes)
- For each logged GW whose fixtures are now finished, fetch realized `total_points` per player (`element-summary`/live event) and compute the metrics **with the same code as the replay** (extract the replay's metric/aggregation functions into a shared module so floor and full use one implementation):
  - hit-rate, points-captured, head-to-head vs the manager's actual captain, baselines (PPG, ownership, random).
- Output `research/squad-eval/live-report.md`, and a **side-by-side table vs the replay's deterministic-floor result** so the `ep_next` + LLM lift is explicit.

## Reuse (don't rebuild)
- **Metrics:** refactor the aggregation in `squad-eval-captain-replay`'s `replay.ts` into a shared helper both harnesses import (single source of truth for hit-rate / capture / head-to-head).
- **Pipeline under test:** `lib/captain/*` via `runCaptainPipeline` — the real, full version (no starving of inputs).
- **Fetch/cache:** `lib/fpl-api.ts`; cache realized results per scored GW.

## Pitfalls
- **Capture timing is the whole point** — a record captured after the deadline is contaminated (`ep_next`/ownership shift, lineups leak). Stamp + validate `captured_at < deadline`; flag violations.
- **Slow feedback** — a full season to accumulate signal; partial-season reports must show `n` and be read as provisional.
- **Squad changes** — the manager's XI/captain at capture is the comparison point; record it at capture, don't re-derive later.

## Deliverables
1. `capture` command — append the pre-deadline full-pipeline recommendation to the season log.
2. `score` command — score finished GWs from the log, write `live-report.md` with the floor-vs-full comparison.
3. Shared metric helper extracted from the replay so both harnesses agree by construction.
