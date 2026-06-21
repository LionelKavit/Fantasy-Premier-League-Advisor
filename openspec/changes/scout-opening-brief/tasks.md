## Tasks

> Depends on `gameweek-deadline-surface` (the brief names the deadline). Needs a live `ANTHROPIC_API_KEY` to stream LLM prose; without one it streams the deterministic fallback. Tests use the existing mocked SDK client.

### Task 1: Grounding-summary assembly
**Capability:** opening-brief
**File:** `lib/scout/brief.ts` (new)

A pure helper `buildBriefGrounding(plan)` that distils a `GameweekPlan` into a compact, token-light summary object/string: primary transfer recommendation type + `out → in` + `narrativeSummary`, captain (+ vice), the single most important alert, chips remaining, and the deadline. No I/O — unit-testable in isolation.

### Task 2: Streamed brief synthesis
**Capability:** opening-brief
**File:** `lib/scout/brief.ts`

`streamOpeningBrief({ context | plan, onToken })` calls `llm.stream()` with `SCOUT_PERSONA` + a brief instruction (greet, lead with the highest-leverage call, name the deadline, ≤4 sentences, spoken-aloud, no markdown). Forwards text deltas to `onToken`. Mirror the voice/format discipline in `lib/optimizer/synthesis.ts` and `lib/captain/synthesis.ts`. No tools.

### Task 3: Deterministic fallback
**Capability:** opening-brief
**File:** `lib/scout/brief.ts`

`composeDeterministicBrief(grounding)` — a templated, plain-English greeting from the same grounding summary, used when `!hasApiKey()`. One shot (no streaming model), emitted as a single token so the client path is identical.

### Task 4: Brief endpoint
**Capability:** opening-brief
**File:** `app/api/brief/route.ts` (new)

`POST /api/brief` with `{ team_id, freeTransfers }`. Validate `team_id`. Build grounding from the **cached** `runGameweekPlanInsights` (+ base meta). Stream NDJSON `{type:"token"|"error"|"done"}` reusing the `ReadableStream` enqueue helper pattern from `app/api/ask/route.ts`. No-key → stream the deterministic fallback. Errors → `{type:"error"}` then `done` (never a 500 mid-stream).

### Task 5: Tests + verify
**Files:** `lib/__tests__/scout/brief.test.ts` (new), `app` route test alongside the existing `ask.test.ts`

- `buildBriefGrounding`: includes the transfer/captain/deadline; degrades when `transfers`/`captaincy` are null.
- `streamOpeningBrief`: mocked SDK streams tokens; prompt carries the grounding + persona; asserts no-tools.
- No-key path streams the deterministic fallback (non-empty, names the rec + deadline).
- Endpoint: validation (missing `team_id` → 400), happy-path stream, error event on grounding failure.
- `npx tsc --noEmit`, `eslint .`, `vitest` green.
- Manual (with key): `curl -N -X POST /api/brief -d '{"team_id":<id>,"freeTransfers":1}'` → a streamed 2–4 sentence greeting naming the deadline + the actual transfer/captain.
