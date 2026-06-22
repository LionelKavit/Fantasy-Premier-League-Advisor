## Tasks

> Cache the stable prefix of Claude calls. Headline win: the agentic chat loop. Behaviour-preserving — only `usage` changes. Honest caveat: Sonnet 4.6's 2,048-token floor means the single-shot persona-only prefixes often won't cache; the markers are harmless and self-activate if a prefix grows.
>
> Status: implemented on branch `claude/musing-hoover-ef5e36`. `tsc` clean, `eslint` 0 errors, `vitest` 253 passed (+6 prompt-caching helper tests; updated 2 existing assertions for the new system-block shape). `lib/llm/client.ts` exports `withCachedSystem`/`withCachedTail` and caches `complete()`'s system; `lib/scout/chat.ts` caches system (tools+system) + per-round message tail; `lib/scout/brief.ts` caches its system block. Runtime `cache_read_input_tokens` check pending a with-key manual pass.

### Task 1: Cache-control helper + `complete()` system caching
**Capability:** llm-prompt-caching
**File:** `lib/llm/client.ts`

Add a small exported helper that wraps a `system` string into a `cache_control: { type: "ephemeral" }` text block (and a helper to mark the last block of a `messages` array). Use it inside `complete()` so every `complete` call-site (optimizer synthesis, captain synthesis, chip orchestrator, team-news) inherits a cached system prefix with no call-site edit. No `system` → no block, request otherwise unchanged.

### Task 2: Fully cache the agentic chat loop
**Capability:** llm-prompt-caching
**File:** `lib/scout/chat.ts`

Build each round's request with two breakpoints: the system block (caches `tools` + `system`) and the last content block of the latest message (caches history). Re-mark the tail each round on the newly-appended last block; keep it within the 20-block lookback. The forced-final call (no tools) keeps the system + tail breakpoints.

### Task 3: Mark the streamed brief's system block
**Capability:** llm-prompt-caching
**File:** `lib/scout/brief.ts`

Pass the brief's `system` as a cached block (via the Task 1 helper) so the streamed opening brief marks its prefix consistently with the rest.

### Task 4: Tests + verify
**File:** `lib/__tests__/llm/prompt-caching.test.ts` (new)

- `complete()` with a `system` → request `system` is a block array with `cache_control: ephemeral`; without a `system` → no block.
- Agentic loop request carries the system + message-tail breakpoints; the tail breakpoint follows the last block as rounds append.
- Keyless path makes no client/API call and existing fallbacks are unaffected.
- `npx tsc --noEmit`, `eslint .`, `vitest` green.
- Manual, with a key: a multi-round chat answer shows `cache_read_input_tokens > 0` on the 2nd+ model call.

## Verification
- With a key: a chat question that runs ≥2 model calls reports cache reads on the later calls; output is unchanged from before. The single-shot syntheses are byte-for-byte identical (and cache only if their prefix clears the 2,048-token Sonnet floor — expected to be opportunistic).
- Keyless: unchanged deterministic behaviour, no caching.
