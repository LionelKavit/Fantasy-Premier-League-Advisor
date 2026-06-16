# Design

## Context

The pipelines are pure and dependency-injected at their cores (`*WithContext`, and node functions that take plain typed inputs), which makes them highly testable without network. The only I/O boundaries are the FPL fetchers (`lib/fpl-api.ts`) and the Claude `fetch` calls inside the two synthesis nodes and `batchComputeLlmContext`. The suite isolates both boundaries: pipeline logic is tested with synthetic fixtures, and the Claude boundary is tested by mocking `fetch`.

## Key Decisions

### 1. Vitest as the runner
Adopt Vitest (TS-native, fast, watch, built-in mocking via `vi`, and `--coverage` via V8). It replaces ad-hoc `tsx` scripts. The existing `lib/__tests__/tc-coherence.test.ts` is migrated into a Vitest spec (its assertions preserved). `npm test` runs the offline suite; `test:watch` and `test:coverage` are added.

### 2. Synthetic fixture factories are the backbone
Live GW38 data can't express DGW/BGW/injuries/budget pressure/rank trends. A `lib/__tests__/factories.ts` module provides builders with sensible defaults and shallow overrides: `makePlayer`, `makeScoredPlayer`, `makeTeam`, `makeFixture`, `makeGameweekFlags`, `makePick`, `makeSquadAnalysisResult`, `makeManagerProfile`, `makeCaptainCandidate`. Builders return fully-typed objects (no `as unknown` casts in tests) so fixtures stay valid as types evolve. Scenario helpers compose them: `makeDgw(teamIds, gw)`, `makeBgw(...)`, `makeInjuredPlayer(...)`, `makeBudgetSquad(...)`.

### 3. Mock the Claude boundary — test success paths, not just fail-safe
A `mockClaude` helper stubs global `fetch` (via `vi.stubGlobal`/`vi.spyOn`) to return:
- a canned valid Anthropic response (`{ content: [{ text }] }`) for success-path tests,
- a non-200 status for API-error tests,
- a 200 with malformed/non-JSON text for parse-failure tests.
This finally covers prompt-driven parsing, schema validation, confidence clamping, and alert merging in both synthesis nodes and `batchComputeLlmContext` — the paths the missing API key has hidden. `ANTHROPIC_API_KEY` is set to a dummy value within mocked tests and unset for fail-safe tests.

### 4. Determinism is mandatory
No wall-clock or randomness in assertions. `generatedAt` and similar timestamps are ignored or matched loosely. Tests assert exact numeric outcomes where the math is fixed, and ordering/threshold outcomes elsewhere. Re-running the suite yields identical results.

### 5. Fault injection for resilience
`plan-resilience` tests inject failures by mocking a sub-pipeline (or its synthesis) to throw, asserting the aggregator isolates it (one side null + a plan-level alert) and never rejects. This covers the partial-failure path that couldn't be triggered through the live API.

### 6. Property/invariant checks alongside example tests
Beyond specific cases, assert invariants that must hold for any input: composite and captain scores stay within their documented ranges, normalization clamps to [0,1], no node throws on empty/degenerate inputs (empty squad, all-injured XI, zero bank, blank gameweek), and pure functions are referentially transparent. Inputs are swept over boundary values rather than randomized, to keep failures reproducible.

### 7. Coverage threshold as a regression guard
Configure V8 coverage scoped to `lib/pipeline`, `lib/optimizer`, `lib/captain`, `lib/plan` with a line/branch threshold (target ≈90% lines, ≈85% branches). The threshold is a floor that fails CI on regression — not a vanity metric; gaps it reveals are filled or explicitly justified.

### 8. End-to-end flow via mocked boundaries (real pipeline in the middle)
A dedicated layer exercises the **unmodified** pipelines from request to output by mocking only the two I/O boundaries: the FPL fetchers (`lib/fpl-api.ts`, via `vi.mock`) return a synthetic-but-realistic dataset for a given `team_id`, and the Claude `fetch` is mocked to return valid responses. This proves three things the node-level tests don't: (a) the request params (`team_id`, `free_transfers`, `horizon`) are understood and thread through; (b) data flows continuously API → squad analysis → optimizer + captain → `GameweekPlan` with nothing dropped between nodes; (c) the output is **personalized** — assertions trace request/data values into the result (captain ∈ the manager's XI, transfers out ∈ the manager's weak spots, chips gate chip advice), and two different managers yield two different plans. Building distinct synthetic managers via the factories is what makes personalization assertable, which the single live GW38 team cannot.

### 9. Tests live beside the code, offline by default
Specs go under `lib/__tests__/` (or co-located `*.test.ts`). The suite makes **no network calls**. The pre-existing live-API smoke check is moved/retained as a separate, explicitly-network integration script that is not part of `npm test`.

## Bug-handling protocol
This change adds tests only and must not alter pipeline behavior. If a test surfaces a real backend bug, it is recorded (a failing/`.todo` test plus a note) and fixed under a separate change, so "add tests" and "change behavior" never mix in one diff.

## Reused
- The pure node functions across `lib/pipeline`, `lib/optimizer`, `lib/captain`, `lib/plan`.
- The existing `tc-coherence` assertions (migrated).
- `vi` mocking for the `fetch` boundary; no real FPL or Anthropic calls in the offline suite.
