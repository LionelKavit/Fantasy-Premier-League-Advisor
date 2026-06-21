# Design

## Context

Everything the brief needs to be *grounded* already exists by the time the user could read it: the insights phase computes `transfers` (`OptimizerResult` with `primaryRecommendation`, `hitVerdict`, `narrativeSummary`) and `captaincy` (`CaptainResult` with `captain`, `viceCaptain`), and `runGameweekPlanInsights` **caches** that per `team:gw:ft:horizon` (`lib/plan/index.ts`). The deadline now rides the plan (`gameweek-deadline-surface`). The streaming + NDJSON machinery already exists in `lib/scout/chat.ts` (`llm.stream`) and `app/api/ask/route.ts` (a `ReadableStream` that enqueues one JSON event per line). The persona (`lib/llm/persona.ts`) and the synthesis voice discipline (`lib/optimizer/synthesis.ts`, `lib/captain/synthesis.ts`) are the templates for tone.

What's missing is a *proactive, spoken* opener — the existing syntheses are written as panel prose, not as the Scout greeting you. This change adds that one focused call.

## Key Decisions

### 1. A dedicated synthesis, not a reuse of existing prose
The user chose a distinct LLM call so the greeting can be written for the ear ("Right, before Saturday's 11:00 deadline…"), not stitched from `narrativeSummary` fragments meant for cards. The brief **grounds on the computed results** (the optimizer/captain *facts*) but generates fresh spoken sentences. Trade-off accepted: one extra LLM call per analysis, paid for a livelier open.

### 2. Grounding is a compact distilled summary, not the whole plan
`buildBriefGrounding(plan)` is a pure function that reduces the plan to a token-light brief: the headline action (`ROLL` / `FREE` / `HIT_*` / chip) + `out → in`, the captain (+ vice), the single most important alert, chips remaining, and the deadline. Reasons: keep prompt cost down, and constrain the model to a small, verified fact set so it cannot drift. Being pure makes it unit-testable with no I/O.

### 3. Reuse the `/api/ask` transport contract, don't invent one
`POST /api/brief` returns the **same** NDJSON event shape (`{type:"token"|"error"|"done"}`) as `/api/ask`. The client already knows how to read that framing, so the UI change can lean on a near-identical reader. No SSE, no second wire format.

### 4. Grounding from the cache, never a re-plan
The endpoint calls `runGameweekPlanInsights` (cached) for grounding rather than recomputing the optimizer/captain. Within the 10-minute insights TTL — which is exactly when a brief is requested (right after load) — this is a cache hit. The brief must not double-spend the most expensive work in the app.

### 5. No tools
Unlike the agentic chat, the brief is a single grounded turn. It does not call `score_player` / `simulate_*`. This bounds latency and cost and removes any chance of the *opener* wandering off to fetch data — it speaks only to what the plan already decided.

### 6. Grounded-or-silent on missing data
If a sub-pipeline failed (`transfers` or `captaincy` null), the brief leads with whatever survived and **omits** the missing side rather than inventing it. The prompt forbids fabricating prices/scores/projections (same rule as the existing syntheses); the grounding summary simply won't contain the missing facts.

### 7. Deterministic fallback so the Scout always greets — same shape, templated wording
With no `ANTHROPIC_API_KEY`, `composeDeterministicBrief(grounding)` returns a templated greeting from the same summary, streamed as a **single token** so the client path is identical to the LLM path. Critically, it obeys the **same brief instruction** as the LLM path — greet, lead with the highest-leverage decision, name the deadline, **≤4 sentences, spoken-aloud, no markdown** — only the wording is fixed rather than generated. It is built by conditionally assembling a handful of short sentence fragments (deadline greeting → the transfer call → captain → at most one alert), never by pasting `narrativeSummary`/`longTermNarrative` wholesale — those are the long-form verdict prose the brief must *not* become. This matches the app's degrade-don't-fail ethos (the pitch + deterministic recs already work keyless); the difference from `/api/ask` (a flat "unavailable" notice) is deliberate: a short greeting grounded in deterministic facts is genuinely useful, whereas an open-ended chat without a model is not.

### 8b. Brevity is a hard constraint on both paths
The opening brief is a punchy spoken opener, not a written verdict. Brevity is governed by the **prompt** (≤4 sentences, no markdown), not by `max_tokens`; the deterministic composer caps itself structurally (≤4 fragments). Neither path may reproduce the multi-paragraph `ScoutVerdict` / long-term outlook prose — that is the explicit anti-goal of this change.

`BRIEF_MAX_TOKENS` is a **runaway guard, not the length control**. It is a ceiling, not a target: the model stops at its natural end (so unused headroom costs nothing — output is billed on tokens actually generated), whereas a cap set too low would truncate the brief mid-sentence. ~4 spoken sentences ≈ 110-150 tokens (English ≈ 1.3-1.5 tokens/word, plus player names / the deadline string tokenize a little heavier), so the cap is set to **320** (~2× margin) to guarantee a slightly chatty-but-valid brief is never cut off. Erring high is safe and free; erring low is the only real failure mode.

### 8. Stateless
`/api/brief` derives grounding server-side from `team_id` (+ cached context) and persists nothing — consistent with `/api/ask` and the no-DB model.

## Design constraints

- **No new fetch on the hot path** — grounding comes from the insights cache; a brief request must not trigger a fresh optimizer/captain run.
- **Same NDJSON contract as `/api/ask`** — `{type:"token"|"error"|"done"}`, one JSON object per line; errors surface as an `error` event then `done`, never a mid-stream 500.
- **Bounded output** — ≤4 sentences, no markdown/headings/tables/bullets; a short `max_tokens` cap keeps it snappy.
- **Grounded only** — the model may reference only figures present in the grounding summary; inventing numbers is a spec violation.
- **Depends on `gameweek-deadline-surface`** for the deadline in the summary; **decoupled from the UI** — this change ships and is verifiable via `curl` before any frontend consumes it.

## Files (indicative)

```
lib/scout/brief.ts        // buildBriefGrounding(plan) · streamOpeningBrief({...,onToken}) · composeDeterministicBrief(grounding)
app/api/brief/route.ts    // POST /api/brief — grounding from cached insights → NDJSON token stream (or fallback)
lib/__tests__/scout/brief.test.ts  // grounding assembly, streamed tokens, no-key fallback, endpoint validation
```

## Reused
- `runGameweekPlanInsights` + the insights cache (`lib/plan/index.ts`); `GameweekPlan` / `OptimizerResult` / `CaptainResult` types.
- `SCOUT_PERSONA` (`lib/llm/persona.ts`), `llm.stream` / `hasApiKey` (`lib/llm/client.ts`).
- The `ReadableStream` NDJSON enqueue helper pattern from `app/api/ask/route.ts`; the mocked SDK client (`lib/__tests__/mock-claude.ts`).

## Follow-ups
- The client transport (`lib/client/brief.ts`), auto-fire, and contextual starters are the separate `proactive-scout-brief-ui` change — designing them here, without the hero-chat shell, would invite rework.
