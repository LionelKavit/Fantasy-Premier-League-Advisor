# Transfer live-eval — full pipeline, 2026-27 (PROVISIONAL, n=4)

Prospective scoring of the app's full transfer optimizer (live `ep_next` + LLM context,
free transfers derived from your public history), captured pre-deadline each gameweek on
the squad as locked for the previous GW, and scored on realized (in − out) `total_points`
over the next 1 and next 3 gameweeks — net of the hit each side paid — vs holding and vs
your actual transfers.
**Provisional:** 4 decision gameweeks scored — read directionally, not conclusively.

### Decision points: 4 gameweeks
- App recommended a transfer in **4/4** GWs (held 0); you transferred in **4/4**.
- Realized so far: next-1 scored for **4/4**, next-3 for **2/4** (the rest span gameweeks still being played).

**Counterfactual gain vs holding** (realized in − out):
| | next-1 GW | next-3 GW |
|---|---|---|
| App recommendation | 3.25 | 5.00 |
| Your actual transfers (net of hits) | 3.75 | -8.00 |

**Head-to-head (next-3 gain):** app 2W / 0T / 0L vs you · net **+26** pts over the season
**No-op accuracy:** of your 1 transfers that lost points (next-3), the app would have held **0/1**.

## Per-gameweek detail

| GW | app rec (out→in) | app +/- (3GW) | your move | your +/- (3GW, net) |
|---|---|---|---|---|
| 4 | Scherpen→Tzolakis | 9 | transfer | -16 |
| 5 | Cash→Bogle | 1 | transfer | 0 |
| 6 | Gakpo→Schade | pending | transfer | pending |
| 7 | Mykolenko→De Cuyper, Ødegaard→Henderson | pending | transfer | pending |

## Full pipeline vs deterministic floor

| | 2025-26 replay floor (ep_next absent, 35 decision GWs, 1 FT assumed) | Live full pipeline (n=4, provisional) |
|---|---|---|
| App transfer rate | 0/35 (held every GW) | 4/4 |
| App mean gain next-1 / next-3 | 0.00 / 0.00 | 3.25 / 5.00 |
| Your mean gain next-1 / next-3 (net) | 3.49 / 5.83 | 3.75 / -8.00 |
| Head-to-head (next-3) | 2W / 19T / 14L · net −204 pts | 2W / 0T / 0L · net +26 pts |
| No-op accuracy | 2/2 | 0/1 |

## Not scored

- GW 1: picks-only backfill (no pre-deadline capture) — excluded
- GW 2: capture predates the transfer leg (captain only) — excluded
- GW 3: capture predates the transfer leg (captain only) — excluded

## Captured recommendations

Projected Δep is the gate's own quantity (`ep_next` in − out at capture); the composite
delta the optimizer also carries is NOT expected points and is not shown here.

| GW | FT assumed | bank | app primary | projected Δep | realized next-1 | hit | your move(s) | your hit |
|---|---|---|---|---|---|---|---|---|
| 4 | 1 | £1.5m | FREE: Scherpen→Tzolakis | +6.7 | +1 | 0 | McGinn→Ødegaard | 0 |
| 5 | 1 | £0.2m | FREE: Cash→Bogle | +7.4 | +6 | 0 | Maguire→Bogle | 0 |
| 6 | 1 | £0.5m | FREE: Gakpo→Schade | +12.0 | +1 | 0 | Ajer→Mykolenko, Scherpen→Verbruggen, Kinsky→Leno, Cash→Davis, M.Sangaré→King, Gakpo→Mbeumo, Ballard→Konsa | 0 |
| 7 | 2 | £0.3m | FREE: Mykolenko→De Cuyper, Ødegaard→Henderson | +17.8 | +5 | 0 | B.Fernandes→Cherki | 0 |

**Calibration (n=4):** mean projected Δep 10.97 vs mean realized next-1 (in − out, net of hit) 3.25.
