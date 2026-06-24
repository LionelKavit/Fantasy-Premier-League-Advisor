## Tasks — new-season readiness (trigger: 2026-27 GW1, ~mid-Aug 2026)

### Task 1: Cold-start composite fix (runtime — BEFORE GW1)
**Capability:** new-season-readiness
- `lib/pipeline/composite-scorer.ts`: remove/relax the flat `insufficientDataFallbackScore` early-return so low-minute players still get the `epNext`-anchored score (zero the noisy per-90 deterministic signals if minutes are thin, but keep the `epNext` term). Fall back to the constant only when `ep_next` is also null.
- `lib/config.ts`: keep `minMinutes` as the gate for *deterministic* signals; document the new behavior.
- Verify: GW1 pitch shows a spread (not all 3.0/10); `tsc`/`eslint`/`vitest` clean; update tests that assert the flat-0.3 path.

### Task 2: Forward full-pipeline evaluation (from GW1)
**Capability:** new-season-readiness
- Implement `squad-eval-captain-live` (its own spec) — capture from GW1.
- Add the **transfer** sibling: capture the live optimizer's recommendation pre-deadline; score realized `in − out` over next-1/next-3 vs hold and vs actual; reuse `research/squad-eval/` reconstruct + metrics. Report full-pipeline vs the floor numbers.

### Task 3: Tier-2 DC evaluation (~GW8+)
**Capability:** new-season-readiness
- Re-run the Tier-2 augmentation eval including `t2_dc_threshold_prob` on live 2026-27 data; record a fold-in decision.

### Task 4: Calibration freshness (after a few GWs)
**Capability:** new-season-readiness
- Recompute the composite weight fit + transfer-threshold curve on 2026-27 data; compare to shipped weights and `τ=1.5`; refit only if rules/meta moved materially. Document the comparison.

### Task 5: Verify chip-count two-halves expiry (around GW19)
**Capability:** new-season-readiness
- After the GW19 deadline, confirm `deriveChipsRemaining` drops an unused first-half chip (check FPL `bootstrap-static` `chips` no longer advertises it; adjust the derivation if not). Prevents the chip narrative (`chip-strategist`) from recommending an expired chip.

### Task 6: Restructure ↔ long-term coherence (season live)
**Capability:** new-season-readiness
- Judge the restructure **dream** over the planning horizon, not just next-GW ep: reuse `computeHorizon` / `HorizonEntry.cumulativeGain` (`lib/optimizer/horizon.ts`) for the dream leg in `findRestructureCandidates` (`lib/optimizer/restructure.ts`), so a restructure is pitched only when the premium pays off across the window. Keep the downgrade leg near-term.
- Share context between the views so This Week's **Restructure** and the **Long Term** horizon never contradict: a recommended restructure's dream agrees with (and is visible in) the Long Term tab — surface the link in the UI (`components/panel/{ThisWeekDetail,LongTermDetail}.tsx`), e.g. the Restructure row carries the horizon timing.
- Verify: a dream the horizon tags WAIT is not pitched as a buy-now restructure; the two tabs reference the same target/timing; `tsc`/`eslint`/`vitest` clean.

### Notes
- Item 1 is the only pre-GW1, demo-facing piece — prioritize it.
- Items 2–4 accrue value through the season; partial reports must state `n` and read as provisional.
- Item 5 (restructure ↔ long-term) needs a meaningful in-season horizon — land it once early-GW fixtures + `ep_next` make the horizon real.
