# Design Decisions

## 1. Pure functions over stateful nodes
Each node is a pure function with typed input and typed output. No shared mutable state between nodes. The orchestrator calls nodes in sequence (setup → parallel evaluation → chip interaction → synthesis). Only the synthesis node calls the LLM.

## 2. Budget chain simulation for double hits
For double hit evaluation, simulate transfer 1 first (sell weak player A, buy candidate A, update bank), then validate transfer 2 against the post-transfer-1 state. Try both orderings and pick the one with higher combined net gain. This prevents invalid states where two transfers look affordable individually but not sequentially.

## 3. Restructure search space limited to ranked 4th–15th
Only consider downgrading non-weakest squad members. The replacement for the downgraded player must have composite score ≥ 0.3 (the insufficient-data fallback) and be available. This caps the search at ~11 players × a small pool of cheap replacements.

## 4. Horizon rescoring reuses existing composite scorer
Re-score each candidate at GW+1 through GW+5 by calling `computeFixtureSignals` with a shifted `currentGwId`, then `computeCompositeScore` with the updated fixture signals. All other signals (statistical, trend, market, LLM) remain constant — only the fixture outlook changes.

## 5. Synthesis node fail-safe
If the Claude API call fails or returns unparseable JSON, return the single-transfer node's `bestSingle` as the primary recommendation with `confidence: "low"` and an alert explaining that LLM synthesis was unavailable. The pipeline never throws — it always returns a valid `OptimizerResult`.

## 6. Free transfers as API input
The number of free transfers (1 or 2) is accepted via the API parameter, not derived from history. This matches the existing `/api/squad` route convention.
