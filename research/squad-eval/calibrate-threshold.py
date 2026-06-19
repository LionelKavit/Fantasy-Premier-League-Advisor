#!/usr/bin/env python3
"""transfer-hold-threshold — Task 1: derive the free-transfer bar from data.

For same-(season,gw,position) one-for-one swaps, relate the projected edge to the
realized payoff: x = Δep (xP_in - xP_out, the 1-GW projection diff, the runtime decision
unit), y = realized next-3 gain (next3_out subtracted from next3_in). Below some edge the
swap is a coin flip — not worth spending a free transfer. We report the curve so τ is
auditable; the runtime hit bar stays the exact 4 pts.

Reads the composite-backtest dataset; writes a calibration report. No runtime code.
"""
import numpy as np, pandas as pd
from pathlib import Path

DS = Path(__file__).parent.parent / "composite-backtest" / "out" / "dataset.parquet"
RNG = np.random.default_rng(42)
PAIRS_PER_GROUP = 60


def sample_pairs(df, edge_col):
    """Random within-group ordered swaps -> (Δedge, Δrealized_next3)."""
    xs, ys = [], []
    for _, g in df.groupby(["season", "gw", "position"], sort=False):
        e = g[edge_col].to_numpy(); r = g["next3_points"].to_numpy()
        n = len(g)
        if n < 6:
            continue
        a = RNG.integers(0, n, PAIRS_PER_GROUP)
        b = RNG.integers(0, n, PAIRS_PER_GROUP)
        ok = a != b
        xs.append(e[b][ok] - e[a][ok])   # in - out
        ys.append(r[b][ok] - r[a][ok])
    return np.concatenate(xs), np.concatenate(ys)


def curve(x, y, edges):
    print(f"  {'Δedge bin':>14}{'n':>9}{'mean Δnext3':>13}{'P(gain>0)':>11}")
    rows = []
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (x >= lo) & (x < hi)
        if m.sum() < 50:
            continue
        yy = y[m]
        rows.append((lo, hi, m.sum(), yy.mean(), (yy > 0).mean()))
        print(f"  {f'[{lo:.2f},{hi:.2f})':>14}{m.sum():>9}{yy.mean():>13.2f}{(yy > 0).mean():>11.2f}")
    return rows


def main():
    df = pd.read_parquet(DS)
    for c in ["low_minute", "has_fixture", "has_xg", "label_gws", "next3_points", "xP", "composite"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    e = df[(df.low_minute == 0) & (df.has_fixture == 1) & (df.has_xg == 1) & (df.label_gws == 3)].copy()
    print(f"eligible rows: {len(e)}\n")

    print("=== Δep (xP_in - xP_out, points) vs realized next-3 gain ===")
    xe, ye = sample_pairs(e, "xP")
    curve(xe, ye, np.arange(0, 6.01, 0.5))

    print("\n=== Δcomposite (gw1Gain analog) vs realized next-3 gain ===")
    xc, yc = sample_pairs(e, "composite")
    curve(xc, yc, np.arange(0, 0.61, 0.05))

    # τ: smallest positive Δep where the swap is meaningfully better than a coin flip
    # (P(gain>0) >= 0.55) AND mean gain clearly positive — i.e. the edge beats noise.
    def threshold(x, y, edges, p_target=0.55):
        for lo, hi in zip(edges[:-1], edges[1:]):
            m = (x >= lo) & (x < hi)
            if m.sum() < 50:
                continue
            yy = y[m]
            if (yy > 0).mean() >= p_target and yy.mean() > 0:
                return lo
        return None
    tau = threshold(xe, ye, np.arange(0, 6.01, 0.5))
    tau_c = threshold(xc, yc, np.arange(0, 0.61, 0.05))
    print(f"\nτ (free-transfer bar, points Δep)  ≈ {tau}   [bracket 0<τ<4; FPL heuristic ~1.5-2]")
    print(f"τ_c (composite-units fallback)     ≈ {tau_c}")
    print("hit bar = 4 (exact FPL hit cost)")


if __name__ == "__main__":
    main()
