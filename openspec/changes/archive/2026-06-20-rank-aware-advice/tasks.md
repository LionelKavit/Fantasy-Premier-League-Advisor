## Tasks — rank-aware advice (light EO grounding)

### Task 1: rank-strategy.md
**Capability:** rank-strategy
- `lib/knowledge/rank-strategy.md`: effective ownership (captaining high-EO protects rank; differential = rank gamble; captaincy ≈2× the EO lever), template/downside coverage, and **continuous** chase-vs-protect scaled by gap size × GWs remaining. Durable principles, no dated facts.

### Task 2: Ground both syntheses
**Capability:** rank-strategy
- `lib/captain/synthesis.ts` (`buildPrompt`): inject `loadKnowledge("rank-strategy")` as expert-principle context; keep the rank facts + tone line + deterministic pick.
- `lib/optimizer/synthesis.ts` (`buildPrompt`): same injection for the transfer narrative.

### Task 3: Verify
**Capability:** rank-strategy
- Unit: loader reads `rank-strategy.md`; both prompts embed a known principle marker.
- Qualitative smoke (live key): a falling-rank manager gets differential-leaning, EO-aware reasoning; a rising-rank one gets template/safe — with the why.
- App gate clean (`tsc` / `eslint` / `next build` / `vitest`); deterministic captain/transfer picks unchanged.

### Decide
- [x] Scope: **B / light** — narrative-only, both syntheses; deterministic picks untouched; existing tone heuristic kept as a situational cue.

---

## As-built outcome (run 2026-06-20)

**Implemented (scope B, both syntheses):**
- `lib/knowledge/rank-strategy.md` — EO theory (captaining high-EO protects rank; differential = rank gamble; captaincy ≈2× the lever), template/downside coverage, and continuous chase-vs-protect scaled by gap × time. Durable, no dated facts.
- `lib/captain/synthesis.ts` + `lib/optimizer/synthesis.ts` — inject `loadKnowledge("rank-strategy")` as an "Expert rank principles" block; the existing rank facts, tone line, and deterministic picks are unchanged.

**Verified:**
- Unit (+2, suite **202 pass**): `rank-strategy.md` loads + caches with the EO/template/chase markers; a deterministic test asserts the **captain prompt embeds the principles** while keeping the `Strategy guidance:` rank facts. The transfer synthesis uses the identical injection pattern (tsc-verified); the end-to-end `loadKnowledge → prompt → grounded narrative` path was already proven live by `chip-strategist`.
- `tsc` / `eslint` 0 / `next build` clean; deterministic captain/transfer picks unchanged (prose-only).
