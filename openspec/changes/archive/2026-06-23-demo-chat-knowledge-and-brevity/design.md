# Design — demo chat knowledge & brevity

## 1. The FPL rules knowledge file (`lib/knowledge/rules.md`)
A curated, repo-authored markdown — same pattern as `chips.md`/`rank-strategy.md`, loaded via `loadKnowledge("rules")` (in-process cached, missing → "" so it's strictly additive and never throws).

Contents (concise, principle-style, **dated** so staleness is visible):
- **Squad & formation:** 15 players (2 GK, 5 DEF, 5 MID, 3 FWD), ≤ £100.0m, ≤ 3 per club; valid XI formations (1 GK; 3–5 DEF; 2–5 MID; 1–3 FWD).
- **Scoring:** appearance, goals (by position), assists, clean sheets, the **defensive-contribution** points (the 2025-26 addition — the one rule most likely to be stale in training data), saves, bonus (BPS), cards/OG/pens.
- **Transfers:** 1 free transfer per GW, rollover cap, −4 per extra, price changes, wildcard resets.
- **Chips:** the **two-halves** set (each chip available once per half; first-half chips expire at the GW19 deadline), one chip per gameweek, what each chip does.
- **Season structure:** 38 GWs, deadlines, DGW/BGW basics.

Header note: "Rules current as of the 2025-26 season (revise on rule changes)." A dated file makes "stale judgement" a maintenance task, not a silent model guess.

**Why a file, not the prompt:** it's cached once and reused (caching, §4), it's revisable without touching code, and it mirrors the existing knowledge pattern.

## 2. The tuned demo system prompt (`buildDemoScoutSystemPrompt`)
Keep `SCOUT_PERSONA` (requirement: same persona as the Scout). Refinements:
- **Override the persona's "real squad" close.** The persona ends "You're speaking to one FPL manager about their real squad." The demo block must explicitly restate: this is a *sample* squad, no manager — give general advice (already partly there; make it unambiguous and place it so it governs by recency).
- **Ground in the rules.** Add a rules block from `loadKnowledge("rules")`, framed: "Use these CURRENT rules; if the user asks about rules/scoring/chips, answer from these, not your own assumptions — they may be out of date." Keep the existing chips/rank `expertKnowledgeBlock()`.
- **Off-season honesty.** One line: when reasoning off last season's data (off-season), say so rather than implying it's a live projection.
- Order for caching (§4): persona → demo scope/grounding → rules → chips/rank → format. All static.

## 3. Conservative brevity for demo
Two levers:
- **Output cap.** Add a demo `max_tokens` (e.g. `DEMO_MAX_TOKENS = 384`, vs the manager `MAX_TOKENS = 1024`) used by `runScoutConversation` when `demo` is set — a hard ceiling on spend per turn.
- **Format guidance.** A demo-tuned brevity line (e.g. "≤ 2 sentences, ~45 words; at most one short list, only if essential; never pad") rather than the shared "2–4 sentences (~90 words)" guide.

The tool-use loop (`MAX_TOOL_ROUNDS = 5`) is unchanged — tools fetch real numbers; brevity governs the *prose*, not whether it grounds.

## 4. Prompt caching for demo — confirm & maximize
Current state: `runScoutConversation` already wraps the system in `withCachedSystem(...)` and marks the message tail with `withCachedTail(...)`, so **caching is active for the demo chat today**. Two improvements:
- **Make the demo system prefix constant across visitors.** The manager prompt embeds per-manager facts (name, held chips, chip plan), so its cache only helps within one manager's session. The demo prompt should embed **no per-request variability** — notably, drop `GW${currentGw}` from the demo system text (the demo doesn't need the gameweek number in scope). Then the demo system block is byte-identical for every visitor → one **globally shared** cached prefix → near-100% cache-read rate across the whole demo audience.
- **Clear the cache floor.** Sonnet's prompt cache has a ~2048-token minimum; persona (~500t) + format + chips (~740t) + rank (~590t) is borderline. Adding `rules.md` (~500t) pushes the stable prefix comfortably over the floor, so caching reliably engages.

Net: the rules knowledge is paid for once per 5-min window (cache write) and then read at ~0.1×, while outputs shrink — so adding knowledge *and* cutting tokens are complementary, not opposed.

## Risks & notes
- **Rules accuracy is a maintenance commitment.** A wrong rule in `rules.md` is authoritative to the chat — date it and treat edits like `chips.md`.
- **Don't let brevity starve grounding.** The cap governs prose length; the model must still call tools for numbers. Keep the "call tools for real numbers" instruction prominent.
- **Verify caching, don't assume.** Confirm the demo prefix is constant (no per-visitor bytes) and that usage shows cache reads on multi-turn demo conversations.
