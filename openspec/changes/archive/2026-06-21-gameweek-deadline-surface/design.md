# Design

## Context

The deadline is already fetched on every load: `fetchBootstrap()` returns `currentGameweek`, an FPL `Gameweek` whose `deadline_time` is an ISO string (`lib/types.ts`). Two functions build the `SquadAnalysisResult` that the plan is assembled from:
- `runSquadAnalysisPipeline` (`lib/pipeline/index.ts`) — the full analysis (insights phase).
- `buildLiteBaseContext` (`lib/plan/context.ts`) — the lightweight squad-only analysis (base phase, paints the pitch).

Both already read `bootstrap.currentGameweek?.id`; neither carries the deadline forward. `GameweekPlan` (`lib/plan/types.ts`) is the lean object the client receives. This change is a pure data-threading task — no new fetch, no new computation.

## Key Decisions

### 1. Carry the raw ISO string; format at the edge
Store `deadline_time` verbatim (`string | null`). No timezone conversion, no "2 days left" math in the data layer — those are presentation concerns owned by whoever renders it (the brief prompt, a future countdown). This keeps the field a single source of truth and avoids baking a display locale into server data.

### 2. Nullable, never throw
Off-season and cold-start loads have no current/next gameweek. Mirror the existing `currentGameweek?.id ?? 1` pattern with `currentGameweek?.deadline_time ?? null`. The field is typed `string | null` so every consumer must handle absence explicitly — no sentinel dates.

### 3. Ride the base phase, not insights
The deadline must be available the instant the pitch paints (the brief and any deadline UI key off the base response). So it is populated in **both** build sites — including the lite base context — not just the full pipeline. Putting it only on the insights path would make the deadline arrive 30–60s late.

### 4. Thread through `SquadAnalysisResult`, not a parallel field
`GameweekPlan.deadline` is sourced from `ctx.analysis.deadline` at both plan build sites in `lib/plan/index.ts`, rather than re-reading bootstrap in the plan layer. One owner (the analysis result), one assignment pattern, both phases consistent.

## Design constraints

- **No new network calls or compute** — the value is already in the bootstrap response; this change may not add a fetch.
- **Additive only** — existing consumers of `SquadAnalysisResult` / `GameweekPlan` must compile and behave unchanged; the field is appended, not reshaped.
- **Test fixtures must keep compiling** — `makeSquadAnalysisResult` (`lib/__tests__/factories.ts`) gains a `deadline` default so the ~204-test suite is unaffected.
- **No UI in this change** — surfacing it visually is explicitly deferred to the brief / shell changes; this change ends at the API boundary.

## Files (indicative)

```
lib/pipeline/types.ts     // + deadline: string | null on SquadAnalysisResult
lib/plan/types.ts         // + deadline: string | null on GameweekPlan
lib/pipeline/index.ts     // read bootstrap.currentGameweek?.deadline_time → result
lib/plan/context.ts       // same, in buildLiteBaseContext
lib/plan/index.ts         // deadline: ctx.analysis.deadline at both plan build sites
lib/__tests__/factories.ts// makeSquadAnalysisResult deadline default
```

## Reused
- `fetchBootstrap()` / `currentGameweek` (`lib/fpl-api.ts`), the `Gameweek.deadline_time` field (`lib/types.ts`).
- The existing `?? 1` / `?? null` nullish fallback pattern already used for `currentGw`.

## Follow-ups
- Human-readable formatting (timezone, countdown, "deadline passed") is owned by the consumers — first by `scout-opening-brief` (names the deadline in prose), later by any deadline UI.
