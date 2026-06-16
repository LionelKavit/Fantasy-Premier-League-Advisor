## ADDED Requirements

### Requirement: MarketSignals type
The system SHALL define a `MarketSignals` interface with fields: `priceMovement` (number), `ownershipScore` (number, 0-1), `transferMomentum` (number, -1 to 1), `epNextSignal` (number, 0-1), `differentialValue` (number, 0-1).

### Requirement: Compute market signals
The system SHALL provide a `computeMarketSignals(player: Player): MarketSignals` function that computes market-related signals from the player's bootstrap data.

#### Scenario: Price movement computation
- **WHEN** a player has `costChangeEvent: 2` and `price: 10.0`
- **THEN** `priceMovement` is `2 / 10.0 = 0.2` (rising price signal)

#### Scenario: Negative price movement
- **WHEN** a player has `costChangeEvent: -1` and `price: 5.0`
- **THEN** `priceMovement` is `-1 / 5.0 = -0.2` (falling price signal)

#### Scenario: Ownership score
- **WHEN** a player has `selectedByPercent: 45.0`
- **THEN** `ownershipScore` is `0.45`

#### Scenario: Transfer momentum — net positive
- **WHEN** a player has `transfersInEvent: 50000` and `transfersOutEvent: 10000`
- **THEN** `transferMomentum` is `(50000 - 10000) / (50000 + 10000) = 0.667`

#### Scenario: Transfer momentum — net negative
- **WHEN** a player has `transfersInEvent: 5000` and `transfersOutEvent: 30000`
- **THEN** `transferMomentum` is `(5000 - 30000) / (5000 + 30000) = -0.714`

#### Scenario: Transfer momentum — no transfers
- **WHEN** a player has `transfersInEvent: 0` and `transfersOutEvent: 0`
- **THEN** `transferMomentum` is `0`

#### Scenario: Expected points signal — available
- **WHEN** a player has `epNext: 5.5` and the maximum expected points across all players is 12.0
- **THEN** `epNextSignal` is `5.5 / 12.0 = 0.458`

#### Scenario: Expected points signal — null
- **WHEN** a player has `epNext: null`
- **THEN** `epNextSignal` is `0.5` (neutral default)

#### Scenario: Differential value
- **WHEN** a player has `selectedByPercent: 2.5`
- **THEN** `differentialValue` is `1 - 0.025 = 0.975` (high differential potential)

#### Scenario: Template player differential
- **WHEN** a player has `selectedByPercent: 85.0`
- **THEN** `differentialValue` is `0.15` (low differential, owned by most managers)
