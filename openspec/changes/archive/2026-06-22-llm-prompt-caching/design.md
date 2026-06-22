# Design

## Context

`lib/llm/client.ts` exposes `complete` (single-shot, used by the four syntheses + team-news), `createMessage`/`stream` (raw SDK passthrough, used by the agentic loop), and `hasApiKey`. None set `cache_control`. The token export proves nothing caches today (`cache_read = 0` on every row). Prompt caching is a **prefix match**: the cache key is the exact rendered bytes up to each `cache_control` breakpoint, render order `tools → system → messages`. A breakpoint on the last system block caches `tools` + `system` together.

## Key decisions

### 1. The mechanism lives in the client, applied at the call-sites
`complete()` already owns its `system` handling, so it wraps the string into a cached block internally — every `complete` call-site (synthesis, captain, orchestrator, team-news) gets a system breakpoint with no change at the call-site. The agentic loop and the brief build raw SDK params, so the client exports a tiny helper they call to mark `system` (and, for the loop, the message tail). One mechanism, no per-call-site re-implementation of the block shape.

### 2. The agentic chat loop is the real target
`runScoutConversation` (`lib/scout/chat.ts`) issues up to six model calls for one question: 5 tool rounds + a forced final. Across those calls the `tools` array and the `system` prompt are **identical**, and the `messages` history only grows (append-only). So:
- **Breakpoint A — last system block.** Caches `tools` + `system` (render order puts tools first; the marker on the trailing system block covers both). This is the largest stable span — full `SCOUT_PERSONA`, the squad/situation context, and every tool schema — and it is reused on all six calls.
- **Breakpoint B — last content block of the latest message.** Caches the conversation prefix so each subsequent round re-reads the prior turns instead of re-billing them. Re-marked each round on the new tail; since a round appends only a few blocks, the next breakpoint is within the **20-block lookback window**.

Two breakpoints, well under the four-per-request cap.

### 3. Within-question reuse, not cross-question
`buildScoutSystemPrompt` interpolates the manager name, current GW, bank, and free-transfer count into the system prompt, so the prefix is **not** byte-identical across different questions or managers. That is fine — the value is the 6× reuse **within a single question**, which is where the input tokens actually multiply. Cross-question/cross-user sharing is explicitly not a goal here.

### 4. Honest about the Sonnet 2,048-token floor
`claude-sonnet-4-6` will not cache a prefix below 2,048 tokens — it silently writes nothing (`cache_creation_input_tokens: 0`, no error). `SCOUT_PERSONA` ≈ 500 tokens; even persona + one knowledge file stays under the floor. So:
- The **single-shot syntheses** get the system marker but will frequently **not** cache on Sonnet. We add the markers anyway: they are harmless, they self-activate if the prefix grows or the model moves to Opus-tier (4,096-token… no — Opus floor is also 4,096; the point is the markers are correct and future-proof), and they make the caching policy uniform and legible.
- The **agentic loop** prefix (`tools` + full `system`) is large enough to clear the floor in normal use; this is where we expect real `cache_read` hits.

We encode this expectation in the verification, not as a hard test assertion on token counts (which depend on live prompt size) — the deterministic test asserts the **markers are placed correctly**; the runtime check is a non-zero `cache_read_input_tokens`.

### 5. Ephemeral TTL, no pre-warm
Default 5-minute `ephemeral` TTL. Break-even is the 2nd read (write 1.25× + read 0.1× < 2× uncached), which a multi-round answer hits immediately. No `1h` TTL (2× write needs ≥3 reads; traffic is bursty) and no startup pre-warm (the prefix is per-manager/per-question, nothing static to warm).

### 6. Keyless and failure paths unchanged
No key → no API call → nothing to cache; every existing graceful-degradation path is untouched. A malformed response still falls back exactly as before — caching changes only the `usage` accounting of a successful call.

## Files (indicative)
```
lib/llm/client.ts          // cache_control on complete()'s system; export a helper to mark system/tools/message-tail
lib/scout/chat.ts          // mark system block + message tail each round (the headline win)
lib/scout/brief.ts         // mark the streamed system block
lib/__tests__/llm/prompt-caching.test.ts   // (new) markers are placed on the right blocks; keyless untouched
```
`complete`-based call-sites (synthesis, captain, orchestrator, team-news) need no edit — they inherit the system marker from the client.

## Tests
- `complete()` with a `system` sends it as a block array carrying `cache_control: ephemeral`; without a `system`, no block/marker is added.
- The agentic loop request carries a cache breakpoint on the system block and on the last message block; the tail breakpoint moves to the new last block as rounds append.
- Keyless: no client/API interaction; existing fallbacks unaffected.
- Verification (manual, with a key): a multi-round chat answer shows `cache_read_input_tokens > 0` on the 2nd+ model call.
