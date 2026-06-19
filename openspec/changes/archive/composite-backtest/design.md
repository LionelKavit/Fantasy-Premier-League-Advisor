# Design (Phase 1 — dataset + benchmark)

## Context
The composite is a per-position linear model: `total = clamp01(Σ normSignalᵢ × weightᵢ + trendAdj + llmAdj − suspPenalty)`. Phase 1 measures it against realized points and baselines, and produces the labeled dataset that Phase 1's benchmark *and* Phase 2's fitter (`composite-weight-training`) consume. Everything here is offline; the deployed app is untouched.

---

## 1. Data

### Source — decided
- **The `vaastav/Fantasy-Premier-League` archive, already cloned to `historical_data/`** (gitignored). Per-GW files carry realized points, `value` (price), `selected` (ownership), `expected_goals`/`expected_assists`, and **`xP` (= FPL `ep_this`)**.
- **Seasons: ALL of them — `historical_data/data/2016-17` … `2025-26`** (every file in each season subfolder). Older seasons have thinner schemas (no `xP`/xG/DC), so their richer features are NaN-tagged per the availability map; they still contribute the always-available core signals (goals/assists/minutes/bonus/ICT) as extra training volume, while `xP`/xG/DC analysis is naturally limited to the seasons that have them.
- FPL API is insufficient for history (no archived pre-GW projections); a future change may log live bootstrap snapshots for a pristine `ep_next`.

### Rows
- One row per **(player × gameweek × season)**, stacked.
- **Filter/flag low-minute players** (mirror the `minMinutes = 270` idea) and **flag DGW/BGW rows** so they don't silently distort metrics.

### Features (X) — two tiers: core (parity) vs candidate (exploratory)
**Critical distinction:** weights only map back to the runtime composite if they're trained on features the runtime actually computes. So the feature set is split:

**Tier 1 — Core / parity features (trainable → shippable weights).** Produced by running the app's *own* signal functions on point-in-time inputs, so training X == runtime X. These are what Phase 2 fits weights for:
- **Statistical** (`computeStatisticalSignals`): goalThreat, assistPotential, formSignal, bonusEfficiency, setPieceValue, valueScore, cleanSheetRate, xgcRate, defensiveScore, savesRate, minutesReliability, suspensionRisk.
- **Fixture** (`computeFixtureSignals`): fdrScore (+ home/dgw flags).
- **Market**: `epNextSignal` (gated `xP`) and `ppg`.
- **Trend** (`computeTrendSignals.additive`).

**Tier 2 — Candidate / exploratory features (evaluated, NOT auto-shipped).** Engineered directly from the vaastav fields to test whether they add predictive value via ablation/feature-importance. **They do not produce shippable weights in Phase 2** — if one proves its worth, *adding it to the runtime pipeline + composite is a follow-up change*; only then can its weight ship. Candidates (all built as **point-in-time rolling aggregations of prior GWs**, per-90/rate, unless noted):
- *Attacking:* rolling xG90/xA90/xGI90; finishing over/under-performance (`goals − xG`, rolling → mean-reversion); rolling threat/creativity/influence; understat npxG/shots/key_passes/xGChain/xGBuildup (needs `id_dict` name↔id join).
- *Minutes/availability:* rolling start-rate, % available minutes, nailed-on flag; **fixture congestion** (days-since-last-match / matches-in-7-days from `kickoff_time`).
- *Bonus:* rolling **bps per 90**.
- *Defensive:* opponent-adjusted clean-sheet probability; rolling saves90; `defensive_contribution`/tackles/recoveries/CBI per 90 **(2025-26 only)**.
- *Market/crowd:* points-per-million, value-form; ownership level + net **transfer momentum** (`transfers_*_event`).
- *Fixture/opponent (target-GW context, joined from `fixtures`/`teams`):* next-3 FDR, home/away, opponent attack/defence strength, **n_fixtures (DGW/BGW)**.
- *Set pieces:* penalty-taker flag (caveat: from the season-end `players_raw` snapshot → point-in-time is approximate; flag it).

**Excluded (not historically available):** LLM-context signals (rotationRisk, oopBonus, …) were LLM-generated at runtime and can't be backtested — left out of the dataset; the runtime `llmAdj` term is untouched. **Manager points** (`mng_*`) excluded (app doesn't pick managers).

### Feature availability by season (verified empirically against the clone, 2026-06-18)
`teams.csv` 2019-20+ · `xP` **2020-21+** · per-GW `expected_*` **and** `starts` **2022-23+** · **defensive_contribution/tackles/recoveries/CBI 2025-26 only** (the new DC scoring category). ⇒ the feature-complete window (xP + per-GW xG) is **2022-23 → 2025-26**; DC candidates are only testable on 2025-26.

**Critical as-built note:** pre-2020-21 gw files have **no `team` column**, so `teamId` can't resolve and fixture signals (`fdrScore`/`opponentStrength`) are degenerate-zero for 2016-17…2019-20 — i.e. **fixture signals are only faithful for 2020-21+**. Unavailable features are emitted as `0` (not fabricated), gated by per-row flags: **`has_fixture`** (the one this note adds), `has_xP`, `has_xg`, `has_dc`. Consumers must filter on the flags — the benchmark headline uses fixture-complete + gate-clean seasons, and Phase 2 must fit each weight only on rows where its flag is set.

