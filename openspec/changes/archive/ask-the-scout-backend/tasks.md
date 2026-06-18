## Tasks

> Depends on adopting `@anthropic-ai/sdk` (Task 1). Chat needs a live `ANTHROPIC_API_KEY` to function; tests use a mocked SDK client (including a tool-use → tool-result → final-text loop).

### Task 1: SDK adoption — ✅ Done
**Capability:** sdk-adoption
**Files:** `lib/llm/client.ts` (new), `lib/optimizer/synthesis.ts`, `lib/optimizer/long-term-synthesis.ts`, `lib/captain/synthesis.ts`, `lib/pipeline/llm-context.ts`, `lib/__tests__/mock-claude.ts`

Add a thin SDK wrapper (`create` / `stream`, built from `ANTHROPIC_API_KEY`). Migrate the four existing call-sites to it (behavior-preserving). Rewrite `mock-claude.ts` to mock the SDK client (success / error / malformed) instead of global `fetch`. Confirm the existing synthesis + long-term tests still pass.

### Task 2: Simulation module — ✅ Done
**Capability:** scout-tools
**File:** `lib/simulate.ts` (new)

`simulateTransfer({ outId, inId })` — validate via `validateTransfer` (budget/club) + re-score affected players + projected gain; returns `legal`/reason on failure. `simulateCaptain({ id })` — captain score for the GW vs the current recommended captain. Lightweight delta only.

### Task 3: Scout tools + context — ✅ Done
**Capability:** scout-tools / ask-endpoint
**Files:** `lib/scout/tools.ts`, `lib/scout/context.ts` (new)

`context.ts`: build + in-memory-cache the `AnalysisContext` per `team_id`+GW (reuse `buildAnalysisContext`). `tools.ts`: define + dispatch the tool set (`get_plan`, `get_squad`, `score_player`, `search_players`, `compare_players`, `simulate_transfer`, `simulate_captain`) wrapping pipeline fns; tools return structured errors (never throw).

### Task 4: Ask endpoint (agentic loop + streaming) — ✅ Done
**Capability:** ask-endpoint
**File:** `app/api/ask/route.ts` (new)

`POST /api/ask` accepting `{ team_id, freeTransfers, messages }`. Run the SDK tool-use loop (cap ~5 rounds, token cap), FPL-only system prompt, stream the final answer. No-key → clear "unavailable" response. Stateless (client-held history) + cached grounding context.

### Task 5: Tests + verify — ✅ Done
- [x] `lib/__tests__/scout/simulate.test.ts`: legal/illegal transfer (budget, 3-per-team, owned, not-in-squad, injured), captain delta + blank/unknown.
- [x] `lib/__tests__/scout/tools.test.ts`: schema + each tool resolves / returns structured errors (real context built from a synthetic `AnalysisContext`).
- [x] `lib/__tests__/scout/ask.test.ts`: mocked SDK drives a tool_use → tool_result → final-text loop; round cap → forced answer; no-key path; FPL-only system-prompt + client-held-history assertions; endpoint validation + happy-path stream.
- [x] Migrated synthesis tests pass on the SDK mock (135 existing → all green).
- [x] `npx tsc --noEmit`, `eslint .` (0 errors), `next build`, `vitest` (170 tests) clean.
- [ ] Manual (backend): with a real key, `curl -N POST /api/ask` with "is Saka a better buy than Semenyo?" / "what if I captain Haaland?" → streamed, tool-assisted answer. **Pending a valid `ANTHROPIC_API_KEY`** (currently 401, so the endpoint returns its "unavailable" fail-safe).

### Task 6: Lazy enrichment for out-of-squad player scoring — ✅ Done
**Capability:** scout-tools
**Files:** `lib/scout/context.ts` (`scorePlayerEnriched` + `enrichedById`/`summaryById` caches), `lib/simulate.ts` (now async), `lib/scout/tools.ts` (targeted tools await enrichment; `search_players` stays lightweight), `lib/__tests__/scout/context.test.ts` (new), updated `simulate.test.ts` / `tools.test.ts`.

Closes the gap recorded in the follow-up: `score_player` / `compare_players` / `simulate_*` enrich an out-of-squad player on demand via a lazy per-player `fetchElementSummary` → trend signals + a single-player `batchComputeLlmContext` pass (key-gated), cached per session. Squad/target players short-circuit to their full pipeline score; failures degrade to lightweight. See design decision #9. Verified: `tsc` / `eslint` (0 errors) / `next build` / `vitest` (170 tests) clean.

#### As-built deviations
- The agentic loop was factored into `lib/scout/chat.ts` (`runScoutConversation`) so it is unit-testable without Next/HTTP; `app/api/ask/route.ts` is a thin streaming shell over it.
- `simulate.test.ts` lives under `lib/__tests__/scout/` (not `lib/__tests__/`) to sit beside its helpers.
- The SDK wrapper exports a single `llm` object (`complete`, `createMessage`, `hasApiKey`) so call-sites do `llm.x()` and tests `vi.spyOn(llm, …)` reliably (no ESM live-binding caveats). The no-key branch stays env-driven at the call-sites.
- A vitest `@` → repo-root alias was added so `app/`-rooted route imports resolve in tests.
- Streaming is **progressive per round** (text is flushed as each round resolves), not per-token — `createMessage` is non-streaming. Token-level streaming can be a refinement when the UI lands.
- Player scoring is two-tier (decision #9): `search_players` stays lightweight (statistical + fixture + market, neutral trend/LLM); the targeted tools enrich on demand (Task 6). Squad members and evaluated targets reuse their full pipeline score in both paths.

> Chat UI is the follow-up `ask-the-scout-ui` change (consumes `/api/ask`).
