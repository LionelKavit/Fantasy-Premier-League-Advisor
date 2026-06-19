# Captain replay — manager 10815578, 2025-26 (GW3-38)

Replay of the app's real captain pipeline on the actual squads, scored vs realized points.
**Caveats:** `ep_next` absent (epBlend → model projection); neutral LLM; availability assumed
available; penalty order + ownership-total from the season-end bootstrap. Captaincy scored on
realized `total_points` (multiplier-invariant comparison).

### All gameweeks — 36 gameweeks

**Captain hit-rate** (app pick = realized top scorer in XI): **10/36 = 28%**
**Points-captured ratio** (app captain ÷ best-in-XI): **57%**

**Head-to-head vs your actual captain:** 6W / 26T / 4L · net **+9** captain-pts (×2 ⇒ +18 squad pts over the season)

| predictor | mean captain pts/GW |
|---|---|
| Perfect (top scorer in XI) | 12.22 |
| **App captain pipeline** | **7.06** |
| Your actual captain | 6.81 |
| Baseline: highest season-to-date PPG | 6.47 |
| Baseline: highest ownership | 5.67 |
| Baseline: random-in-XI (expected) | 4.49 |

## Per-gameweek detail

| GW | chip | app pick | app pts | your pick | your pts | best in XI |
|---|---|---|---|---|---|---|
| 3 |  | Haaland | 9 | Haaland | 9 | 15 |
| 4 |  | Haaland | 13 | Haaland | 13 | 13 |
| 5 |  | Haaland | 9 | M.Salah | 5 | 9 |
| 6 |  | Haaland | 16 | Haaland | 16 | 16 |
| 7 |  | Haaland | 8 | Haaland | 8 | 10 |
| 8 |  | Haaland | 13 | Haaland | 13 | 13 |
| 9 |  | Haaland | 2 | Haaland | 2 | 15 |
| 10 |  | Haaland | 13 | Haaland | 13 | 13 |
| 11 |  | Haaland | 4 | Haaland | 4 | 10 |
| 12 |  | Haaland | 2 | Haaland | 2 | 6 |
| 13 |  | Haaland | 2 | Haaland | 2 | 15 |
| 14 |  | Haaland | 14 | Haaland | 14 | 17 |
| 15 |  | Haaland | 2 | Haaland | 2 | 12 |
| 16 |  | Haaland | 13 | Haaland | 13 | 13 |
| 17 |  | Haaland | 16 | Haaland | 16 | 16 |
| 18 |  | Haaland | 2 | Haaland | 2 | 10 |
| 19 | freehit | Haaland | 2 | Haaland | 2 | 15 |
| 20 |  | Haaland | 2 | Haaland | 2 | 10 |
| 21 |  | Haaland | 6 | Haaland | 6 | 12 |
| 22 |  | Haaland | 2 | Haaland | 2 | 10 |
| 23 |  | Haaland | 1 | Haaland | 1 | 8 |
| 24 |  | Haaland | 5 | B.Fernandes | 10 | 12 |
| 25 |  | Haaland | 11 | B.Fernandes | 10 | 11 |
| 26 |  | Haaland | 5 | Zubimendi | 6 | 14 |
| 27 |  | Haaland | 6 | João Pedro | 7 | 7 |
| 28 |  | B.Fernandes | 13 | B.Fernandes | 13 | 13 |
| 29 |  | Haaland | 2 | Haaland | 2 | 19 |
| 30 |  | Haaland | 2 | Haaland | 2 | 11 |
| 31 | freehit | Gordon | 10 | Palmer | 2 | 13 |
| 32 |  | B.Fernandes | 4 | B.Fernandes | 4 | 9 |
| 33 |  | Haaland | 13 | B.Fernandes | 6 | 13 |
| 34 |  | B.Fernandes | 5 | B.Fernandes | 5 | 9 |
| 35 |  | Haaland | 7 | B.Fernandes | 5 | 8 |
| 36 |  | Haaland | 11 | B.Fernandes | 3 | 15 |
| 37 |  | Haaland | 9 | B.Fernandes | 9 | 14 |
| 38 |  | Haaland | 0 | B.Fernandes | 14 | 14 |