### Tier-2 candidate gaps to evaluate (detailed — runtime pipeline can't compute these yet)
These are concrete predictive gaps in the *current runtime composite* (verified against the code on 2026-06-18). Each is a **Tier-2 candidate**: engineered in the backtest dataset and assessed via ablation/feature-importance. **None ships as a composite weight here** — if the backtest proves its value, a *separate follow-up change* adds it to the runtime pipeline (`lib/pipeline/*`), and only then can Phase 2 fit/ship its weight. Captured in full so the intent survives context loss:

1. **Defensive-Contribution (DC) threshold probability.**
   - *What exists:* `lib/pipeline/statistical-scoring.ts` already consumes `defensiveContribution` as a **continuous** `defensiveScore`.
   - *Gap:* the 2025-26 DC points are a **threshold event** — flat **+2** for ≥10 CBIT (DEF) / ≥12 CBIRT (MID/FWD), nothing below. A continuous mean smears the cliff; a player averaging 11 vs 8 is categorically different.
   - *Proposed feature:* **P(crosses the DC threshold next GW)** estimated from the rolling distribution of per-GW CBIRT vs the position threshold (e.g. share of recent GWs above the line, or a simple rate→Poisson-style estimate), per position.
   - *Compute from:* `tackles`, `recoveries`, `clearances_blocks_interceptions`, `defensive_contribution` (live in bootstrap/element-summary for 2025-26).
   - *Availability/caveat:* **2025-26 only** → testable on the current (partial) season only; small sample.

2. **Own-team attacking strength (the matchup is currently one-sided).**
   - *What exists:* `fixture-analyzer.ts` blends only the **opponent's** strength (`opp.strength_defence_*` for attackers, `opp.strength_attack_*` for defenders), via `opponentStrength`.
   - *Gap:* a player's ceiling also depends on **their own team's** attack — a strong striker in a weak side scores less. The own-team side of the matchup is unmodeled.
   - *Proposed feature:* an **expected-team-goals matchup** = own `team.strength_attack_{home,away}` × opponent `strength_defence_{home,away}` (home/away aware) for attacker upside; symmetrically own `strength_defence` × opp `strength_attack` to sharpen clean-sheet odds for DEF/GK.
   - *Compute from:* `teams.csv` strength fields + `fixtures.csv` (home/away, opponent) — all live-available.
   - *Caveat:* partially overlaps `opponentStrength`/`fdrScore`; ablation must show it adds *marginal* value.

3. **Fixture congestion / rest days (genuinely absent).**
   - *What exists:* nothing — no `kickoff_time`-derived recency signal in the pipeline; only the offline-fragile LLM `rotationRisk` gestures at rotation.
   - *Gap:* congestion (short turnarounds, midweek European fixtures) is a real rotation/fatigue driver of minutes — the #1 points gate.
   - *Proposed feature:* **days-since-last-match** and **matches-in-last-7-days** per player/team, from `kickoff_time` / `fixtures.csv`.
   - *Caveat:* the dataset has no explicit European-fixture calendar, so congestion is approximated from PL kickoff spacing; still a deterministic, live-computable signal.

