## ADDED Requirements

### Requirement: FixtureSignals type
The system SHALL define a `FixtureSignals` interface with fields: `fdrScore` (number, 0-1), `homeRatio` (number, 0-1), `dgwBonus` (number), `opponentStrength` (number, 0-1), `gw1Fdr` (number, 1-5), `gw5AvgFdr` (number), `hasBgw` (boolean), `hasDgw` (boolean).

### Requirement: Compute fixture signals
The system SHALL provide a `computeFixtureSignals(player: Player, fixtures: Fixture[], teams: Team[], currentGwId: number): FixtureSignals` function that evaluates upcoming fixture difficulty for a player's team. The function SHALL reuse `computeFdrRun` and `getPlayerFixtures` from `lib/gameweek.ts`.

#### Scenario: FDR score computation
- **WHEN** a team has FDR run [2, 2, 3, 2, 1] over the next 5 GWs
- **THEN** avgFdr is 2.0 and `fdrScore` is `1 - ((2.0 - 1) / 4) = 0.75`

#### Scenario: FDR score for hardest fixtures
- **WHEN** a team has FDR run [5, 5, 5, 5, 5]
- **THEN** avgFdr is 5.0 and `fdrScore` is `1 - ((5.0 - 1) / 4) = 0.0`

#### Scenario: FDR score for easiest fixtures
- **WHEN** a team has FDR run [1, 1, 1, 1, 1]
- **THEN** avgFdr is 1.0 and `fdrScore` is `1.0`

#### Scenario: Home ratio computation
- **WHEN** a player has 3 home fixtures and 2 away fixtures in the next 5 GWs
- **THEN** `homeRatio` is `0.6`

#### Scenario: DGW bonus
- **WHEN** a team has a double gameweek within the next 5 GWs
- **THEN** `dgwBonus` is `0.10` per DGW (capped at 1.0)
- **AND** `hasDgw` is `true`

#### Scenario: BGW penalty
- **WHEN** a team has a blank gameweek within the next 5 GWs (no fixture)
- **THEN** that GW is excluded from FDR averaging
- **AND** `hasBgw` is `true`

#### Scenario: Opponent strength for attackers (FWD/MID)
- **WHEN** scoring a FWD or MID player with upcoming opponents
- **THEN** `opponentStrength` is computed from opponents' defensive strength (`strength_defence_home` for away fixtures, `strength_defence_away` for home fixtures), normalized to 0-1 where weaker defenses = higher score

#### Scenario: Opponent strength for defenders (DEF/GK)
- **WHEN** scoring a DEF or GK player with upcoming opponents
- **THEN** `opponentStrength` is computed from opponents' attacking strength (`strength_attack_home` for away fixtures, `strength_attack_away` for home fixtures), normalized to 0-1 where weaker attacks = higher score

#### Scenario: GW1 FDR
- **WHEN** a player's immediate next fixture has FDR 2
- **THEN** `gw1Fdr` is `2`

#### Scenario: No upcoming fixtures
- **WHEN** a player's team has no fixtures in the next 5 GWs (relegated or end of season)
- **THEN** `fdrScore` is `0`, `gw1Fdr` is `5`, `homeRatio` is `0`
