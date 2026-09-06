# Captain live-eval — full pipeline, 2026-27 (PROVISIONAL, n=1)

Prospective scoring of the app's full captain pipeline (live `ep_next` + LLM context),
captured pre-deadline each gameweek and scored on realized `total_points` against the XI
you actually locked (fetched post-deadline; the capture itself only sees the previous
GW's locked squad — see "Squad drift").
**Provisional:** 1 of ~38 gameweeks scored — read directionally, not conclusively.

### All scored gameweeks — 1 gameweeks

**Captain hit-rate** (app pick = realized top scorer in XI): **1/1 = 100%**
**Points-captured ratio** (app captain ÷ best-in-XI): **100%**

**Head-to-head vs your actual captain:** 1W / 0T / 0L · net **+14** captain-pts (×2 ⇒ +28 squad pts over the season)

| predictor | mean captain pts/GW |
|---|---|
| Perfect (top scorer in XI) | 23.00 |
| **App captain pipeline** | **23.00** |
| Your actual captain | 9.00 |
| Baseline: highest season-to-date PPG | 5.00 |
| Baseline: highest ownership | 9.00 |
| Baseline: random-in-XI (expected) | 8.36 |

## Full pipeline vs deterministic floor

| | 2025-26 replay floor (ep_next absent, neutral LLM, 36 GWs) | Live full pipeline (n=1, provisional) |
|---|---|---|
| Captain hit-rate | 10/36 = 28% | 1/1 |
| Points-captured | 57% | 100% |
| Head-to-head vs actual | 6W / 26T / 4L · net +9 captain-pts (+18 squad pts) | 1W / 0T / 0L |
| Mean app captain pts/GW | 7.06 | 23.00 |

## Not scored

- GW 1: picks-only backfill (no pre-deadline capture) — excluded
- GW 3: not finished yet — pending
- GW 4: not finished yet — pending

## Squad drift (capture saw the previous locked squad)

- GW 2: XI changed before lock (out: Cash, Ajer; in: M.Sangaré, Haaland)

## Per-gameweek detail

| GW | chip | app pick | app pts | your pick | your pts | best in XI |
|---|---|---|---|---|---|---|
| 2 |  | B.Fernandes | 23 | João Pedro | 9 | 23 |

## Season log — squads as locked

### GW 1
- 58 pts (bench 4) · GW rank 2,201,657 · overall 2,201,654 · chip none · bank £0.0m · value £100.0m
- XI: Kinsky (VC) 2, Cash -1, Calafiori 9, Maguire 1, Ballard 0, Ajer 8, B.Fernandes 2, Gakpo 12, McGinn 1, Groß 2, João Pedro (C) 11
- Bench: Scherpen 2, Amad 0, Gyökeres 0, Haaland 2
- Transfers for this GW: none
- App: captain unavailable · transfer unavailable — no pre-deadline capture — the public API exposes no picks before the GW1 deadline
- Capture: no capture — picks-only backfill

### GW 2
- 101 pts (bench 7) · GW rank 1,562,375 · overall 1,185,762 · chip none · bank £0.3m · value £100.0m
- XI: Kinsky 1, Calafiori 11, Maguire 4, Ballard 8, B.Fernandes 23, Gakpo 5, M.Sangaré 4, Groß 13, McGinn 1, João Pedro (C) 9, Haaland (VC) 13
- Bench: Scherpen 2, Gyökeres 0, Cash 2, Ajer 3
- Transfers for this GW: Amad→M.Sangaré
- App: captain B.Fernandes (ep_next 4) · transfer unavailable — capture predates the transfer leg
- Capture: pre-deadline capture 2026-08-28T17:25:14.531Z (squad as locked for GW 1)

### GW 3
- realized: pending (gameweek not finished)

### GW 4
- realized: pending (gameweek not finished)
