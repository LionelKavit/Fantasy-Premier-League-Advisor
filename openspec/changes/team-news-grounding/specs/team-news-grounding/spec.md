## ADDED Requirements

### Requirement: LLM context signals are grounded in real team news
The rotation/injury context signals SHALL be derived from fetched predicted-lineup / press-conference data, not only from FPL's terse `availability.news` field, while never breaking scoring when that data is unavailable.

#### Scenario: Team news is fetched and cached per gameweek
- **WHEN** the team-news layer runs for the current gameweek
- **THEN** it fetches the configured predicted-lineup / press-conference source(s), extracts structured news, and caches it keyed by gameweek with a TTL that expires near the deadline (mirroring the existing context cache)
- **AND** reads are served from cache; only a refresh triggers a new fetch/extraction

#### Scenario: News is fetched from a public, text-based source via a per-source adapter
- **WHEN** the layer fetches news
- **THEN** it pulls from **AllAboutFPL** (free, text-based predicted XIs + team news) via a per-source adapter, server-side HTTP GET → HTML → text
- **AND** it fetches **only publicly-reachable pages** — it MUST NOT authenticate, log in, or bypass any paywall/membership gate; respects `robots.txt`/ToS; uses a descriptive User-Agent; fetches at most once per gameweek (cached); attributes each fact with its `sourceUrl`; and a failed/blocked source is skipped without failing the run
- **AND** the adapter pattern allows adding sources later, but membership-gated or image-based sources (e.g. FFHub paywall, FFScout Lineup11 graphics) are excluded — gated pages are skipped and HTML→text cannot read formation images (OCR out of scope)

#### Scenario: Extraction produces a typed contract matched to FPL ids
- **WHEN** page text is extracted
- **THEN** it yields per player `{ startProbability (0–1), status, note, sourceUrl }` matched to FPL player ids by normalized name + team
- **AND** unmatched names are dropped and logged, never guessed

#### Scenario: Fetched content is treated as untrusted data
- **WHEN** the extraction LLM processes fetched page text
- **THEN** the prompt treats the text strictly as data — extracting the contract fields and ignoring any instructions, authority claims, or requests embedded in the content
- **AND** output that does not parse to the contract is discarded; fetched content can never alter app behavior beyond populating the news fields

#### Scenario: Signals are grounded, with rotationRisk anchored on start probability
- **WHEN** `batchComputeLlmContext` runs with team news available for a player
- **THEN** the player's `startProbability`, `status`, and `note` are added to its LLM context
- **AND** `rotationRisk` is set deterministically from `startProbability` (≈ `1 − startProbability`, clamped) when present, while the LLM still reasons the nuanced signals (`tacticalBoost`, `oopBonus`, `opponentKeyAbsence`, set-piece hierarchy) using the real note

#### Scenario: Graceful degradation
- **WHEN** the fetch/extraction fails, team news is missing, or a player is unmatched
- **THEN** the node falls back to today's behavior (FPL `availability.news` only) and scoring proceeds — grounding is strictly additive and never breaks the pipeline

#### Scenario: The lift is measurable
- **WHEN** grounding is live and `squad-eval-captain-live` runs at the deadline
- **THEN** its report quantifies the change vs the neutral-LLM floor (and vs the manager), since there is no historical backfill for press-conference state

#### Scenario: App build unaffected
- **WHEN** the change ships
- **THEN** `tsc` / `eslint` / `next build` / `vitest` stay clean, and `batchComputeLlmContext`'s new team-news parameter is optional (backward compatible with existing callers/tests)
