# Gameweek deadline — surface it on the plan

## Why

FPL advice is only meaningful relative to the **deadline** — "captain Haaland *before Saturday 11:00*". The app never tells the user when picks lock: `GameweekPlan` carries only `currentGw` (a number), not the deadline. The data is already in hand — `bootstrap.currentGameweek.deadline_time` is fetched on every load (`lib/plan/context.ts`, `lib/pipeline/index.ts`) — it is simply dropped on the floor.

This change threads that ISO timestamp through to the plan so any surface (starting with the upcoming **conversation-first** brief) can be deadline-aware. It is small, foundational, and ships on its own with no UI change.

## What Changes

- **Modified capability `gameweek-plan-types`** — add `deadline: string | null` (ISO) to `SquadAnalysisResult` and to `GameweekPlan`, populated from `bootstrap.currentGameweek?.deadline_time` at both build sites (the full pipeline `runSquadAnalysisPipeline` and the lite base context `buildLiteBaseContext`). `null` only when the FPL bootstrap has no current/next gameweek (off-season / cold start).
- Rides the **base** phase, so the deadline is present the instant the pitch paints — no dependency on the slow insights phase.

## Scope & decisions

- ISO string straight from FPL (`deadline_time`); no formatting/timezone logic here — presentation layers format it.
- Nullable, never throws: a missing current gameweek yields `null`, consistent with the existing `currentGw ?? 1` fallback.
- Test factory `makeSquadAnalysisResult` gains a default so existing fixtures keep compiling.

## Out of scope

- Any UI rendering of the deadline (that arrives with the brief and the conversation-first shell).
- Countdown / "deadline passed" logic, timezone localisation.
