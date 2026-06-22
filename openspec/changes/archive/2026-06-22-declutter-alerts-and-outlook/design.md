# Design

## Context

- **Alerts** are merged in [AlertsCard.tsx](../../../components/panel/AlertsCard.tsx) from three sources and rendered verbatim. Each synthesis builds its list in `buildAlerts(...)` as `[...llmAlerts, ...deterministic]`, where `llmAlerts = raw.alerts` from the model ([lib/optimizer/synthesis.ts](../../../lib/optimizer/synthesis.ts), [lib/captain/synthesis.ts](../../../lib/captain/synthesis.ts)). The verbose, redundant lines the user sees are those LLM alerts; the deterministic ones (price-rise, doubtful, "multiple weak spots") are terser but mixed in.
- **The long-term outlook** prose is `<ScoutVerdict tab="long-term">` rendered above `LongTermDetail` in [FullBreakdown.tsx](../../../components/panel/FullBreakdown.tsx). It reads `transfers.longTermNarrative`, produced by `synthesizeLongTerm` — a parallel, display-only LLM call ([lib/optimizer/index.ts:91](../../../lib/optimizer/index.ts)) whose output is attached but never fed back into any decision.

## Key Decisions

### 1. Alerts are deterministic and code-authored — no LLM
Alert sentences are template strings interpolated from squad data (the way the current deterministic flags already work), not model output. This is the whole point: an alert must be a hard, checkable risk, not commentary. Benefits: terse, consistent, instant, un-paddable, never hallucinated. The free-form LLM `raw.alerts` are dropped from the alert surface (their judgment lives in the brief/verdict).

### 2. A small risk allowlist — "high-risk and overlookable", severity-ordered, capped
Only these qualify, computed from the analysis:
- **Availability** — a **starting-XI** player whose status is doubtful/injured/suspended or `chanceOfPlayingNext` is below a threshold; captain & vice rank highest (a blank captain with no recovery GW is the worst case).
- **Imminent price change** — a player you **own** (sell-before-drop) or a **recommended target** (buy-before-rise) with strong `marketSignals.transferMomentum`.
- **Suspension risk** — a booking from a ban, where a signal supports it.
Dropped: advisory/strategic items ("multiple weak spots at FWD", chip-usage reminders, "template captaincy is paramount", "final gameweek" notes) — all covered by the brief, This Week, or the chip-strategy panel. Deduped (already a `Set`) and **capped to ~4**, ordered by severity.

### 3. Keep system / degradation notices
Pipeline-failure and "AI synthesis unavailable — API key not set" lines are not redundant — they tell the user the AI layer is off. They stay (they come from the fail-safe paths, not `buildAlerts`'s `llmAlerts`).

### 4. Empty alerts → a note, always-rendered card
`AlertsCard` no longer returns `null` when empty; it renders a single muted line, e.g. "No alerts — nothing flagged that isn't already covered above." This reassures the user the section ran and found nothing, rather than silently vanishing.

### 5. Long-term outlook prose removed; the Long Term tab is structured-only
Drop the `<ScoutVerdict tab="long-term">` block from `FullBreakdown`. The tab now shows just **Transfer Horizon** + **Chip Strategy** (`LongTermDetail`, unchanged).

### 6. Remove `synthesizeLongTerm` + `longTermNarrative` — display-only, zero reasoning impact
`synthesizeLongTerm` runs in parallel with the weekly verdict and only its prose was consumed (by the now-removed UI). Removing it: drop the call from `runOptimizerWithContext`, delete `longTermNarrative` from `OptimizerResult`, delete `lib/optimizer/long-term-synthesis.ts`. The weekly verdict (`synthesizeRecommendation`) and every deterministic decision are untouched — verified: nothing reads `longTermNarrative` except the UI. Net: one fewer LLM call per analysis. `ScoutVerdict` and `lib/client/longTermSummary.ts` become unused and are deleted as cleanup.

## Design constraints

- **No LLM in the alert path** — alerts are pure functions of the analysis data.
- **Grounded, never invented** — alert numbers (price, % chance) come straight from the data.
- **No decision touched** — removing `longTermNarrative` must not alter the optimizer/captain/scoring outputs; only the parallel prose call goes.
- **Cap + dedupe** — at most ~4 alerts, severity-ordered, no near-duplicates.
- **Always render the card** — empty becomes a note, not a hidden section.

## Files (indicative)

```
components/panel/AlertsCard.tsx          // always render + empty note + cap/dedupe; render only curated risk + system notices
lib/alerts.ts                            // (new, optional) computeRiskAlerts(analysisContext) — the deterministic allowlist
lib/optimizer/synthesis.ts               // buildAlerts: drop llmAlerts + "multiple weak spots"; keep/curate price + doubtful (or defer to lib/alerts)
lib/captain/synthesis.ts                 // buildAlerts: drop llmAlerts; keep captain-specific availability risk
lib/optimizer/index.ts                   // remove the synthesizeLongTerm Promise.all branch; return result as-is
lib/optimizer/types.ts                   // remove longTermNarrative from OptimizerResult
lib/optimizer/long-term-synthesis.ts     // deleted
components/panel/FullBreakdown.tsx        // remove the <ScoutVerdict tab="long-term"> block (Long Term = LongTermDetail only)
components/panel/ScoutVerdict.tsx         // deleted (now unused)
lib/client/longTermSummary.ts            // deleted (now unused)
```

## Reused
- The existing deterministic alert templates in `buildAlerts` (price-rise, doubtful) as the basis for the curated set; `marketSignals` / `availability` already on each `ScoredPlayer`; `LongTermDetail` (unchanged).

## Tests
- `lib/alerts` (or the refined builders): availability on a starter → alert; bench player doubtful → no alert; owned price-drop / target price-rise → alert; "multiple weak spots" and LLM `raw.alerts` → never surfaced; dedupe + cap.
- `AlertsCard` empty → renders the note (covered via the builder + a small render assertion if a harness exists; otherwise asserted on the builder output).
- Optimizer: `OptimizerResult` no longer has `longTermNarrative`; `synthesizeLongTerm` is gone; the weekly synthesis + deterministic outputs are unchanged (existing optimizer tests stay green, minus the long-term ones).
