## ADDED Requirements

### Requirement: Captain and transfer narratives are grounded in expert rank/EO principles
Both the captain and transfer LLM syntheses SHALL load a curated `rank-strategy.md` and reason with it about effective ownership, template, and chase-vs-protect — while the deterministic picks and rank facts remain unchanged.

#### Scenario: Both syntheses load the rank-strategy knowledge
- **WHEN** `synthesizeCaptainPick` and `synthesizeRecommendation` build their prompts
- **THEN** each loads `lib/knowledge/rank-strategy.md` via the shared `loadKnowledge` loader and includes it as expert-principle context, alongside the rank facts they already pass (`riskProfile`, `effectiveOwnership`, `differentialOption`)
- **AND** the structured outputs (captain pick, transfer recommendation) are unchanged — only the prose reasoning deepens

#### Scenario: rank-strategy.md encodes EO/chase-vs-protect principles
- **WHEN** `rank-strategy.md` is authored
- **THEN** it covers effective ownership (captaining high-EO protects rank, a differential is a rank gamble; captaincy is the biggest EO lever), the template (covering it limits downside), and **continuous** chase-vs-protect that scales with the rank gap and gameweeks remaining — not a fixed switch
- **AND** it contains durable principles with no dated/season-specific facts

#### Scenario: Reasoning scales with the manager's situation
- **WHEN** the manager is falling in rank with a large gap and few gameweeks left
- **THEN** the narrative leans toward justified differentials (with the why); when rank is strong/rising it leans toward template/safe — a continuous judgment, not the prior 3-way switch alone

#### Scenario: App build unaffected
- **WHEN** the change ships
- **THEN** `tsc` / `eslint` / `next build` / `vitest` stay clean, both narratives are still produced, and `rank-strategy.md` is repo-authored trusted content (no untrusted-input hardening)
