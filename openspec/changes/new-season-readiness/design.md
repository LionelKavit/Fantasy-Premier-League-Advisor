# Design — new-season readiness

## 1. Cold-start composite fix (the bug)
**Current:** `computeCompositeScore` returns early with a flat `insufficientDataFallbackScore` (0.3) when `totalMinutes < minMinutes` (270). The early-return sits *above* the `signalMap.epNext = market.epNextSignal` injection, so low-minute players never see the dominant signal. At GW1–3 of a new season every player is sub-270 → every composite is 0.3 → ranking is uniform and the pitch/optimizer are meaningless.

**Fix options (pick at implementation):**
- (a) **Drop the early-return; gate the *deterministic* signals instead.** When minutes are thin, zero/neutralize the per-90 stat signals (which are noisy on tiny samples) but still apply the `epNext` term, so ranking follows FPL's projection until real data accrues. Cleanest — keeps one scoring path.
- (b) **Blend:** `total = squash(w_epNext · epNextSignal)` when under `minMinutes`, i.e. an ep-only score, falling back to 0.3 only when `ep_next` is also null.
Either way: low-minute ranking must track `ep_next`, not collapse to a constant. Verify the GW1 pitch shows a spread, not all 3.0/10.

**Watch:** preseason `ep_next` exists but is thinner than in-season; pair this with the ep-unavailable notice (already shipped) for the brief pre-projection window.

## 2. Forward full-pipeline evaluation (captain + transfer)
- Implement `squad-eval-captain-live` per its spec (capture pre-deadline, score post-GW).
- **Transfer sibling:** at each deadline also capture the live optimizer's transfer recommendation (with real `ep_next` + LLM) and score realized `in − out` over next-1/next-3 vs holding and vs the manager's actual transfer — the forward analog of the archived `squad-eval-transfer-replay`, but with the gate's primary ep path actually exercised. Reuse the shared `research/squad-eval/` reconstruction + metric helpers.
- Output: a full-pipeline report comparable to the deterministic-floor numbers (captain +18 floor; transfer −204 floor) to quantify the lift from `ep_next` + LLM and validate the `τ=1.5` gate live.

## 3. Tier-2 defensive-contribution evaluation
- Once ~GW8+ of 2026-27 `defensive_contribution` data exists, re-run the Tier-2 augmentation eval (the archived `composite-backtest` approach) including `t2_dc_threshold_prob` on live data, and decide whether to fold it into the composite. It was 0%-coverage historically, so this is its first real test.

## 4. Calibration freshness check
- Recompute the composite weight fit and the transfer-threshold curve on early-2026-27 data; compare to the shipped weights and `τ=1.5`. Refit/retune **only if** FPL's 2026-27 scoring rules or the meta moved them materially (document the comparison either way). Cheap to run; protects against silent drift from a rules change.

## 5. Restructure ↔ long-term coherence
**Current:** `findRestructureCandidates` (now ep-native, see archived `restructure-ep-allocation`) scores a chain on **next-GW** ep: `netEp = (dream − weak) + (replacement − funder)`. The Long Term tab (`LongTermDetail`) renders `computeHorizon` output — multi-GW `cumulativeGain` per target with a `BUY_NOW | WAIT | BUY_NOW_SELL_LATER` timing. The two are computed independently, so This Week can pitch "downgrade Dalot → fund Gabriel" while the horizon never mentions Gabriel, or tags him WAIT.

**Direction (pick at implementation):**
- Judge the restructure **dream** over the horizon, not just next-GW ep — reuse `computeHorizon` / `HorizonEntry.cumulativeGain` for the dream leg so a restructure is only pitched when the premium pays off across the planning window (a multi-week investment, which is what a downgrade-funded dream actually is). The downgrade leg can stay near-term (it's the funding sacrifice).
- Share one context between the views: a recommended restructure's dream should appear in / agree with the Long Term horizon (same target + timing). Surface the link in the UI (e.g. the Restructure row notes the horizon timing, or the dream shows in both `ThisWeekDetail` and `LongTermDetail`) so the tabs read as one plan rather than two.
- **Why season-gated:** the horizon is only meaningful with live fixtures + real `ep_next`; pre-season it's noise, so this lands once 2026-27 is underway alongside the other live items.

## Sequencing
Item 1 before GW1 (demo-facing). Items 2 from GW1 (capture), 3 ~GW8+, 4 after a handful of GWs, 5 once the in-season horizon is meaningful (early GWs). All offline items reuse the existing `research/` harnesses.
