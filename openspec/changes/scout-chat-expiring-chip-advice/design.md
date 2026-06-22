# Design

## Context

`buildScoutSystemPrompt(sc, freeTransfers, chipPlan?)` ([lib/scout/system-prompt.ts](lib/scout/system-prompt.ts)) builds the chat's system prompt. It already has `sc.ctx.analysis` (which carries `chipsRemaining`) and the current gameweek, and — from `scout-chat-chip-grounding` — renders an authoritative section for the *scheduled* chip plan (`chipPlan`, the chips that have windows). It does **not** list the manager's held chips or their expiry, so a held chip with no scheduled window (the Wildcard here) is invisible to the chat.

## Key decisions

### 1. Add held chips + expiry as grounding (the missing facts)
Compute the current half's deadline (`currentGw <= CHIP_CALENDAR.firstHalfExpiryGw ? firstHalfExpiryGw : seasonEndGw`) and list the held chips (`chipsRemaining[k] > 0`) with that expiry gameweek. This is deterministic and server-side — no client change, no extra request payload. Rendered only when at least one chip is held.

### 2. One principle, LLM-composed
Append a short instruction to the chip section: a held chip is use-it-or-lose-it near its deadline; a held Wildcard makes unlimited transfers for free, so if the manager weighs a points hit for extra moves and holds an (expiring) Wildcard, surface that the Wildcard does it for free — but still give the optimal call and don't recommend burning a chip purely to avoid losing it. The model composes the wording, so the aside adapts to the question instead of reading as boilerplate.

### 3. Keep it in the existing chip section
The held-chips block sits alongside the scheduled-plan block, after "What to say", so the whole chip grounding is contiguous and stays constant within a conversation (prompt caching unaffected). When no chips are held, nothing is added.

## Files
```
lib/scout/system-prompt.ts        // add a held-chips + expiry block and the hit/Wildcard principle
lib/__tests__/scout/ask.test.ts   // assert the held-chip grounding + principle appear; absent when no chips held
```

## Tests
- With chips held, the system prompt lists them and their expiry gameweek, and carries the Wildcard-as-hit-alternative principle.
- With no chips held, no held-chip section is added (existing assertions still pass).
- `tsc`/`eslint`/`vitest` green. Manual: on a final gameweek holding a Wildcard, "should I take a hit?" yields an answer that leads with the optimal move (free transfers + Bench Boost) and notes the Wildcard as the free alternative to a hit.
