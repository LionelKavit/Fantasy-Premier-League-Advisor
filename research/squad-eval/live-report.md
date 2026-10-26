# Captain live-eval — full pipeline, 2026-27 (PROVISIONAL, n=7)

Prospective scoring of the app's full captain pipeline (live `ep_next` + LLM context),
captured pre-deadline each gameweek and scored on realized `total_points` against the XI
you actually locked (fetched post-deadline; the capture itself only sees the previous
GW's locked squad — see "Squad drift").
**Provisional:** 7 of ~38 gameweeks scored — read directionally, not conclusively.

### All scored gameweeks — 7 gameweeks

**Captain hit-rate** (app pick = realized top scorer in XI): **2/7 = 29%**
**Points-captured ratio** (app captain ÷ best-in-XI): **60%**

**Head-to-head vs your actual captain:** 4W / 2T / 1L · net **+28** captain-pts (×2 ⇒ +56 squad pts over the season)

| predictor | mean captain pts/GW |
|---|---|
| Perfect (top scorer in XI) | 14.86 |
| **App captain pipeline** | **9.57** |
| Your actual captain | 5.57 |
| Baseline: highest season-to-date PPG | 4.29 |
| Baseline: highest ownership | 8.57 |
| Baseline: random-in-XI (expected) | 4.88 |

## Full pipeline vs deterministic floor

| | 2025-26 replay floor (ep_next absent, neutral LLM, 36 GWs) | Live full pipeline (n=7, provisional) |
|---|---|---|
| Captain hit-rate | 10/36 = 28% | 2/7 |
| Points-captured | 57% | 60% |
| Head-to-head vs actual | 6W / 26T / 4L · net +9 captain-pts (+18 squad pts) | 4W / 2T / 1L |
| Mean app captain pts/GW | 7.06 | 9.57 |

## Not scored

- GW 1: picks-only backfill (no pre-deadline capture) — excluded

## Squad drift (capture saw the previous locked squad)

- GW 2: XI changed before lock (out: Cash, Ajer; in: M.Sangaré, Haaland)
- GW 3: XI changed before lock (out: Kinsky, Maguire, McGinn, João Pedro; in: Scherpen, Ajer, Cash, Wissa); armband moved João Pedro → Haaland before lock
- GW 4: XI changed before lock (out: Ballard, Cash, M.Sangaré; in: Maguire, Ødegaard, João Pedro)
- GW 5: XI changed before lock (out: Scherpen, Maguire, Ajer, João Pedro; in: Kinsky, Cash, Bogle, M.Sangaré)
- GW 6: XI changed before lock (out: Kinsky, Cash, Gakpo, M.Sangaré; in: Verbruggen, Davis, King, João Pedro); armband moved Haaland → B.Fernandes before lock
- GW 7: XI changed before lock (out: Davis, B.Fernandes; in: Konsa, Mbeumo); armband moved B.Fernandes → Groß before lock
- GW 8: XI changed before lock (out: Verbruggen, João Pedro; in: Leno, Cherki); armband moved Groß → João Pedro before lock

## Per-gameweek detail

| GW | chip | app pick | app pts | your pick | your pts | best in XI |
|---|---|---|---|---|---|---|
| 2 |  | B.Fernandes | 23 | João Pedro | 9 | 23 |
| 3 |  | B.Fernandes | 2 | Haaland | 9 | 11 |
| 4 |  | Haaland | 9 | Haaland | 9 | 17 |
| 5 |  | Groß | 14 | Haaland | 6 | 14 |
| 6 | wildcard | Groß | 6 | B.Fernandes | 1 | 12 |
| 7 |  | Groß | 5 | Groß | 5 | 13 |
| 8 |  | Haaland | 8 | João Pedro | 0 | 14 |

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
- 49 pts (bench 12) · GW rank 6,245,837 · overall 1,516,623 · chip none · bank £1.5m · value £100.2m
- XI: Scherpen 2, Calafiori 2, Ballard 4, Ajer 2, Cash 6, B.Fernandes (VC) 2, Gakpo 11, Groß 1, M.Sangaré 0, Haaland (C) 9, Wissa 1
- Bench: Kinsky 6, McGinn 3, João Pedro 1, Maguire 2
- Transfers for this GW: Gyökeres→Wissa
- App: captain B.Fernandes (ep_next 12.5) · transfer unavailable — capture predates the transfer leg
- Capture: pre-deadline capture 2026-09-04T16:46:34.247Z (squad as locked for GW 2)

### GW 4
- 64 pts (bench 11) · GW rank 6,835,136 · overall 2,625,039 · chip none · bank £0.2m · value £100.4m
- XI: Scherpen 1, Maguire 1, Calafiori 6, Ajer 1, B.Fernandes 2, Gakpo 1, Ødegaard (VC) 3, Groß 17, João Pedro 12, Wissa 2, Haaland (C) 9
- Bench: Kinsky 7, M.Sangaré 4, Cash 0, Ballard 0
- Transfers for this GW: McGinn→Ødegaard
- App: captain Haaland (ep_next 8) · transfer FREE: Scherpen→Tzolakis
- Capture: pre-deadline capture 2026-09-12T08:25:53.028Z (squad as locked for GW 3)

### GW 5
- 40 pts (bench 9) · GW rank 8,188,512 · overall 3,383,519 · chip none · bank £0.5m · value £100.7m
- XI: Kinsky 2, Cash -1, Calafiori 1, Bogle 5, B.Fernandes 2, Gakpo 3, Ødegaard 2, M.Sangaré 0, Groß 14, Wissa (VC) 0, Haaland (C) 6
- Bench: Scherpen 0, João Pedro 0, Ballard 2, Ajer 7
- Transfers for this GW: Maguire→Bogle
- App: captain Groß (ep_next 8.2) · transfer FREE: Cash→Bogle
- Capture: pre-deadline capture 2026-09-18T06:40:49.123Z (squad as locked for GW 4)

### GW 6
- 51 pts (bench 14) · GW rank 7,498,946 · overall 4,166,573 · chip wildcard · bank £0.3m · value £100.6m
- XI: Verbruggen 9, Davis 1, Calafiori 9, Bogle 1, B.Fernandes (C) 1, Ødegaard 1, King 2, Groß 6, João Pedro 12, Wissa (VC) 2, Haaland 6
- Bench: Leno 2, Mbeumo 8, Mykolenko 0, Konsa 4
- Transfers for this GW: Ajer→Mykolenko, Scherpen→Verbruggen, Kinsky→Leno, Cash→Davis, M.Sangaré→King, Gakpo→Mbeumo, Ballard→Konsa
- App: captain Groß (ep_next 15.5) · transfer FREE: Gakpo→Schade
- Capture: pre-deadline capture 2026-10-10T05:02:33.305Z (squad as locked for GW 5)

### GW 7
- 62 pts (bench 7) · GW rank 5,006,366 · overall 4,093,198 · chip none · bank £4.2m · value £101.0m
- XI: Verbruggen 6, Calafiori 6, Bogle 2, Konsa 9, Mbeumo 8, Ødegaard 3, King 2, Groß (C) 5, João Pedro 2, Wissa 1, Haaland (VC) 13
- Bench: Leno 6, Cherki 0, Mykolenko 1, Davis 0
- Transfers for this GW: B.Fernandes→Cherki
- App: captain Groß (ep_next 10) · transfer FREE: Mykolenko→De Cuyper, Ødegaard→Henderson
- Capture: pre-deadline capture 2026-10-17T09:47:59.723Z (squad as locked for GW 6)

### GW 8
- 56 pts (bench 4) · GW rank 1,919,912 · overall 3,431,942 · chip none · bank £4.2m · value £101.4m
- XI: Leno 8, Calafiori 1, Bogle 5, Konsa 14, Cherki 0, Ødegaard 3, King 6, Groß 0, Mbeumo 2, Wissa 1, Haaland (VC) 8
- Bench: Verbruggen 2, João Pedro (C) 0, Davis 2, Mykolenko 0
- Transfers for this GW: none
- App: captain Haaland (ep_next 9.5) · transfer FREE: Mykolenko→De Cuyper, Ødegaard→Henderson
- Capture: pre-deadline capture 2026-10-23T17:06:35.119Z (squad as locked for GW 7)
