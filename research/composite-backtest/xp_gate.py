#!/usr/bin/env python3
"""
composite-backtest — Task 2: per-season xP integrity gate.

Tests whether each season's `xP` (= FPL `ep_this`) behaves like a PRE-deadline
prediction or is post-match contaminated. Method: "surprise blanks" — players
who started GW N-1 (>=60 min) but played 0 min in GW N. A pre-deadline xP can't
know they'd blank, so it stays positive; a contaminated xP is driven to ~0.

Verdict per season:  mean surprise-blank xP >= 0.7  -> PRE-DEADLINE (use raw xP)
                     else                            -> CONTAMINATED (exclude xP)
"""
import json
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).parents[2] / "historical_data" / "data"
OUT = Path(__file__).parent / "out"
THRESHOLD = 0.7  # mean surprise-blank xP above this => pre-deadline


def gate_season(season: str):
    f = ROOT / season / "gws" / "merged_gw.csv"
    if not f.exists():
        return None
    try:
        df = pd.read_csv(f, low_memory=False)
    except UnicodeDecodeError:
        df = pd.read_csv(f, low_memory=False, encoding="latin-1")
    if "xP" not in df.columns:
        return {"season": season, "verdict": "no_xP", "surprise_blanks": 0, "mean_xP": None, "pct_near_zero": None}
    rnd = "GW" if "GW" in df.columns else "round"
    for c in ["minutes", "xP", rnd, "element"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    # Aggregate DGW rows: minutes summed, xP summed, per (element, round).
    agg = df.groupby(["element", rnd], as_index=False).agg(minutes=("minutes", "sum"), xP=("xP", "sum"))
    agg = agg.sort_values(["element", rnd])
    agg["prev_min"] = agg.groupby("element")["minutes"].shift(1)
    surprise = agg[(agg["prev_min"] >= 60) & (agg["minutes"] == 0)]
    n = len(surprise)
    mean_xp = round(float(surprise["xP"].mean()), 3) if n else None
    verdict = "pre_deadline" if (mean_xp is not None and mean_xp >= THRESHOLD) else "contaminated"
    return {"season": season, "verdict": verdict, "surprise_blanks": n,
            "mean_xP": mean_xp, "pct_near_zero": round(float((surprise["xP"].abs() < 0.2).mean()), 3) if n else None}


def main():
    seasons = sorted(d.name for d in ROOT.iterdir() if d.is_dir() and len(d.name) == 7)
    results = [r for s in seasons if (r := gate_season(s))]
    print(f"{'season':<9}{'verdict':<14}{'mean_xP':>9}{'blanks':>8}{'near0%':>8}")
    for r in results:
        print(f"{r['season']:<9}{r['verdict']:<14}{str(r['mean_xP']):>9}{r['surprise_blanks']:>8}{str(r['pct_near_zero']):>8}")
    OUT.mkdir(exist_ok=True)
    (OUT / "xp_gate.json").write_text(json.dumps(results, indent=2))
    clean = [r["season"] for r in results if r["verdict"] == "pre_deadline"]
    print(f"\nclean-xP seasons (use raw xP): {clean}")
    print(f"wrote {OUT/'xp_gate.json'}")


if __name__ == "__main__":
    main()
