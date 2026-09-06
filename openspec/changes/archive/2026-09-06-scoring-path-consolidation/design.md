# Design — scoring-path consolidation

## Context

Five paths produce a `ScoredPlayer` today:

| Path | Trend | LLM context | Notes |
|---|---|---|---|
| `runSquadAnalysisPipeline` → `scorePlayer` (`lib/pipeline/index.ts`) | element summary | batched pass | squad + (since 2026-09-06) the candidate pool |
| `findCandidates` (`lib/pipeline/squad-ranker.ts`) | element summary | batched cache | same tier as the pipeline; its own `DEFAULT_LLM` fallback |
| `scorePlayerLite` (`lib/pipeline/lite-scoring.ts`) | none | `NEUTRAL_LLM_SIGNALS` | plan base phase, scout `search_players` |
| `scorePlayerEnriched` (`lib/scout/context.ts`) | lazy fetch | single-player pass | its own `DEFAULT_LLM_SIGNALS` |
| `findCheapestReplacement` (`lib/optimizer/restructure.ts`) | none | inline literal | a hand-rolled copy of the lite scorer |

`computeStatisticalSignals` reads only `Player` fields (season-to-date bootstrap stats); the `_elementSummary` parameter is unused, which `lite-scoring.ts` even notes in a comment. So the *only* fidelity difference across paths is trend + LLM. That is by design (cost tiers), but it is invisible on the resulting object, and the duplication means the tiers can drift apart silently.

Constraints: strictly behaviour-preserving; the research replays (`research/squad-eval/replay.ts`, `transfer-replay.ts`) are the regression oracle and must stay byte-identical; the app gate (`tsc`/`eslint`/`vitest`) must stay green.

## Goals / Non-Goals

**Goals:**
- One implementation of the lite tier and one neutral-LLM constant, both in `lib/pipeline/lite-scoring.ts`.
- `ScoredPlayer.fidelity` set at every construction site; no default that could mask an unlabelled path.
- `computeStatisticalSignals` signature reflects its real inputs.
- The restructure chain's mixed-tier comparison is explicit in code and spec.
- Invariance proven, not asserted: replay reports byte-identical, capture composites unchanged.

**Non-Goals:**
- Changing any weight, squash, threshold, pool size, or recommendation.
- Promoting the restructure replacement search to full fidelity (it scores the whole bootstrap; the extra element-summary/LLM cost is not justified by an ep-denominated decision).
- Reworking the scout enrichment path beyond using the shared constant.
- Touching the research harness beyond writing the new column.

## Decisions

**D1 — `fidelity` is a required field, not optional with a default.**
Only two test files build `ScoredPlayer` literals; making the field required costs two test edits and guarantees the compiler flags any future unlabelled constructor. An optional field defaulting to `"full"` would silently mislabel exactly the paths this change exists to expose. *Alternative rejected:* a separate `Map<id, tier>` side-channel — loses the label as soon as the object is passed around.

**D2 — Three tiers, named for what they carry, not where they run.**
`"full"` (element-summary trend + batched LLM), `"enriched"` (lazy trend + single-player LLM; may degrade to neutral on fetch/LLM failure but is still the enriched *attempt*), `"lite"` (neutral trend + neutral LLM). *Alternative considered:* two tiers, folding enriched into full. Rejected because the enriched path skips the LLM pass without a key and can lose trend on fetch failure, so its rows are not interchangeable with pipeline rows in the calibration dataset.

**D3 — `restructure.ts` calls `scorePlayerLite` rather than the pipeline scorer.**
Same functions, same inputs, so the composite is bit-identical to today (the acceptance test proves it). Promoting to full fidelity would change `score.total` for replacements and therefore the `insufficientDataFallbackScore` filter and display ordering — a behaviour change this proposal explicitly excludes.

**D4 — Drop the parameter rather than wire it in.**
Wiring the element summary into `computeStatisticalSignals` would be a model change (new per-90 windows) and belongs in a calibration change with a measured acceptance bar, not a consolidation. Removing it is the honest fix for the API today.

**D5 — Document the mixed-tier restructure comparison instead of "fixing" it.**
`netEp` uses `epNext` only, which is identical across tiers. What mixes is the composite `gw1Gain` (display ordering) and the fallback-score filter. Neither drives the recommendation. A code comment at the comparison site plus a spec requirement makes the reliance explicit so a future change to the decision rule cannot inherit it unknowingly.

**D6 — The pool dump records `fidelity`.**
`research/squad-eval/capture.ts` adds a `fidelity` column (every row is `"full"` today since the pool comes from the pipeline; the column exists so that is a fact, not an assumption, when other sources are added).

## Risks / Trade-offs

- [Replacement composite drifts after switching to `scorePlayerLite`] → the acceptance run re-executes `transfer-replay.ts` and diffs `transfer-report.md` against the committed file; any byte change fails the task.
- [A constructor is missed and `fidelity` is wrong rather than absent] → the field is a string union with no default; the only way to be wrong is to write the wrong literal, which review of the (six) construction sites catches. Property test in `lib/__tests__/stress/property.test.ts` can assert the tier for pipeline output.
- [Removing `_elementSummary` breaks an external caller] → all callers are in `lib/` and the research harness; `tsc` under both the app config and the research tsconfig used on 2026-09-06 covers them.
- [Test literals for `ScoredPlayer` elsewhere are missed] → `tsc` fails loudly; that is the point of a required field.

## Migration Plan

Single PR, no data migration. Rollback is a revert; no persisted format changes (the pool CSV column is additive).

## Open Questions

- None blocking. Owner for the follow-on "wire element-summary windows into the statistical scorer with a measured bar": Kavit, if the live dataset ever shows the season-to-date per-90s lag the rolling ones (not before ~GW12).
