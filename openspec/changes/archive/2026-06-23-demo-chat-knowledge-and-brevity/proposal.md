# Demo chat — current-rules grounding, a tuned system prompt, and tight token economy

## Why
The demo chat (`demo-mode-engine`/`-shell`) ships with the Scout persona and the chips/rank knowledge, but three gaps remain:

1. **It doesn't know the rules of FPL.** Only `chips.md` and `rank-strategy.md` exist — there is no curated **rules** file. So when a visitor asks "how many transfers do I get?", "does a defender get points for tackles now?", or "how many wildcards this season?", the model answers from its **training data**, which can be stale (FPL changes scoring/chip rules between seasons — e.g. the 2025-26 defensive-contribution points). For a showcase chat, a confidently wrong rule is the worst failure.
2. **The demo system prompt isn't tuned.** `buildDemoScoutSystemPrompt` exists and reuses `SCOUT_PERSONA`, but the persona's closing line ("their real squad") contradicts demo framing, and the prompt isn't grounded in the rules.
3. **Token usage isn't tuned for a demo.** The demo chat shares the manager chat's `MAX_TOKENS = 1024` and "2–4 sentence" guidance. A free, public demo should be deliberately leaner.

This change sweeps those into one: a current-rules knowledge file, a tuned demo system prompt (same Scout persona), conservative brevity, and a confirmation/lock-in of prompt caching for the demo path.

## What changes
- **A curated FPL rules knowledge file** (`lib/knowledge/rules.md`) — current, dated rules: squad composition (15: 2-5-5-3, ≤ £100m, ≤ 3/club, valid formations), scoring (incl. the defensive-contribution rule), transfers (1 free, rollover cap, −4 hits, price changes), chips (the two-halves set, one per gameweek), and season structure. Injected into the demo chat so it reasons from **supplied current rules**, not training-data assumptions.
- **A tuned demo system prompt** (`buildDemoScoutSystemPrompt`) — keeps `SCOUT_PERSONA`, but explicitly overrides the persona's "real squad" line for demo, grounds in the rules file (+ existing chips/rank principles), and instructs the Scout to defer to the supplied rules over its own assumptions and to flag when it's reasoning off last season's data.
- **Conservative brevity for demo** — a demo-specific, tighter response budget (≤ 2 sentences) and a lower `max_tokens` cap for demo replies, threaded through `runScoutConversation`.
- **Prompt caching, confirmed and maximized for demo** — keep the cached system/tail breakpoints; make the demo system prefix **constant across visitors** (remove per-request variability so the cache is shared globally, not per-session), and ensure the prefix clears the model's cache-floor (the rules file helps). Documented behavior.

## Impact
- New `lib/knowledge/rules.md`; edits to `lib/scout/system-prompt.ts` (demo prompt + rules block) and `lib/scout/chat.ts` (demo `max_tokens`/brevity).
- Additive and demo-scoped: the manager chat is unchanged.
- Net token effect: **more cached input** (rules file, billed at the cache-read rate and shared across visitors) for **fewer, shorter output tokens** — cheaper per demo turn, not more expensive.

## Out of scope
- Adopting `rules.md` into the **manager** chat / syntheses (a sensible follow-up, but this change is demo-scoped).
- Any change to the deterministic engine, the demo squad, or the demo brief.
- A live rules feed — `rules.md` is curated/dated and revised by hand (like `chips.md`).

## Depends on
- Archived `demo-mode-engine` and `demo-mode-shell` (the demo chat path this tunes). Related: `[[llm-prompt-caching]]`, `[[knowledge-grounded-conversation]]`.
