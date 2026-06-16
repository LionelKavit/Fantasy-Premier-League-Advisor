## ADDED Requirements

### Requirement: ValidTransfer type
The system SHALL define a `ValidTransfer` interface with fields: `weakPlayer` (ScoredPlayer), `candidate` (ScoredPlayer), `priceDelta` (number — candidate.price minus weak.price), `gw1Gain` (number), `gw5Gain` (number), `scoreDiffPct` (number — percentage improvement of candidate over weak player).

### Requirement: TransferAction type
The system SHALL define a `TransferAction` interface with fields: `type` (`"FREE" | "HIT_SINGLE" | "HIT_DOUBLE" | "ROLL" | "WILDCARD" | "FREE_HIT"`), `transfers` (ValidTransfer[]), `netPointsCost` (number — 0, -4, or -8), `netGain` (number — sum of gw1Gains minus netPointsCost), `breakEvenGw` (number | null — gameweek when cumulative gain offsets hit cost).

### Requirement: SingleTransferResult type
The system SHALL define a `SingleTransferResult` interface with fields: `bestSingle` (ValidTransfer | null), `bestSecond` (ValidTransfer | null — second free transfer when freeTransfers is 2, must target a different weak player than bestSingle), `alternatives` (ValidTransfer[] — up to 3), `savingsOption` (ValidTransfer | null — cheaper transfer that frees budget), `rollReason` (string | null — explanation when ROLL is recommended).

### Requirement: HitRecommendation type
The system SHALL define a `HitRecommendation` interface with fields: `transfers` (ValidTransfer[]), `netGain` (number), `breakEvenGw` (number | null).

### Requirement: HitTransferResult type
The system SHALL define a `HitTransferResult` interface with fields: `singleHit` (HitRecommendation | null), `doubleHit` (HitRecommendation | null).

### Requirement: RestructureOption type
The system SHALL define a `RestructureOption` interface with fields: `dreamTarget` (ValidTransfer — the aspirational transfer), `downgradedPlayer` (ScoredPlayer — the squad member being downgraded), `downgradeReplacement` (ScoredPlayer — the cheaper player replacing the downgrade), `fundingChain` (ValidTransfer[] — ordered transfers to execute), `netScoreChange` (number — net composite score change across both moves), `totalCost` (number — hit points taken, 0 if within free transfers).

### Requirement: HorizonEntry type
The system SHALL define a `HorizonEntry` interface with fields: `candidate` (ScoredPlayer), `weakPlayer` (ScoredPlayer), `gwScores` ({ gw: number, candidateScore: number, weakScore: number, fdr: number }[] — GW+1 through GW+5), `cumulativeGain` (number[] — running sum of per-GW gain), `fixtureSwing` (boolean — true if gain changes sign within window), `timing` (`"BUY_NOW" | "WAIT" | "BUY_NOW_SELL_LATER"`).

### Requirement: ChipRecommendation type
The system SHALL define a `ChipRecommendation` interface with fields: `chip` (`"wildcard" | "freeHit" | "benchBoost" | "tripleCaptain"`), `triggerGw` (number — gameweek to activate), `reason` (string), `alteredTransfers` (TransferAction | null — how the chip changes the transfer recommendation).

### Requirement: OptimizerResult type
The system SHALL define an `OptimizerResult` interface with fields: `primaryRecommendation` (TransferAction), `secondaryRecommendation` (TransferAction | null), `hitVerdict` ({ recommended: boolean, reasoning: string, breakEvenGw: number | null }), `chipPlan` (ChipRecommendation[]), `restructureOptions` (RestructureOption[]), `horizon` (HorizonEntry[]), `alerts` (string[]), `confidence` (`"high" | "medium" | "low"`), `narrativeSummary` (string — LLM-generated plain-English explanation), `generatedAt` (string — ISO timestamp).

### Requirement: SynthesisInput type
The system SHALL define a `SynthesisInput` interface bundling all prior node outputs: `analysis` (SquadAnalysisResult), `managerProfile` (ManagerProfile), `validTransfers` (ValidTransfer[]), `singleResult` (SingleTransferResult), `hitResult` (HitTransferResult), `restructureOptions` (RestructureOption[]), `horizon` (HorizonEntry[]), `chipRecommendations` (ChipRecommendation[]), `freeTransfers` (number).
