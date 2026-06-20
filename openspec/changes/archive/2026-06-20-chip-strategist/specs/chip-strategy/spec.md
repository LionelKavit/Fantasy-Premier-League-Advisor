## ADDED Requirements

### Requirement: The long-term chip narrative is grounded in curated expert knowledge
The long-term narrative SHALL reason about chips using a curated `chips.md` knowledge file loaded into its prompt, while the structured chip timeline remains deterministic and unchanged.

#### Scenario: A knowledge loader provides chips.md to the narrative
- **WHEN** `synthesizeLongTerm` builds its prompt
- **THEN** it loads `lib/knowledge/chips.md` (via a small cached loader in `lib/knowledge/`) and includes it as expert-principle context alongside the deterministic facts it already receives (`chipsRemaining`, `chipRecommendations`, `currentGw`, horizon)
- **AND** the narrative still returns prose (no schema change)

#### Scenario: chips.md encodes the 2025/26 two-halves rule
- **WHEN** `chips.md` is authored
- **THEN** it states the authoritative rule — 8 chips (one of each per half), the **first set expires at the GW19 deadline** and does not carry over, the second set unlocks GW20, one chip per gameweek — and the canonical per-half timing (Wildcard before the fixture swing, Bench Boost on a DGW, Free Hit on a blank, Triple Captain on a premium's DGW)
- **AND** dated season-specific facts (e.g. the GW19 date) are kept in a clearly-labelled section for easy seasonal update
- **AND** the content is drawn from the cited sources (Premier League rules, FPL Copilot, FFScout 16-scenario guide)

#### Scenario: The structured timeline stays deterministic
- **WHEN** the change ships
- **THEN** `chipPlan` / ChipTimeline is unchanged (still `evaluateChipInteractions`); only the narrative is grounded
- **AND** `chips.md` is repo-authored trusted content, so no untrusted-input hardening is required

#### Scenario: App build unaffected
- **WHEN** the change ships
- **THEN** `tsc` / `eslint` / `next build` / `vitest` stay clean, `longTermNarrative` is still produced, and the loader resolves the markdown file at runtime (or falls back to an embedded string if bundling drops the file)
