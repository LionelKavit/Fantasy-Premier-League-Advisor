#!/usr/bin/env python3
"""granular-fixture-difficulty Task 1: does the strength-based fixture signal out-rank the
crude FDR? Compare within-(season,gw,position) rank-corr of realized next-3 points against
fdr-only, strength-only, and blends. Report-only; reads the existing dataset."""
import numpy as np, pandas as pd
from pathlib import Path
from scipy.stats import spearmanr

DS = Path(__file__).parent / "out" / "dataset.parquet"


def within(df, col):
    rs = [spearmanr(g[col], g.next3_points).statistic
          for _, g in df.groupby(["season", "gw", "position"])
          if len(g) >= 6 and g[col].nunique() > 1]
    return float(np.nanmean(rs))


def main():
    d = pd.read_parquet(DS)
    for c in ["low_minute", "has_fixture", "has_xg", "label_gws", "next3_points", "fdrScore", "opponentStrength"]:
        d[c] = pd.to_numeric(d[c], errors="coerce")
    e = d[(d.low_minute == 0) & (d.has_fixture == 1) & (d.has_xg == 1) & (d.label_gws == 3)].copy()
    print(f"eligible rows: {len(e)} (2020-25, fixture-complete)\n")

    print(f"{'fixture variant':<22}{'mean within-pos spearman vs next3':>34}")
    print(f"{'fdr-only':<22}{within(e, 'fdrScore'):>34.4f}")
    print(f"{'strength-only':<22}{within(e, 'opponentStrength'):>34.4f}")
    for a in (0.25, 0.5, 0.75):
        e["blend"] = a * e.opponentStrength + (1 - a) * e.fdrScore
        print(f"{f'blend a={a}':<22}{within(e, 'blend'):>34.4f}")

    print("\nper position (fdr vs strength vs best-blend a=0.25):")
    e["b25"] = 0.25 * e.opponentStrength + 0.75 * e.fdrScore
    for pos in ["GK", "DEF", "MID", "FWD"]:
        p = e[e.position == pos]
        print(f"  {pos}: fdr={within(p,'fdrScore'):.4f}  strength={within(p,'opponentStrength'):.4f}  blend={within(p,'b25'):.4f}")


if __name__ == "__main__":
    main()
