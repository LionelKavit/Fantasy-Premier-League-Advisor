# Design

## Context

The Scout needs three things the current code already largely provides: (1) the manager's analysis (squad + plan) for grounding, (2) the ability to score/look up **any** player, and (3) the ability to validate + re-score a hypothetical. The pipeline functions for scoring (`lib/pipeline`), transfer validation (`lib/optimizer/setup.validateTransfer`), and captain scoring (`lib/captain`) are reusable as tool implementations. The agentic loop + streaming come from `@anthropic-ai/sdk`.

## Key Decisions

### 1. Adopt the Anthropic SDK (groundwork)
Tool-use and streaming are painful over raw `fetch`. Migrate to `@anthropic-ai/sdk`: a small `lib/llm/client.ts` wrapper (constructs the client from `ANTHROPIC_API_KEY`, exposes `messages.create` / `messages.stream`). Migrate the existing call-sites (optimizer/captain/long-term synthesis, llm-context) to it for consistency, and update `lib/__tests__/mock-claude.ts` to **mock the SDK client** (e.g. `vi.mock("@anthropic-ai/sdk")`) instead of stubbing global `fetch`. Behavior-preserving — the existing synthesis/fail-safe tests must still pass.

### 2. Agentic loop with capped tool rounds
`POST /api/ask` runs a standard tool-use loop: send messages + tool definitions → if the model returns `tool_use`, execute the tool, append the `tool_result`, and continue → stop when the model returns a final text answer or a **round cap** (~5) is hit. A token cap and the round cap bound cost/runtime. The final assistant message is **streamed** to the client.

### 3. Tools wrap existing functions; simulation is a new lightweight-delta module
Tool set (all FPL-scoped):
- `get_plan` / `get_squad` — the manager's current `GameweekPlan` / squad (from the grounding context).
- `score_player({ query | id })` — resolve a player from the pool and score them. Targeted lookups are **enriched** (see decision #9): full-fidelity for any player, not just the squad.
- `search_players({ position?, maxPrice?, team?, sortBy?, limit? })` — filter the pool.
- `compare_players(a, b)` — two scored players side by side.
- `simulate_transfer({ outId, inId })` / `simulate_captain({ id })` — **`lib/simulate`**: validate the move (budget/club via `validateTransfer`) and re-score the affected players + projected gain / captaincy delta. **Lightweight** (sub-second), not a re-plan.

### 4. Grounding context: server-derived, cached
To ground the tools the server needs the full analysis (scored squad + candidate pool), richer than the lean `GameweekPlan`. `/api/ask` builds the `AnalysisContext` for the `team_id` (reusing `buildAnalysisContext`) and **caches it in-memory by `team_id`+GW** so repeated turns in a session don't re-run the expensive analysis. The FPL fetchers already cache 1h; this adds a short-lived analysis cache on top.

### 5. Stateless multi-turn
The **client holds the conversation** and sends `{ team_id, freeTransfers, messages: [...] }` each request; the server is stateless except for the cached analysis. No DB, fits the no-auth model. History lives in the browser session.

### 6. FPL-only + cost guards
The system prompt scopes the Scout to FPL/squad questions and instructs it to politely decline off-topic asks. Guards: max ~5 tool rounds, a max-tokens cap, and tools that fail return structured errors the model can recover from (rather than crashing the request).

### 7. Tools are Anthropic tool-use, not MCP
The Scout's tools are **Anthropic tool use (function calling)** — tool schemas passed inline to `messages.create`; the model returns `tool_use` blocks that `/api/ask` executes as local, **in-process** functions wrapping our pipeline, returning `tool_result`. This is **not MCP**: no external tool server, no transport. (MCP would only be relevant later, to expose Pocket Scout's tools to *other* agents/apps — out of scope.)

### 8. Chat UI deferred to a follow-up change
This change is **backend only** — the agentic API + tools. The Ask The Scout chat interface (message list, streaming render, enabling the tab, no-key/error states) is a separate later change (`ask-the-scout-ui`) that consumes `/api/ask`.

### 9. Two-tier player scoring: bulk lightweight vs targeted enriched
Scoring an arbitrary player at full fidelity needs a per-player `fetchElementSummary` (for trend signals) and an LLM-context pass — too costly to do for every player in a broad scan. So scoring is two-tier:
- **Lightweight** (`scorePlayer`, sync) — statistical + fixture + market signals, `trendSignals = null`, neutral LLM context. Used by `search_players` (bulk) and as the graceful-degradation fallback.
- **Enriched** (`scorePlayerEnriched`, async) — adds a lazy per-player element-summary fetch → trend, and a single-player `batchComputeLlmContext` pass (only when a key is set) → LLM-context signals. Both cached on the `ScoutContext` (`enrichedById` / `summaryById`) for session reuse. Used by the targeted tools (`score_player`, `compare_players`, `simulate_*`).

Squad members and evaluated transfer targets already hold their full pipeline score from `buildAnalysisContext`, so `scorePlayerEnriched` short-circuits to those (no refetch). Any fetch/parse failure degrades to the lightweight result rather than throwing. Net: squad-centric questions stay cheap; full-fidelity is paid only for the specific out-of-squad players a user probes.

## Files (indicative)

```
lib/llm/client.ts                    // SDK client wrapper (create / stream)
lib/__tests__/mock-claude.ts         // updated to mock the SDK client
lib/optimizer/synthesis.ts, lib/optimizer/long-term-synthesis.ts,
lib/captain/synthesis.ts, lib/pipeline/llm-context.ts  // migrated to the wrapper
lib/simulate.ts                      // simulateTransfer / simulateCaptain (lightweight delta)
lib/scout/tools.ts                   // tool definitions + dispatch (wrap pipeline fns)
lib/scout/context.ts                 // build + cache the AnalysisContext per team/GW
app/api/ask/route.ts                 // POST /api/ask — agentic loop + streaming
```
(The chat UI — `lib/client/ask.ts`, `components/panel/AskTheScout.tsx`, enabling the tab in `app/page.tsx` — is the follow-up `ask-the-scout-ui` change.)

## Reused
- `buildAnalysisContext` (`lib/plan/context.ts`), `validateTransfer` (`lib/optimizer/setup.ts`), scoring (`lib/pipeline`), captain scoring (`lib/captain`).
- FPL fetchers (cached) for player/element data; `GameweekPlan` / sub-types.

## Follow-ups

### Per-token streaming (deferred to `ask-the-scout-ui`)
The endpoint currently streams **per round** — each round's text is flushed as it resolves, because `llm.createMessage` is non-streaming. True **per-token** streaming (switching the agentic loop to the SDK's `messages.stream` and surfacing token deltas, plus tool-call status events) is deferred to **`ask-the-scout-ui`**. Rationale: per-token streaming is a backend↔frontend *contract* (wire format — SSE/NDJSON framing, tool-status events — and how the message list renders deltas), and it has no user-visible value until a UI consumes it. Designing the transport blind, without its consumer, would invite rework. Per-round chunking already satisfies "not a single blocking payload" for now.

### Full-fidelity scoring for out-of-squad players (lazy enrichment) — ✅ implemented (Task 6)
Originally deferred, now built. Arbitrary players a user names in `score_player` / `compare_players` / `simulate_*` are enriched **on demand** via `scorePlayerEnriched`: a lazy per-player `fetchElementSummary` → `trendSignals`, plus a single-player `batchComputeLlmContext` pass (only when a key is configured) → LLM-context signals, both cached on the `ScoutContext`. `search_players` stays lightweight (bulk scan). See decision #9 and Task 6.