4. **Promote LLM-reconstructable signals to deterministic (cleanup that also expands what's backtestable).**
   - *What exists:* the LLM-context layer produces `setPieceHierarchy` and `injurySeverity`/availability — but FPL gives this data **directly**: set-piece **order** is already parsed into `setPieceDuties` (penalties/FK/corner order), and availability is the numeric `chance_of_playing_next_round`.
   - *Gap:* these live in the LLM layer, which is (a) **not backtestable** (LLM-generated, excluded from the dataset), (b) **offline-fragile** (fails on a bad key), and (c) **redundant** with deterministic FPL fields.
   - *Proposed:* compute deterministically — a **penalty-taker / set-piece premium** from `penalties_order==1` (etc.), and a **numeric availability discount** from `chance_of_playing_next_round` — as Tier-1-eligible signals the backtest *can* validate.
   - *Caveat:* set-piece order in the historical archive comes from the **season-end `players_raw` snapshot**, so point-in-time per-GW set-piece status is approximate (flag it); `chance_of_playing` history may be sparse in older seasons.

### `xP` handling — per-season integrity gate (never shift clean data)
Confirmed from the clone: the `gws/xP{N}.csv` files (`id, xP`) are **identical** to the `xP` column in `gws/gw{N}.csv` (verified 674/674 for 2024-25 GW10) — same scraped `ep_this`, two representations. Use the `gw{N}.csv` column (already joined to stats). There is no separate "cleaner" source.

Whether `xP` is pre-deadline or post-match-contaminated **varies by season** (scraper cadence is undocumented). Rather than blindly `shift(1)` everything (which would corrupt seasons whose `xP` is already good), we **gate per season**:

1. **Raw `xP` is the source of truth and is never overwritten in place.**
2. **Per-season integrity diagnostic** — run the "surprise-blank" test across *all* gameweeks of the season: players who were nailed starters in GW N−1 (≥60 min) but played 0 min in GW N. If their GW N `xP` stays meaningfully **positive** on average, `xP` carries the pre-deadline expectation (it didn't know they'd blank) → the season's `xP` is **pre-deadline**. If those surprise-blanks are driven to ≈0, `xP` "knows" the outcome → **contaminated**. (Empirically, 2024-25 looks pre-deadline: surprise-blank starters like Dias kept `xP` ≈ 3.0.)
3. **Clean seasons → use raw `xP` as-is** (no shift, no corruption).
4. **Failing seasons → exclude `xP`** (set missing / drop the season from `xP`-dependent analysis). **`shift(1)` is *not* a fix** — last week's prediction is a different quantity, also imperfect — so it's never the default and never applied to clean seasons; at most a separately-flagged salvage experiment.
5. **Pooled training uses only clean-`xP` seasons** for the `xP` feature, so the column stays semantically uniform (no mixing raw and shifted meanings).

The diagnostic must run over the **whole season** (a single GW could be a fluke). Its verdict per season is recorded in the report.

### Label (y)
- **Realized points summed over the next 3 gameweeks** (the chosen horizon). Point-in-time: features for GW N use only data ≤ GW N−1; the label aggregates GW N…N+2 actuals.
- **#1 correctness risk = lookahead** — guarded by a test.

### Dataset format & structure — one big long-format table
A **single "long"/tidy file** (not per-position, not per-GW files):
```
rows = one per (season × gameweek × player)          ← stacked across all usable seasons
cols = [ identifiers ]              +  [ features ]            +  [ label ]
       season, GW, element,            Tier-1 core signals       next3_points (Σ pts GW N..N+2)
       position, name                  + Tier-2 candidates       (+ raw next-GW pts kept for flex)
       (kept for joins/splits/debug,   + per-row availability/
        NOT fed as features)            DGW/BGW/low-min flags
```
- **Per-position fitting filters on the `position` column at fit time** — one source of truth beats four files (easier to inspect, version, re-split, and do time-aware season hold-outs).
- **Identifiers carried but never used as features** (they drive the train/test split, DGW flags, debugging).
- **Format: Parquet** preferred (typed, compact, fast for the Python side); CSV acceptable at this scale (~30–60k rows after filters).
- This file is the **handoff artifact**: the TS builder writes it; the Phase 1 benchmark and the Phase 2 fitter both read it. Tier-1 vs Tier-2 columns are tagged so Phase 2 fits weights only on Tier-1 (shippable) features.

---

## 2. Benchmark (the harness)
Used to score the current composite (and, in Phase 2, the fitted one) against baselines, using the **rank metrics this player-universe dataset supports**:
- **Rank metrics:** Spearman **rank correlation within position** (per GW, averaged) + **top-K precision within position**.
- **Baselines, side by side:** `xP`/`ep_next`, `ppg`, current hand-tuned composite.
- **Ablation:** drop each signal/group, re-measure → marginal-value table.
- **Output:** a committed report (markdown + JSON) — per position × the next-3 horizon, model vs baselines, with coverage / low-minute / DGW notes and the `xP` caveat.
- **Out of scope here:** captain hit-rate & transfer realized gain need a manager-squad simulation → the separate `squad-eval` change.

---

## 3. Tooling & layout (decided)
- **Offline only**, e.g. `research/composite-backtest/` (excluded from the Next build).
- **TS dataset builder** — reuses `computeStatisticalSignals` / `computeFixtureSignals` / `computeMarketSignals` / `computeTrendSignals` on point-in-time vaastav inputs → emits a labeled dataset (CSV/Parquet) per position. Guarantees train/serve parity.
- **Python eval** (`pandas` + `scipy`/`numpy`) — computes the metrics/ablation on that dataset and writes the report. (Phase 2's ridge fit will reuse this Python env.)
- Handoff between the two is the dataset file.

---

## 4. Pitfalls / risks
- **Lookahead bias** — features strictly pre-GW; needs a test.
- **`xP` contamination** — included but flagged; cleaning handled in the owner-directed data engineering.
- **Train/serve skew** — avoided by reusing the real TS signal code.
- **Variance ceiling** — judge by beating baselines over a season, not absolute ρ.
- **LLM signals unbacktestable** — excluded; documented.
- **DGW/BGW + low-minute** rows — flagged/filtered.
- **Player-id continuity** across seasons — join on FPL element id per season.

---

## 5. Deliverables (Phase 1)
1. TS dataset builder → labeled point-in-time dataset (per position, next-3 label), parity-guaranteed.
2. Python benchmark + ablation → committed report (current composite vs `xP`/`ppg`).
3. Tests: no-lookahead guarantee + metric-computation correctness.

> Phase 2 (`composite-weight-training`) consumes deliverable #1 to fit the weights.
