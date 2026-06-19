## Tasks — transfer-vs-hold threshold

> Runtime change to the optimizer's go/hold decision. Threshold derived from data, anchored to FPL's 4-pt hit cost. Calibrate + validate before relying on it.

### Task 1: Calibrate the threshold (offline, report-only)
**Capability:** transfer-optimization
- Script under `research/` over the `composite-backtest` dataset: for same-position one-for-one swaps, plot realized next-3-GW gain vs `Δep` (and vs composite `gw1Gain`). Derive **τ** (free-transfer bar, in points, `0 < τ < 4`) and **τ_c** (composite-units fallback) as the smallest edge where realized gain reliably crosses zero. Write a short calibration report incl. the curve and the ~1.5–2 pt FPL-heuristic sanity check.

### Task 2: Apply the gate (runtime)
**Capability:** transfer-optimization
- `lib/config.ts`: `TRANSFER_THRESHOLDS = { freeTransferEp: τ, hitCostEp: 4, compositeFallback: τ_c }`.
- `lib/optimizer/single-transfer.ts`: replace the `gw1Gain <= 0` go/hold test with a threshold test — `Δep > τ` (free) / `Δep > 4` (hit), `gw1Gain > τ_c` when `ep_next` is null. Keep composite ranking unchanged. Update the roll reason to state projected gain vs the bar.

### Task 3: Validate
**Capability:** transfer-optimization
- Re-run `squad-eval-transfer-replay`: confirm the recommendation rate drops from 34/35 toward selective, and net realized gain vs holding is no longer negative (exercises the `τ_c` fallback, since that replay is ep-absent).
- Update optimizer tests that assumed `gain > 0` recommends a transfer.
- App gate clean (`tsc` / `eslint` / `next build` / `vitest`).

### Verify
- [x] τ = 1.5 ∈ (0, 4), lands on the FPL ~1.5–2 pt heuristic; curve reported (`calibrate-threshold.py`).
- [x] Recommendation rate falls (floor: 34/35 → 0/35); net-vs-holding 0.00 (was −0.46/transfer).
- [x] Ranking unchanged (composite still orders candidates); only go/hold changed.
- [x] App gate clean (tsc / eslint 0 / next build / vitest 186); optimizer tests updated.

### Decide
- [x] Single global τ for v1 (per-position deferred — the calibration curve is monotonic without material per-position divergence at this sample size).

---

## As-built outcome (run 2026-06-19)

**Threshold derived (Task 1, `research/squad-eval/calibrate-threshold.py`):**
- Δep curve: <0.5 is a coin flip (P=0.45, mean +0.01); reliable gains begin ~1.0–1.5 (P 0.62–0.65). **τ = 1.5 pts** (free-transfer bar) — triangulated by the data noise floor (0.5) + free-transfer opportunity cost + the FPL ~1.5–2 heuristic. **Hit bar = 4** (exact FPL hit cost).

**Gate applied (Task 2):** `lib/config.ts` `TRANSFER_THRESHOLDS = { freeTransferEp: 1.5, hitCostEp: 4 }`; `lib/optimizer/single-transfer.ts` gates go/hold on `Δep = in.epNext − out.epNext` (`> 1.5` free, `> 4` hit). Composite ranking unchanged.

**Design correction — `ep_next`-null → HOLD (not a composite `τ_c`):** a second calibration on the ep-absent floor composite (`calibrate-tauc.ts`) found it has **no positive predictive value** — realized next-3 gain was negative at *every* `gw1Gain` level (−2 to −4, P(gain>0) 0.33–0.42). So the honest fallback is to hold without `ep_next`, not to pick on the composite. Spec/design updated accordingly.

**Validation (Task 3):** re-running `squad-eval-transfer-replay` (ep-absent → exercises the hold path): the app went **34/35 → 0/35** transfers, the per-transfer bleed **−0.46 → 0.00**, and it correctly held on **2/2** of the manager's losing transfers. The residual −204 vs the manager is the manager making good transfers on information the ep-absent floor lacks — precisely why the runtime gate keys on `ep_next` (which the runtime has). The points gate (τ=1.5/hit 4) itself is validated by the unit tests + the ep calibration curve; it can't be exercised on ep-absent history (forward eval needed for its full effect).