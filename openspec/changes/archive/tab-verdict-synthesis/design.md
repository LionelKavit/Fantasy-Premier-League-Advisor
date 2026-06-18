# Design

## Context

The plan pipeline (`lib/plan`) already runs squad analysis → the optimizer (which deterministically computes `horizon`, `chipPlan`, `restructureOptions` before its LLM `synthesizeRecommendation` writes the weekly `narrativeSummary`) and the captain pipeline. The Long-Term tab currently renders a deterministic client summary (`lib/client/longTermSummary.ts`). This change adds a second, parallel LLM synthesis for the long-term verdict and exposes it on the plan.

## Key Decisions

### 1. Two parallel synthesis calls inside the optimizer stage
`runOptimizerWithContext` already has the deterministic node outputs (`horizon`, `chipPlan`, `restructureOptions`) when it calls the weekly synthesis. Add a second call, `synthesizeLongTerm`, and run both concurrently:
```
const [result, longTerm] = await Promise.all([
  synthesizeRecommendation(input),          // weekly verdict → OptimizerResult
  synthesizeLongTerm(longTermInput),         // long-term verdict → string | null
]);
return { ...result, longTermNarrative: longTerm };
```
No added wall-clock beyond the slower of the two calls.

### 2. Long-term verdict is plain prose, with a null fail-safe
`synthesizeLongTerm` prompts for a short **plain-English** paragraph (not JSON) covering: the strongest upcoming transfer target and its timing (BUY_NOW/WAIT/SELL_LATER), chip sequencing, and any restructure-toward-a-dream note — toned by the manager's `riskProfile`. The response **text is used directly**. On a missing key, API error, or empty content → returns `null`. When there is genuinely nothing to plan (no `horizon` entries **and** no `chipPlan`), it **skips the call** and returns `null` (saving a request) — the deterministic fallback supplies the reasoned empty-state sentence.

### 3. This-Week refinement is a prompt tweak only
`synthesizeRecommendation`'s input already includes `restructureOptions` and the hit result; the prompt is refined to instruct the model to weave restructure options and the hit verdict into the weekly narrative. No new data, no new call.

### 4. `longTermNarrative` on `OptimizerResult`; deterministic stays the fallback
Add `longTermNarrative: string | null` to `OptimizerResult` (it draws chiefly on optimizer outputs). `synthesizeRecommendation` sets it to `null` in both its success and fail-safe returns; `runOptimizerWithContext` overrides it with the parallel result. The frontend prefers it when non-null and otherwise calls the unchanged client-side `buildLongTermSummary`.

### 5. SDK deferred to Change B (refinement of the consolidation)
The Anthropic SDK is only needed for tool-use + streaming (Change B). Migrating the three existing synthesis call-sites to the SDK now would also force rewriting the global-`fetch` test mock (`lib/__tests__/mock-claude.ts`) and risk the 130-test suite for no Change-A benefit. So Change A keeps the existing raw-`fetch` pattern; Change B does the SDK adoption (and updates the mock) when it actually needs it.

## Files

```
lib/optimizer/types.ts              // + longTermNarrative: string | null on OptimizerResult
lib/optimizer/long-term-synthesis.ts // NEW: synthesizeLongTerm(input) — prose, fetch, null fail-safe
lib/optimizer/synthesis.ts          // set longTermNarrative: null in returns; refine weekly prompt (restructure + hit)
lib/optimizer/index.ts              // run synthesizeLongTerm in parallel; merge into the result
components/panel/ScoutVerdict.tsx   // long-term: prefer longTermNarrative, else buildLongTermSummary
lib/__tests__/optimizer/long-term-synthesis.test.ts  // NEW unit tests (mocked success / fail-safe / skip)
lib/__tests__/e2e/flow.test.ts      // assert transfers.longTermNarrative present (string | null)
```

## Reused
- The synthesis `fetch` + fail-safe pattern and model from `lib/optimizer/synthesis.ts`.
- `lib/client/longTermSummary.ts` (`buildLongTermSummary`) as the offline fallback (unchanged).
- The existing global-`fetch` mock (`mockClaudeSuccess/Error/Malformed`) — still valid since A stays on `fetch`.
