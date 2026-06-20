# Design — rank-aware advice (light EO grounding, both syntheses)

## Current state
- **`lib/captain/synthesis.ts`** — already passes `riskProfile`, `effectiveOwnership` per candidate, and `differentialOption`; has a 3-way tone heuristic and instructs the LLM to weigh template vs differential.
- **`lib/optimizer/synthesis.ts`** — already passes `riskProfile` + rank trend; instructions already mention "ownership/template."

So the **facts** are present and the LLM is already nudged. The gap is **principled depth** — when a differential is actually +EV for *rank* (not raw points).

## The change (scope B, prose only)
Add `lib/knowledge/rank-strategy.md` and inject it via the existing `loadKnowledge("rank-strategy")` into both `buildPrompt`s as an "expert rank principles" block — exactly the `chip-strategist` pattern. The deterministic picks, the rank facts, and the existing tone line all stay; the knowledge supplies the judgment the crude switch lacks.

## `rank-strategy.md` content (EO theory + community standard)
- **Effective ownership (EO):** captaincy-weighted ownership across the rank pool. Captaining a high-EO player **protects** rank (you move with the crowd); a low-EO differential captain is a **rank gamble** (gain if it hits, bleed if it doesn't). Captaincy is the **biggest EO lever** (≈2× the swing).
- **Template:** the highly-owned core. Covering it limits downside; you bleed rank when template players haul and you don't own them.
- **Chase vs protect (continuous, not a switch):**
  - *Protect* (rising/strong rank, big lead, early season): own/captain the template; avoid needless differentials.
  - *Chase* (falling rank, large gap to target, few GWs left): take differentials — matching the template only locks in a deficit; you need variance to close a gap.
  - Scale aggression with **gap size × time pressure**: bigger gap and fewer GWs ⇒ more differential.
- **Differentials:** a sub-~10% owned pick; worth it when projected upside justifies the ownership risk *given your rank situation* — not as a default.
- **Don't over-differentiate from a winning position** (chasing variance when ahead loses rank).

Written as durable principles; no dated/season-specific facts.

## Validation
- Unit: `loadKnowledge("rank-strategy")` reads + caches; both prompts embed the principles (assert a marker).
- Qualitative smoke (live): captain + transfer narratives give EO/rank-aware reasoning that scales with the manager's rank gap + GWs left (e.g., a falling-rank manager gets differential-leaning advice with the *why*).
- App gate: `tsc`/`eslint`/`next build`/`vitest`; deterministic picks unchanged.

## Pitfalls / notes
- **Prose only** — do not let the knowledge change the structured captain/transfer pick.
- **Trusted content** — repo-authored; no untrusted-input hardening.
- **Honest scope** — this deepens reasoning that already exists; expect a *quality* lift in the prose, not a measurable point swing (not backtestable).
