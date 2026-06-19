## ADDED Requirements

### Requirement: Analysis context is cached and shared
The system SHALL cache the per-manager `AnalysisContext` in memory with a short TTL, and reuse it across the plan phases and the Scout chat.

#### Scenario: Context computed once within TTL
- **WHEN** `getCachedAnalysisContext(teamId)` is called twice within the TTL
- **THEN** the squad analysis runs once (the second call is served from cache)

#### Scenario: Scout chat reuses the same context
- **WHEN** the Scout chat builds its grounding context for a manager already analyzed for the plan (within TTL)
- **THEN** it reuses the cached `AnalysisContext` rather than recomputing it

#### Scenario: Invalidation forces recompute
- **WHEN** `invalidateAnalysisContext(teamId)` is called (e.g. Re-analyze)
- **THEN** the next `getCachedAnalysisContext(teamId)` recomputes fresh

#### Scenario: Failures are not cached
- **WHEN** building the context throws
- **THEN** nothing is cached, so the next call retries

### Requirement: LLM insights are cached per request signature
The system SHALL cache the insights result keyed by `team:gw:freeTransfers:horizon`, so repeat loads don't repay LLM latency.

#### Scenario: Repeat load is instant
- **WHEN** insights are requested again for the same key within the TTL
- **THEN** the cached result is returned without re-invoking the LLM syntheses

#### Scenario: Re-analyze bypasses the cache
- **WHEN** insights are requested with `force` (Re-analyze)
- **THEN** the syntheses run fresh and the cache entry is replaced
