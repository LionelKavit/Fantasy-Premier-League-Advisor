# Scoring-path consolidation — one lite scorer, one neutral constant, labelled fidelity

## Why

Players are scored along five code paths that are *meant* to agree (full pipeline, transfer-candidate search, lite scorer, scout enrichment, restructure replacement search), but two of them duplicate the scorer by hand, the neutral-LLM placeholder exists in four copies, and `computeStatisticalSignals` advertises an `_elementSummary` parameter it never reads. Nothing in a `ScoredPlayer` says which tier produced it, so a full-fidelity score and a lite one look identical downstream. This already produced a false finding (2026-09-06: "candidates are scored inconsistently with the squad") that was written into a change note before being disproved by reading the scorer — the API misleads, and the live-eval dataset now being accumulated (`research/squad-eval/pool/`) cannot record which tier each row came from.

## What Changes

- **Remove the dead parameter.** `computeStatisticalSignals(player, currentGw, _elementSummary?)` drops its third parameter; the one caller that passes it (`lib/pipeline/index.ts`) stops. Eliminates the standing `no-unused-vars` warning and the misleading contract.
- **One neutral-LLM constant.** `NEUTRAL_LLM_SIGNALS` (already exported from `lib/pipeline/lite-scoring.ts`) becomes the single source; `DEFAULT_LLM` in `squad-ranker.ts`, `DEFAULT_LLM_SIGNALS` in `scout/context.ts`, and the inline literal in `optimizer/restructure.ts` are removed in favour of it.
- **One lite scorer.** `findCheapestReplacement` in `lib/optimizer/restructure.ts` calls `scorePlayerLite` instead of re-implementing stats + fixture + market + composite with neutral trend/LLM. Behaviour-identical by construction (same functions, same inputs).
- **Fidelity is labelled.** `ScoredPlayer` gains a required `fidelity: "full" | "lite" | "enriched"` field set by each constructor: `full` = pipeline/candidate search (element-summary trend + batched LLM context), `enriched` = scout `scorePlayerEnriched` (lazy trend + single-player LLM), `lite` = `scorePlayerLite` (neutral trend + neutral LLM). The research pool dump records it as a column so the calibration dataset can filter or stratify by tier.
- **Mixed-fidelity comparisons are documented, not changed.** The restructure chain compares a `full` dream target against a `lite` replacement. The decision is ep-denominated (`netEp` from `epNext` only), so the mix affects only display ordering and the `insufficientDataFallbackScore` filter; this is stated in code and in the spec rather than silently relied on.
- **No model logic changes.** Weights, squash, thresholds, candidate pools and every recommendation stay identical. Acceptance is *provable* invariance: both research replays re-run byte-identical and a fresh capture's composite values are unchanged.

## Capabilities

### New Capabilities
- `scoring-fidelity`: every `ScoredPlayer` declares the fidelity tier that produced it; there is exactly one implementation of the lite tier and one neutral-LLM placeholder; the statistical scorer's signature reflects its real inputs; mixed-tier comparisons are explicit.

### Modified Capabilities
<!-- No existing specs live under openspec/specs/ — nothing to delta. -->

## Impact

- `lib/pipeline/statistical-scoring.ts` (signature), `lib/pipeline/index.ts` (caller; sets `fidelity`), `lib/pipeline/squad-ranker.ts` (drop `DEFAULT_LLM`; sets `fidelity`), `lib/pipeline/lite-scoring.ts` (sets `fidelity`), `lib/pipeline/types.ts` (`ScoredPlayer.fidelity`), `lib/optimizer/restructure.ts` (use `scorePlayerLite`; document the ep-denominated decision), `lib/scout/context.ts` (drop `DEFAULT_LLM_SIGNALS`; sets `fidelity`).
- Two test files construct `ScoredPlayer` literals and gain the new field. `research/squad-eval/capture.ts` adds a `fidelity` column to the pool dump (optional follow-through; harness is outside the app build).
- No API routes, UI, persistence, or config change. No dependency change.
