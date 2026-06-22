# Design

## Context

The chat path: `AskTheScout` → `streamAsk` (POST `/api/ask`) → `getScoutContext(teamId)` → `runScoutConversation({ sc, freeTransfers, messages })` → `buildScoutSystemPrompt(sc, freeTransfers)` + the agentic tool loop. `ScoutContext` wraps the raw `AnalysisContext` ([context.ts:47](lib/scout/context.ts)); the orchestrator's `chipPlan` lives on `transfers.chipPlan` from the insights phase and is **not** in that context. The page, however, already has the full plan and passes it to `AskTheScout` as `plan` — `plan.transfers?.chipPlan` is the authoritative decision the panels render.

## Key decisions

### 1. Thread the chip plan from the client, slimmed
The client builds a compact summary from `plan.transfers?.chipPlan` — `{ chip, status, triggerGw, reason }` per entry, dropping `draft` (the large `ValidTransfer[]`). `streamAsk` sends it in the POST body; `/api/ask` reads it and forwards to `runScoutConversation`. Sending what's on screen makes the chat consistent by construction and avoids the ask route calling `runGameweekPlanInsights` (which would recompute — and re-spend — if the insights cache had expired during a long chat). Type: `Pick<ChipRecommendation, "chip" | "status" | "triggerGw" | "reason">[]` (type-only import on the client; erased at build).

### 2. Authoritative grounding in the system prompt
`buildScoutSystemPrompt(sc, freeTransfers, chipPlan?)` gains an optional chip plan. When present and non-empty it renders:

```
## Chip plan (the app's committed recommendation — treat as authoritative)
- Bench Boost: PLAY NOW this gameweek (GW38) — <reason>
- Triple Captain: HOLD — <reason>
When the manager asks which chip to play or about chip timing, explain and defend THIS plan. Do not produce a different chip verdict; if they push back, surface the plan's reasoning rather than contradicting it.
```

Always-present grounding (vs. a tool) guarantees the chat can't skip it. The chip plan is constant across a conversation's turns, so the cached system prefix still holds.

### 3. Graceful absence
`chipPlan` is optional. Keyless (`/api/ask` returns the offline notice before building context), an empty plan, or a missing field → no chip section, identical to today. Existing behaviour and the ask-loop test (which builds no chip plan) are unaffected.

### 4. Why not a `get_chip_plan` tool
A tool depends on the model deciding to call it and adds a round trip; the contradiction we're fixing is precisely the model *not* consulting the plan. Static grounding is the reliable fix. (A tool remains a possible future addition for richer chip Q&A.)

## Files
```
components/panel/AskTheScout.tsx   // build the slim chip summary from plan.transfers?.chipPlan, pass to streamAsk
lib/client/ask.ts                  // streamAsk: include chipPlan in the request body
app/api/ask/route.ts               // read body.chipPlan, forward to runScoutConversation
lib/scout/chat.ts                  // runScoutConversation: accept chipPlan, pass to buildScoutSystemPrompt
lib/scout/system-prompt.ts         // render the authoritative chip-plan section when present
lib/__tests__/scout/ask.test.ts    // assert the section appears when a plan is supplied; absent otherwise
```

## Tests
- With a supplied chip plan, the system prompt contains the "Chip plan" section, the play-now chip, and the authority instruction.
- Without a chip plan, the system prompt has no chip section (existing assertions still pass).
- `tsc`/`eslint`/`vitest` green. Manual: ask "TC or Bench Boost?" → the chat now backs the panels' verdict.
