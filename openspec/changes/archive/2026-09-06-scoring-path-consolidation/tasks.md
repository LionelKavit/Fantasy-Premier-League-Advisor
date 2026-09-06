## 1. Baseline the oracle (before any code change)

- [x] 1.1 Re-run `npx tsx research/squad-eval/replay.ts` and `npx tsx research/squad-eval/transfer-replay.ts`; confirm `report.md` / `transfer-report.md` are byte-identical to the committed files (they were on 2026-09-06). Keep copies in the scratchpad as the diff baseline.
- [x] 1.2 Run `npx tsx research/squad-eval/capture.ts` once and copy `research/squad-eval/pool/gwNN.csv` aside as the before-dump (same-window comparison for task 5.3). Skip if within 5h of a deadline — don't overwrite the scheduled capture.

## 2. Single source of truth for the lite tier

- [x] 2.1 `lib/pipeline/squad-ranker.ts`: delete `DEFAULT_LLM`; import and use `NEUTRAL_LLM_SIGNALS` from `./lite-scoring`.
- [x] 2.2 `lib/scout/context.ts`: delete `DEFAULT_LLM_SIGNALS`; use `NEUTRAL_LLM_SIGNALS` (spread copies where the code currently spreads).
- [x] 2.3 `lib/optimizer/restructure.ts`: replace the inline stats/fixture/market/composite block and inline LLM literal in `findCheapestReplacement` with a `scorePlayerLite(p, { fixtures, teams, currentGw, maxEpNext })` call; keep the `insufficientDataFallbackScore` filter and the price-ascending walk unchanged.
- [x] 2.4 Grep `lib/` for any remaining neutral-`LlmContextSignals` literal; there must be exactly one definition.

## 3. Remove the dead parameter

- [x] 3.1 `lib/pipeline/statistical-scoring.ts`: drop `_elementSummary?: ElementSummary` from `computeStatisticalSignals`; remove the now-unused `ElementSummary` import if any.
- [x] 3.2 `lib/pipeline/index.ts`: call `computeStatisticalSignals(player, currentGw)`; update the `lite-scoring.ts` doc comment that references the ignored summary so it states the tiers instead.
- [x] 3.3 `npx eslint lib/pipeline` shows no `_elementSummary` warning.

## 4. Label fidelity

- [x] 4.1 `lib/pipeline/types.ts`: add `export type ScoringFidelity = "full" | "lite" | "enriched"` and a required `fidelity: ScoringFidelity` on `ScoredPlayer`, with a doc comment defining each tier per the spec.
- [x] 4.2 Set `fidelity: "full"` in `lib/pipeline/index.ts` (`scorePlayer`) and `lib/pipeline/squad-ranker.ts` (`findCandidates`).
- [x] 4.3 Set `fidelity: "lite"` in `scorePlayerLite`.
- [x] 4.4 Set `fidelity: "enriched"` in `scorePlayerEnriched` (`lib/scout/context.ts`), including the degraded branches.
- [x] 4.5 Fix the two test files that build `ScoredPlayer` literals (`tsc` names them); add an assertion in `lib/__tests__/stress/property.test.ts` (or the nearest pipeline test) that pipeline output is `"full"` and `scorePlayerLite` output is `"lite"`.
- [x] 4.6 `lib/optimizer/restructure.ts`: at the dream-vs-replacement comparison, add the comment required by the spec (decision on `netEp`/`epNext`; composite only for `gw1Gain` ordering + fallback filter; tiers mixed: full vs lite).
- [x] 4.7 `research/squad-eval/capture.ts`: add a `fidelity` column to `POOL_COLUMNS` / `poolRow` (value from `sp.fidelity`). Harness only — outside the app build.

## 5. Prove invariance and close

- [x] 5.1 App gate: `npx tsc --noEmit`, `npx eslint`, `npx vitest run` all green.
- [x] 5.2 Re-run both replays; `diff` `report.md` and `transfer-report.md` against the task 1.1 baseline — must be byte-identical.
- [x] 5.3 Re-run `capture.ts` in the same window as task 1.2; for every element in both dumps, `composite` and all `sm_*` columns equal; the new `fidelity` column reads `full` on every row. (If the window moved, state `unavailable — feed moved` and rely on 5.2 plus a unit-level check that `scorePlayerLite` output equals the old inline block for a fixed `Player`.)
- [x] 5.4 Typecheck the research harness under the scratch research tsconfig (includes `research/squad-eval/*.ts` + `lib/**`).
- [x] 5.5 Append an as-built note to this file with the diff results and the before/after warning count; then archive via `/opsx:archive`.

> **As-built (2026-09-06):** behaviour-preserving, proven three ways — (1) `replay.ts` and `transfer-replay.ts` re-run after the change: `report.md` and `transfer-report.md` byte-identical to the pre-change baseline; (2) same-window GW4 capture before (19:13Z) and after (19:4xZ): 55/55 rows identical on `composite` and every `sm_*` column, new `fidelity` column = `full` on all rows; (3) new unit test asserts `scorePlayerLite` equals a direct neutral-context `computeCompositeScore` (the block `restructure.ts` used to inline). Gate: `tsc` clean, `eslint` 0 errors / 6 warnings (was 7 — the `_elementSummary` warning is gone), `vitest` 344/344 (48 files; +3 tests in `lib/__tests__/pipeline/scoring-fidelity.test.ts`); research harness typechecks. Scope grew by two constants the proposal missed: the literal-scan (task 2.4) also found the pipeline's own LLM fallback in `lib/pipeline/index.ts` and `DEFAULT_SIGNALS` in `lib/pipeline/llm-context.ts` — both now use `NEUTRAL_LLM_SIGNALS`. Its home stays `lite-scoring.ts` (dependency-free; `llm-context.ts` imports the LLM client, so the reverse direction would drag it into the offline replays). Six production construction sites labelled; the only default lives in the test factory (`makeScoredPlayer`, `fidelity ?? "full"`).
