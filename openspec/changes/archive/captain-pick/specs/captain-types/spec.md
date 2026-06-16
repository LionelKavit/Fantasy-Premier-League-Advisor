## ADDED Requirements

### Requirement: CaptainSignals type
The system SHALL define a `CaptainSignals` interface capturing the captaincy-specific signal breakdown for one player in one gameweek: `baseProjection` (number — expected points this GW), `ceilingBoost` (number — explosiveness premium from goal threat / penalty duty / shots), `fixtureMultiplier` (number — this-GW FDR and home/away adjustment), `minutesCertainty` (number in [0,1] — multiplicative start gate), `dgwMultiplier` (number — ≥ 1, applied for double fixtures), `formSignal` (number).

### Requirement: CaptainScore type
The system SHALL define a `CaptainScore` interface: `total` (number — final captaincy score for the gameweek), `breakdown` (Record<string, number>), `isDgw` (boolean), `gameweek` (number).

### Requirement: CaptainCandidate type
The system SHALL define a `CaptainCandidate` interface: `player` (ScoredPlayer), `captainScore` (CaptainScore), `effectiveOwnership` (number — selected-by % weighted by captaincy share where available, else selected-by %), `isDifferential` (boolean — effectiveOwnership below the differential threshold), `whyCaptain` (string[] — human-readable reasons).

### Requirement: CaptainResult type
The system SHALL define a `CaptainResult` interface: `captain` (CaptainCandidate), `viceCaptain` (CaptainCandidate | null), `differentialOption` (CaptainCandidate | null), `rankedCandidates` (CaptainCandidate[] — full XI ranking), `tripleCaptainAdvice` (TripleCaptainAdvice | null), `confidence` (`"high" | "medium" | "low"`), `narrativeSummary` (string), `alerts` (string[]), `currentGw` (number), `generatedAt` (string).

### Requirement: HorizonCaptainEntry type
The system SHALL define a `HorizonCaptainEntry` interface for a single future gameweek: `gameweek` (number), `bestCaptain` (CaptainCandidate), `bestScore` (number), `isDgw` (boolean).

### Requirement: TripleCaptainAdvice type
The system SHALL define a `TripleCaptainAdvice` interface: `recommended` (boolean), `targetGw` (number | null), `targetPlayer` (string | null), `peakScore` (number), `baselineScore` (number — best captain score in a normal week), `reasoning` (string).

### Requirement: CaptainSynthesisInput type
The system SHALL define a `CaptainSynthesisInput` interface bundling node outputs for the LLM: `rankedCandidates` (CaptainCandidate[]), `viceCaptain` (CaptainCandidate | null), `differentialOption` (CaptainCandidate | null), `horizon` (HorizonCaptainEntry[]), `tripleCaptainAdvice` (TripleCaptainAdvice | null), `managerProfile` (ManagerProfile), `currentGw` (number).
