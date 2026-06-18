## Tasks

**Status: ✅ Complete.** Added `OptimizerResult.longTermNarrative`, a parallel `synthesizeLongTerm` (prose, null fail-safe, skip-when-empty), the This-Week prompt refinement (restructure + hit), and the frontend fallback (`longTermNarrative` → else deterministic). Verified in-browser (offline → deterministic fallback renders); LLM-prose path covered by mocked unit tests. tsc + lint (0 errors) + build clean; **135 tests pass** (+5). Stayed on raw `fetch` — SDK adoption moved to Change B.

> Backend synthesis + minimal frontend wiring. Stays on the existing raw-`fetch` LLM pattern (SDK adoption is Change B). Degrades to the deterministic summary offline.

### Task 1: Add the field
**Capability:** long-term-verdict
**File:** `lib/optimizer/types.ts`

Add `longTermNarrative: string | null` to `OptimizerResult`.

### Task 2: Long-term synthesis
**Capability:** long-term-verdict
**File:** `lib/optimizer/long-term-synthesis.ts` (new)

`synthesizeLongTerm(input)` → `Promise<string | null>`. Build a prompt from `horizon` + `chipPlan` + `restructureOptions` + `chipsRemaining` + `currentGw` + `riskProfile`; request a short plain-prose paragraph; use the response text directly. Return `null` on missing key / error / empty, and **skip the call** (return `null`) when there's no horizon and no chip plan. Mirror the fetch + fail-safe pattern in `synthesis.ts`.

### Task 3: Wire it in parallel
**Capability:** long-term-verdict
**File:** `lib/optimizer/index.ts`

In `runOptimizerWithContext`, run `synthesizeLongTerm` concurrently with `synthesizeRecommendation` (`Promise.all`) and merge the result onto the returned `OptimizerResult` as `longTermNarrative`. Ensure `synthesizeRecommendation` sets `longTermNarrative: null` in its success and fail-safe returns so the type is satisfied before the merge.

### Task 4: Refine the This-Week prompt
**Capability:** long-term-verdict
**File:** `lib/optimizer/synthesis.ts`

Adjust the weekly prompt to instruct the model to weave `restructureOptions` and the hit verdict into the narrative. No new data or call.

### Task 5: Frontend rendering
**Capability:** verdict-rendering
**File:** `components/panel/ScoutVerdict.tsx`

For the long-term lens, render `plan.transfers?.longTermNarrative` when non-null (split into paragraphs); otherwise fall back to `buildLongTermSummary(plan)`. This-Week branch unchanged.

### Task 6: Tests + verify
- `lib/__tests__/optimizer/long-term-synthesis.test.ts`: mocked success → returns prose; missing key / error → `null`; no-horizon-and-no-chips → `null` without a fetch call.
- `lib/__tests__/e2e/flow.test.ts`: assert `plan.transfers.longTermNarrative` is present (string | null).
- `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm test` all clean.
