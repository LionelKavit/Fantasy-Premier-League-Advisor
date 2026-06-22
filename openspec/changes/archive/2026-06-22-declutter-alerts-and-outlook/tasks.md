## Tasks

> Two independent cuts that can land together. No new LLM calls; one is removed.
>
> Status: implemented on branch `claude/musing-hoover-ef5e36`. `tsc` clean, `eslint` 0 errors (6 pre-existing warnings elsewhere), `vitest` 232 passed. New `lib/alerts.ts` (`computeRiskAlerts`) is called in `computeInsights` and leads `plan.alerts`; both syntheses now emit `alerts: []` on success (fail-safe system notices kept). Deleted: `lib/optimizer/long-term-synthesis.ts`, `components/panel/ScoutVerdict.tsx`, `lib/client/longTermSummary.ts` (+ the long-term-synthesis test).
>
> Note (accepted consequence): the chip-timing expert grounding (`chips.md`) was consumed **only** by the removed long-term narrative, so it is no longer surfaced in the app. The deterministic Chip Strategy timeline (`LongTermDetail`) still conveys chip plans; `chips.md` + `loadKnowledge` remain (still tested) but are unused at runtime.

> ✅ Tasks 1–5 complete.

### Task 1: Curate the alert set (deterministic, allowlist)
**Capability:** alerts
**Files:** `lib/alerts.ts` (new, optional), `lib/optimizer/synthesis.ts`, `lib/captain/synthesis.ts`

Stop surfacing the free-form LLM `raw.alerts`. Reduce the deterministic alerts to the risk allowlist: starting-XI availability (doubtful/injured/suspended; captain & vice first), imminent price change on an owned player or recommended target, suspension risk. Drop "multiple weak spots" and any strategic/advisory lines. Keep the system/degradation notices (pipeline failure, "AI synthesis unavailable"). Optionally centralize as `computeRiskAlerts(ctx)`.

### Task 2: Alerts card — cap, order, empty-state note
**Capability:** alerts
**File:** `components/panel/AlertsCard.tsx`

Dedupe (already a `Set`), order by severity, cap at ~4. Always render the card; when there are no curated alerts, show a muted note ("No alerts — nothing flagged that isn't already covered above").

### Task 3: Remove the long-term outlook prose from the tab
**Capability:** long-term-outlook
**File:** `components/panel/FullBreakdown.tsx`

Remove the `<ScoutVerdict tab="long-term">` block; the Long Term view renders only `LongTermDetail` (Transfer Horizon + Chip Strategy).

### Task 4: Drop the long-term LLM call + plumbing
**Capability:** long-term-outlook
**Files:** `lib/optimizer/index.ts`, `lib/optimizer/types.ts`, `lib/optimizer/long-term-synthesis.ts` (delete), `components/panel/ScoutVerdict.tsx` (delete), `lib/client/longTermSummary.ts` (delete)

Remove the `synthesizeLongTerm` branch from the `Promise.all` in `runOptimizerWithContext`; return the weekly `result` unchanged. Delete `longTermNarrative` from `OptimizerResult` and the `synthesizeLongTerm` module. Delete the now-unused `ScoutVerdict` + `buildLongTermSummary`. Verify nothing else references `longTermNarrative`.

### Task 5: Tests + verify
- Alert builder: starter doubtful → alert; bench doubtful → none; owned price-drop / target price-rise → alert; LLM `raw.alerts` + "multiple weak spots" → never surfaced; dedupe + cap; empty → note.
- Optimizer: `OptimizerResult` has no `longTermNarrative`; remove/retire the long-term-synthesis test; existing weekly-synthesis + deterministic tests stay green.
- `npx tsc --noEmit`, `eslint .`, `vitest` green. Verify in-app: Long Term tab is structured-only; alerts show ≤4 curated risks or the empty note.

## Verification
- In the running app (off-season GW38), the Alerts card should collapse from ~7 lines to the genuine risks (or the empty note), and the Long Term tab should no longer show the outlook paragraph.
