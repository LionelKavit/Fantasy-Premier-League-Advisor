## Tasks

> Depends on `gameweek-deadline-surface` (the brief names the deadline). Needs a live `ANTHROPIC_API_KEY` to stream LLM prose; without one it streams the deterministic fallback. Tests use the existing mocked SDK client.
>
> Status: implemented on branch `claude/musing-hoover-ef5e36`. `tsc` clean, `eslint` 0 errors, `vitest` 223 passed (+16 brief tests). Grounding sources from the cached merged `runGameweekPlan` (Path A — the post-merge call that sees transfer + captain + deadline at once); a new `mockClaudeStream` helper backs the streamed-brief tests. Manual `curl` against `/api/brief` still pending a live key.

### Task 1 — ✅ Done: Grounding-summary assembly
**Capability:** opening-brief
**File:** `lib/scout/brief.ts` (new)

A pure helper `buildBriefGrounding(plan)` that distils a `GameweekPlan` into a compact, token-light summary object/string: primary transfer recommendation type + `out → in` + `narrativeSummary`, captain (+ vice), the single most important alert, chips remaining, and the deadline. No I/O — unit-testable in isolation.

### Task 2 — ✅ Done: Streamed brief synthesis
**Capability:** opening-brief
**File:** `lib/scout/brief.ts`

`streamOpeningBrief({ context | plan, onToken })` calls `llm.stream()` with `SCOUT_PERSONA` + a brief instruction (greet, lead with the highest-leverage call, name the deadline, ≤4 sentences, spoken-aloud, no markdown). Forwards text deltas to `onToken`. Mirror the voice/format discipline in `lib/optimizer/synthesis.ts` and `lib/captain/synthesis.ts`. No tools.

### Task 3 — ✅ Done: Deterministic fallback
**Capability:** opening-brief
**File:** `lib/scout/brief.ts`

`composeDeterministicBrief(grounding)` — a templated greeting assembled from a few short fragments (deadline greeting → transfer call → captain → at most one alert), **same brief shape** as the LLM path (≤4 spoken sentences, no markdown), used when `!hasApiKey()`. Never pastes `narrativeSummary`/`longTermNarrative`. One shot, emitted as a single token so the client path is identical. (Tests assert the long-form prose never leaks.)

### Task 4 — ✅ Done: Brief endpoint
**Capability:** opening-brief
**File:** `app/api/brief/route.ts` (new)

`POST /api/brief` with `{ team_id, freeTransfers }`. Validates `team_id` (→ 400). Builds grounding from the **cached** merged `runGameweekPlan` (Path A — sees transfer + captain + deadline together; internally cache-gated on insights + context). Streams NDJSON `{type:"token"|"error"|"done"}` via a local `ReadableStream` enqueue helper mirroring `app/api/ask/route.ts`. No-key → streams the deterministic fallback. Grounding done inside the stream so failures emit `{type:"error"}` then `done` (never a 500 mid-stream).

### Task 5 — ✅ Done: Tests + verify
**Files:** `lib/__tests__/scout/brief.test.ts` (new), `lib/__tests__/scout/brief-route.test.ts` (new), `lib/__tests__/mock-claude.ts` (`mockClaudeStream` added)

- [x] `buildBriefGrounding`: includes the transfer/captain/deadline/alert/chips; degrades when `transfers`/`captaincy` are null; surfaces a sub-result alert when no plan-level alert.
- [x] `streamOpeningBrief`: mocked stream forwards tokens; prompt carries the grounding (deadline, move, captain) + persona system; asserts **no tools**; streaming failure propagates.
- [x] `composeDeterministicBrief`: greets + names the deadline + leads with the call + captain; ≤4 sentences; no markdown; ROLL → "hold"; null-deadline fallback; **never leaks `narrativeSummary`/`longTermNarrative`**.
- [x] `formatDeadline`: UTC/GMT format; null on missing/invalid.
- [x] Endpoint: missing `team_id` → 400; no-key → one deterministic token + done; with key → token-by-token + done; grounding failure → error event + done.
- [x] `npx tsc --noEmit` clean, `eslint` 0 errors, `vitest` 223 passed.
- [ ] Manual (with key): `curl -N -X POST /api/brief -d '{"team_id":<id>,"freeTransfers":1}'` → a streamed 2–4 sentence greeting naming the deadline + the actual transfer/captain. **Pending a valid `ANTHROPIC_API_KEY`.**
