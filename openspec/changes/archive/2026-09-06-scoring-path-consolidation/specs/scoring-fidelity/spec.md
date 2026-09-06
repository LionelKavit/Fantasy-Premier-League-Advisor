## ADDED Requirements

### Requirement: Every scored player declares its fidelity tier
Every `ScoredPlayer` the system constructs SHALL carry a `fidelity` value of exactly one of `"full"` (element-summary trend + batched LLM context), `"enriched"` (lazily fetched trend + single-player LLM context, possibly degraded to neutral on failure), or `"lite"` (neutral trend + neutral LLM context). The field SHALL be required by the type so an unlabelled constructor fails compilation.

#### Scenario: Pipeline output is labelled full
- **WHEN** `runSquadAnalysisPipeline` scores the squad and the candidate pool
- **THEN** every `ScoredPlayer` in `rankedSquad`, in `weakSpots[].targets[].candidate`, and in `scoredCandidatePool` has `fidelity === "full"`

#### Scenario: Lite scorer output is labelled lite
- **WHEN** `scorePlayerLite` scores a player
- **THEN** the returned `ScoredPlayer` has `fidelity === "lite"`, `trendSignals === null`, and `llmSignals` equal to the shared neutral constant

#### Scenario: Scout enrichment is labelled enriched even when degraded
- **WHEN** `scorePlayerEnriched` scores a player whose element-summary fetch or LLM pass fails
- **THEN** the returned `ScoredPlayer` still has `fidelity === "enriched"` (the tier names the attempt, and the degraded inputs are visible as `trendSignals === null` and/or neutral `llmSignals`)

### Requirement: The lite tier has exactly one implementation
There SHALL be one function that produces a lite-tier score (`scorePlayerLite`) and one neutral-LLM placeholder constant (`NEUTRAL_LLM_SIGNALS`), and every path that scores with neutral trend and neutral LLM context SHALL call them rather than re-implement them.

#### Scenario: Restructure replacement search uses the shared lite scorer
- **WHEN** `findCheapestReplacement` scores a candidate replacement
- **THEN** the score is produced by `scorePlayerLite`, and the resulting `score.total` is bit-identical to the value the previous inline implementation produced for the same inputs

#### Scenario: No duplicate neutral constant remains
- **WHEN** the codebase is searched for object literals whose shape is the neutral `LlmContextSignals` (all numeric fields 0, all set-piece roles null)
- **THEN** the only definition is `NEUTRAL_LLM_SIGNALS` in `lib/pipeline/lite-scoring.ts`; `squad-ranker.ts`, `scout/context.ts`, and `optimizer/restructure.ts` reference it

### Requirement: The statistical scorer's signature reflects its inputs
`computeStatisticalSignals` SHALL accept only the inputs it reads (`player`, `currentGw`). It SHALL NOT declare an element-summary parameter.

#### Scenario: Signature and callers agree
- **WHEN** `computeStatisticalSignals` is called from any path (pipeline, candidate search, lite scorer, scout enrichment)
- **THEN** every call passes exactly `(player, currentGw)`, the function has no unused parameter, and its output for a given player is identical to the pre-change output regardless of whether that caller previously passed an element summary

### Requirement: Mixed-tier comparisons are explicit and do not drive decisions
Where the system compares scored players of different fidelity tiers, the comparison site SHALL state which tiers are being mixed and SHALL NOT let the tier difference change a recommendation.

#### Scenario: Restructure chains decide on ep_next, not composite
- **WHEN** `findRestructureCandidates` evaluates a chain whose dream target is `"full"` and whose downgrade replacement is `"lite"`
- **THEN** `netEp` is computed from `epNext` alone (identical across tiers), the composite difference is used only for display ordering (`gw1Gain`) and the `insufficientDataFallbackScore` eligibility filter, and a comment at the comparison site records this

### Requirement: Consolidation is behaviour-preserving and proven so
The change SHALL NOT alter any ranking, recommendation, weight, squash, threshold, or candidate pool, and the invariance SHALL be demonstrated by re-running the offline replays and a live capture.

#### Scenario: Replays are byte-identical
- **WHEN** `research/squad-eval/replay.ts` and `research/squad-eval/transfer-replay.ts` are re-run after the change against the unchanged 2025-26 cache
- **THEN** `report.md` and `transfer-report.md` are byte-identical to their committed versions

#### Scenario: Live capture composites are unchanged
- **WHEN** `research/squad-eval/capture.ts` is run before and after the change within the same gameweek window
- **THEN** for every player present in both pool dumps, `composite` and every `sm_*` column are equal, and the after-dump carries a `fidelity` column whose value is `"full"` for every row

#### Scenario: App gate is green
- **WHEN** `tsc --noEmit`, `eslint`, and `vitest run` are executed
- **THEN** all pass, and the previous `no-unused-vars` warning for `_elementSummary` is gone
