# Rank-aware advice — deepen the EO/rank reasoning with expert principles

## Why
Both LLM syntheses are *already* rank- and EO-aware: the captain pick gets `riskProfile` + per-candidate `effectiveOwnership` + the `differentialOption` and weighs template vs differential; the transfer narrative gets rank trend and is told to consider "ownership/template." So the capability exists — what's thin is **depth**: today's rank-awareness is a **hard-coded 3-way tone switch** (`rising` / `falling+<10GW` / else). Real EO strategy is continuous — it depends on the *size* of the rank gap, the *specific* ownership of your template vs your differential, variance, and GWs remaining.

This change adds a curated `rank-strategy.md` that replaces that crude switch's *reasoning* with principled judgment the LLM applies per situation. It is deliberately **light** — the smallest of the four knowledge features (the others were team-news, chips, and the no-shipped fixtures), and not backtestable.

## What changes
- **`rank-strategy`** — a new `lib/knowledge/rank-strategy.md` (reusing the `loadKnowledge` loader from `chip-strategist`), injected as principle context into **both** synthesis prompts:
  - `lib/captain/synthesis.ts` (`buildPrompt`) — EO-aware captaincy (template vs differential).
  - `lib/optimizer/synthesis.ts` (`buildPrompt`) — EO/template-aware transfer reasoning.
- The existing rank **facts** (currentRank, trend, gwsRemaining, effectiveOwnership) and the deterministic picks are **unchanged** — only the reasoning deepens (scope B, prose grounding).

## Impact
- Runtime change: one markdown file + two prompt edits. No schema change, no new data, no structured-output change.
- `rank-strategy.md` is **trusted, repo-authored** content — no untrusted-input handling.
- Not cleanly backtestable; value is judgment/explanation quality, validated qualitatively + the app gate.

## Out of scope
- Changing the deterministic captain pick / transfer recommendation (prose only).
- Replacing the existing 3-way tone heuristic outright — it stays as a quick situational cue; the knowledge supplies the depth.
- Mini-league-specific EO (overall-rank EO only for v1).

## Depends on / relates to
Reuses the `lib/knowledge/` loader established by `chip-strategist`.
