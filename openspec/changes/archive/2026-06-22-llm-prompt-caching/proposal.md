# LLM prompt caching — cache the stable prefix

## Why

Every Claude call the app makes is **uncached**: `lib/llm/client.ts` calls `messages.create` / `messages.stream` with no `cache_control` anywhere, so the entire input is billed at full price on every request. The token export confirms it — across all `fpl-advisor-key` rows on `claude-sonnet-4-6`, `cache_write_*` and `cache_read` are `0`; 100% of input lands in `usage_input_tokens_no_cache` (~1.27M input tokens over four days).

The biggest waste is the **agentic chat loop** (`lib/scout/chat.ts`): one user question makes up to six model calls (5 tool rounds + a forced final), and each call re-sends the same `tools` + `system` prefix at full price, plus a conversation history that only grows. That stable prefix is exactly what prompt caching is for.

## What changes

- **Centralize cache-control in the LLM client.** `lib/llm/client.ts` gains the ability to mark the stable system prefix with `cache_control: { type: "ephemeral" }`. `complete()` wraps a provided `system` string into a cached text block; a small exported helper lets the streaming/agentic call-sites do the same for `system`, `tools`, and the trailing message.
- **Fully cache the agentic chat loop** (`lib/scout/chat.ts`). One breakpoint on the system block (caches `tools` + `system` together — render order is `tools → system → messages`) and one on the last block of the latest message (caches the growing history). Each of the up-to-six calls per question then re-reads the prior prefix at ~0.1× instead of re-billing it at 1×.
- **Mark the single-shot system prefixes** (optimizer synthesis, captain synthesis, chip orchestrator, opening brief, team-news extraction) so they cache opportunistically and benefit automatically if a prefix later clears the model's minimum.
- **No behavioural change.** Output is byte-for-byte the same; only `usage` shifts from `input_tokens` to `cache_read_input_tokens` on repeated prefixes. Keyless paths are untouched (no API call, nothing to cache).

## Scope & decisions

- **Honest about the Sonnet 4.6 floor.** The minimum cacheable prefix on `claude-sonnet-4-6` is **2,048 tokens**. `SCOUT_PERSONA` alone (~500 tokens) sits well under it, so the single-shot synthesis prefixes will often **not** cache (the API silently writes nothing — no error, `cache_creation_input_tokens: 0`). The markers are harmless there and become effective for free if the prefix grows or the model changes. The **material, measurable** win is the agentic loop, whose `tools` + `system` (full persona + squad context + tool schemas) clears the floor and is reused across many calls per question.
- **Ephemeral (5-minute) TTL.** Matches the within-question / within-session reuse pattern; the 5-min window comfortably covers a multi-round answer and a burst of follow-ups. No `1h` TTL (its 2× write premium needs ≥3 reads to pay off and the traffic is bursty).
- **Breakpoint budget.** At most two breakpoints per request (system, message-tail); the API allows four. Mind the 20-block lookback in the tool loop — the per-round tail breakpoint stays within 20 blocks of the previous one.
- **Verifiable.** Tests assert the cache markers are present on the right blocks; the success criterion in practice is a non-zero `cache_read_input_tokens` on the 2nd+ call of a chat turn.

## Out of scope

- Folding the static knowledge files (`rank-strategy.md`, `chips.md`) into the system block to clear the Sonnet floor for the single-shot syntheses — even bundled with the persona they stay under 2,048 tokens on Sonnet, so it would be churn without payoff. Revisit only if those calls move to an Opus-tier model or the prefixes grow.
- Cache pre-warming, `1h` TTL, and any model change.
