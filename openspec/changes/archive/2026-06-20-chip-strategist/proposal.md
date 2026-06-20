# Chip strategist — ground the long-term chip narrative in expert knowledge

## Why
The Long Term tab already shows chip usage two ways: a **deterministic** ChipTimeline (`evaluateChipInteractions`, DGW/BGW-aware) and an **LLM narrative** (`synthesizeLongTerm`). The narrative reasons about chips but **without expert grounding**, so its judgment is generic. Chip timing is worth **~49 pts/season**, and the experts stress *"getting it roughly right matters far more than perfection"* — which is judgment + knowledge, exactly what an LLM grounded in expert principles does well.

**Scope: B (narrative-only).** Keep the deterministic ChipTimeline untouched (it's already reasonable, and chip decisions can't be backtested cleanly — ~4 plays/season). Only **ground the existing long-term narrative** in a curated `chips.md`. This is the safe, high-value 80/20: the structured timeline stays deterministic and stable; the prose becomes expert-level.

## What changes
- **`chip-strategy`** — establishes `lib/knowledge/` + a tiny markdown loader (reused later by `rank-aware-advice`), and grounds `synthesizeLongTerm`:
  - New `lib/knowledge/chips.md` — curated chip-timing principles (see Sources), including the **2025/26 two-halves rule** (8 chips, first set expires GW19, second set unlocks GW20, one chip per GW).
  - `lib/optimizer/long-term-synthesis.ts` loads `chips.md` into the prompt alongside the deterministic facts it already receives (`chipsRemaining`, `chipRecommendations`, `currentGw`, horizon).
- **No change** to `chipPlan` / ChipTimeline — it stays deterministic.

## Sources for `chips.md`
- [Premier League — two sets of chips / GW19 reset](https://www.premierleague.com/en/news/4362027/whats-new-in-202526-fantasy-two-sets-of-chips) (the authoritative rules)
- [FPL Copilot — chip strategy guide](https://fplcopilot.com/blog/chip-strategy-guide)
- [Fantasy Football Scout — ultimate 16-scenario chip guide](https://www.fantasyfootballscout.co.uk/2026/04/09/the-ultimate-fpl-chip-strategy-guide-for-all-16-scenarios)

## Impact
- Runtime change: new `lib/knowledge/` (markdown + loader) + the long-term prompt. The narrative stays prose; the timeline is untouched.
- `chips.md` is a **trusted, repo-authored** file (not fetched) — no untrusted-content concern.
- Not cleanly backtestable (sparse chip decisions); value is judgment/explanation quality, validated qualitatively + the app gate.

## Out of scope
- Changing the structured ChipTimeline / `chipPlan` (that was the rejected scope A).
- The transfer (`narrativeSummary`) and captain syntheses — chip grounding is the long-term narrative only.

## Depends on / relates to
Establishes the knowledge-file loader that `rank-aware-advice` (#4) will reuse. The **GW19 chip-expiry** correctness check is added to `new-season-readiness`.
