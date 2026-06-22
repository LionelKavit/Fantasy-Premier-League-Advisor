# Design

## Context (the trace)

- `runOptimizerWithContext` ([index.ts:78](../../../lib/optimizer/index.ts)) computes `chipRecommendations = evaluateChipInteractions(...)` deterministically, then calls `synthesizeRecommendation`.
- `parseOptimizerResult` sets `chipPlan: inputs.chipRecommendations` ([synthesis.ts:217](../../../lib/optimizer/synthesis.ts)) — the model's `raw.chipPlan` is discarded — while `primaryRecommendation` comes from `mapTransferAction(raw.primaryRecommendation, …)`, where the LLM may pick `WILDCARD`/`FREE_HIT` (prompt: "Sequence chip usage optimally").
- `mapTransferAction` ([synthesis.ts:239–282](../../../lib/optimizer/synthesis.ts)) handles WILDCARD (rebuilds its own draft, `gw1Gain > 0`) but **not** FREE_HIT (→ ROLL). `buildFailSafe` never elects a chip.
- The Chips tab reads `chipPlan`; This Week reads `primaryRecommendation`. Two brains.

## Key Decisions

### 1. One model, one source: `chipPlan`
A chip entry becomes `{ chip, status: "window" | "play-now" | "hold", gw, reason, draft? }`. `chipPlan` is the single authority. **This Week** derives its chip activation from `chipPlan.find(c => c.status === "play-now" && c.gw === currentGw)`; **Chips tab** renders the whole `chipPlan`. The invariant — *This Week shows a chip iff the plan plays one this week* — holds by construction, with or without a key.

### 2. The transfer synthesis no longer elects chips
Remove `WILDCARD`/`FREE_HIT` from the synthesis output schema and from `mapTransferAction`; `primaryRecommendation` is FREE/HIT/ROLL only. This deletes the second brain. The transfer LLM decides the *non-chip* weekly move; chips are decided in the chip plan.

### 3. Deterministic generator emits windows, never `play-now`
Per the N2 decision, *activation* (telling you to burn a chip this week) is a judgment reserved for the orchestrator. So `evaluateChipInteractions` (reused as-is here) emits `window`/`hold` entries only. Until `chip-orchestrator` lands, no entry is `play-now`, so This Week shows no chip and the Chips tab shows candidate windows. This is intentional, not a regression — it removes today's over-eager, dual-brain activation.

### 4. One canonical draft; FREE_HIT fixed
The chip's `draft` (wildcard/free-hit transfer set) is computed once and attached to the entry, replacing the two divergent drafts. FREE_HIT is represented in the model (a one-week XI), not coerced to ROLL.

## Design constraints
- **Deterministic only** — no LLM in this change.
- **Key-independent invariant** — both tabs read `chipPlan` in all modes.
- **No new over-commit** — the deterministic layer never emits `play-now` (N2).
- **No decision drift** — removing chip election from the transfer synthesis must not change FREE/HIT/ROLL behavior.

## Files (indicative)
```
lib/optimizer/types.ts                 // ChipRecommendation gains status + draft; TransferType drops WILDCARD/FREE_HIT
lib/optimizer/chip-interaction.ts       // emit window/hold entries + canonical draft (no play-now)
lib/optimizer/synthesis.ts              // drop WILDCARD/FREE_HIT from schema + mapTransferAction
lib/optimizer/index.ts                  // (unchanged flow; chipPlan still from evaluateChipInteractions)
components/panel/ThisWeekDetail.tsx      // render chip activation from chipPlan play-now@currentGw (none yet)
components/panel/ChipsDetail.tsx / ChipTimeline.tsx  // render the unified chipPlan (window/play-now/hold)
```

## Tests
- The invariant: given a `chipPlan` with a `play-now`@currentGw, This Week surfaces it; with only `window` entries, This Week shows no chip and the Chips tab shows the windows.
- Transfer synthesis: a model reply of `WILDCARD`/`FREE_HIT` no longer produces a chip activation (chips come only from `chipPlan`); FREE/HIT/ROLL unchanged.
- One canonical draft; FREE_HIT no longer coerced to ROLL.
