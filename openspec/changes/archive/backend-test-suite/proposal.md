# Backend Test Suite

## Why

The backend is analytically complete (squad analysis → optimizer + captain → unified `/api/plan`), but its verification so far has leaned on live calls to the FPL API. That data is from **GW38 of a finished season**, which makes whole branches of the logic unreachable by live testing:

- **No double/blank gameweeks** → DGW/BGW fixture handling, bench-boost/free-hit/triple-captain triggers, captain DGW multipliers, and horizon fixture-swing/timing classification are never exercised.
- **Chips already spent and rank static** → wildcard/free-hit/bench-boost/triple-captain triggers and risk-aware (rising/falling rank) synthesis branches never fire.
- **No budget-constrained or injured/suspended squads on demand** → restructure chains, double-hit budget simulation, club-rule edges, and the minutes-certainty gate are only partially covered.
- **No Claude API key** → only the deterministic fail-safe path is ever taken; the LLM prompt-building, response parsing, schema validation, and alert-merging paths are completely untested.

We already hit this wall with triple-captain coherence and had to write a synthetic harness to prove it. That harness is the seed; this change generalizes it into a real, comprehensive suite so the backend is fool-proof before any frontend work.

## What Changes

- **New capability `test-harness`** — adopt Vitest; build synthetic fixture factories (players, scored players, fixtures, gameweek flags, squads, manager profiles) and a Claude API mock so success/parse/validation paths are testable offline and deterministically. Migrate the existing `tc-coherence` harness into it.
- **New capability `squad-analysis-coverage`** — normalization bounds, statistical signals (incl. minutes/suspension boundaries), trend classification, fixture signals with BGW/DGW, market signals, composite scoring fallback, ranking and candidate finding.
- **New capability `optimizer-coverage`** — validate/build transfers, single (incl. ROLL and 2-FT budget cascade), hits (single/double budget-chain + ordering + club rule), restructure chains, horizon timing classifications, chip triggers, and synthesis (mocked success + parse failure + fail-safe).
- **New capability `captain-coverage`** — ceiling-vs-floor ranking, minutes-certainty gate, DGW multiplier, blank handling, vice-in-different-match, differential surfacing, horizon, triple-captain advice, and synthesis (mocked + fail-safe).
- **New capability `plan-resilience-coverage`** — single-analysis-pass guarantee, parallel fan-out, partial-failure isolation (fault injection), and standalone-route equivalence.
- **New capability `end-to-end-flow`** — drives the real pipelines with the FPL fetchers and Claude boundary mocked to prove the system understands a user request, that data flows API → squad analysis → optimizer + captain → final `GameweekPlan`, and that the output is **personalized** to the requested manager (their weak spots, bank, chips, XI, risk profile).
- **New capability `stress-property-coverage`** — large/boundary inputs, malformed LLM payloads, and invariant/property checks (scores in range, no crashes, deterministic outputs).
- **Tooling:** `vitest` devDependency; `npm test` / `test:watch` / `test:coverage` scripts; a coverage threshold for the four backend lib dirs.

## Goal & Non-Goals

**Goal:** every backend branch reachable by construction is covered by a deterministic, offline test; the LLM-dependent paths are covered via mocking; resilience is proven by fault injection; and end-to-end tests prove a user's request flows from the API through every node into a personalized final output. A measurable coverage threshold guards against regressions.

**Non-goals:** no frontend tests; no change to production pipeline behavior (this change adds tests and fixtures only — any bug a test uncovers is fixed under its own follow-up). The existing live-API smoke check is retained but kept separate from the offline unit suite.
