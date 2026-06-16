## ADDED Requirements

### Requirement: Vitest test runner
The project SHALL use Vitest for the offline backend suite, with scripts `test` (run once), `test:watch`, and `test:coverage`.

#### Scenario: Suite runs offline
- **WHEN** `npm test` is run with no network access and no real API keys
- **THEN** the entire offline suite executes and reports pass/fail without any FPL or Anthropic network calls

#### Scenario: Existing coherence harness migrated
- **WHEN** the suite runs
- **THEN** the triple-captain coherence assertions previously in `lib/__tests__/tc-coherence.test.ts` are present as Vitest tests and still pass

### Requirement: Synthetic fixture factories
The suite SHALL provide typed fixture builders with sensible defaults and shallow overrides, returning fully-typed objects (no `as unknown` casts in test bodies).

#### Scenario: Core builders exist
- **WHEN** a test needs domain objects
- **THEN** `makePlayer`, `makeScoredPlayer`, `makeTeam`, `makeFixture`, `makeGameweekFlags`, `makePick`, `makeSquadAnalysisResult`, `makeManagerProfile`, and `makeCaptainCandidate` are available and produce valid objects from partial overrides

#### Scenario: Scenario composers exist
- **WHEN** a test needs a non-trivial fixture state
- **THEN** helpers compose builders into scenarios: a double gameweek for given teams, a blank gameweek, an injured/suspended/doubtful player, and a budget-constrained squad

#### Scenario: Builders track type changes
- **WHEN** a domain type gains a required field
- **THEN** the factory fails to type-check until updated (fixtures cannot silently drift from the real types)

### Requirement: Claude API mock
The suite SHALL provide a helper to stub the Claude `fetch` boundary in three modes.

#### Scenario: Mocked success
- **WHEN** a test stubs a valid Anthropic response containing given JSON text
- **THEN** the synthesis/LLM-context code parses it and follows the success path (no fail-safe)

#### Scenario: Mocked API error
- **WHEN** a test stubs a non-200 response
- **THEN** the code under test takes its documented error/fail-safe path

#### Scenario: Mocked malformed response
- **WHEN** a test stubs a 200 response whose text is not valid/parseable JSON
- **THEN** the code under test takes its parse-failure/fail-safe path

#### Scenario: Key presence controlled per test
- **WHEN** a test exercises a success path
- **THEN** `ANTHROPIC_API_KEY` is set to a dummy value for that test, and unset for fail-safe tests, without leaking between tests

### Requirement: Determinism
#### Scenario: Stable reruns
- **WHEN** the suite is run multiple times
- **THEN** results are identical (no reliance on wall-clock, ordering of unordered data, or randomness); timestamp fields are excluded from equality assertions

### Requirement: Coverage threshold
The suite SHALL measure coverage for `lib/pipeline`, `lib/optimizer`, `lib/captain`, and `lib/plan` and enforce a minimum.

#### Scenario: Threshold enforced
- **WHEN** `npm run test:coverage` is run
- **THEN** coverage for the four backend directories is reported AND the run fails if it falls below the configured line/branch thresholds

### Requirement: Live smoke check separated
#### Scenario: Network test is opt-in
- **WHEN** `npm test` runs
- **THEN** the live FPL-API smoke check is NOT part of it; it exists as a separate, explicitly-invoked integration script
