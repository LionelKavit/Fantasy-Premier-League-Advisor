#!/usr/bin/env python3
"""Unit tests for fit_live (run: python3 test_fit_live.py)."""
import numpy as np
import pandas as pd
from fit_live import split_gws, eligible, squash_from_train, fit_live, MIN_TRAIN, MIN_HOLDOUT
from fit import FEATURES, EXTRA


def synthetic(gws, n_per_pos=60, seed=0, strong=True):
    """Universe-like rows where next3_points follows sm_form (strong) and the shipped `composite` is noise."""
    rng = np.random.default_rng(seed)
    rows = []
    for gw in gws:
        for pos in ["GK", "DEF", "MID", "FWD"]:
            for i in range(n_per_pos):
                sm = {f: rng.uniform(0, 1) for f in sorted({c for p in FEATURES for c in FEATURES[p]} | {"sm_epNextSignal"})}
                y = 10 * sm["sm_form"] + rng.normal(0, 0.5) if strong else rng.normal(5, 2)
                rows.append({"season": "2026-27", "gw": gw, "position": pos, "element": 10_000 * gw + 100 * ["GK", "DEF", "MID", "FWD"].index(pos) + i,
                             "next3_points": y, "composite": rng.uniform(0, 1), "xP": y + rng.normal(0, 4), "ppg": rng.uniform(0, 8),
                             "trend_adj": 0.0, "low_minute": 0, "label_gws": 3, "has_fixture": 1, "has_xg": 1, **sm})
    return pd.DataFrame(rows)


def test_split_gws():
    assert split_gws([4, 5, 6, 7, 8]) == ([4, 5], [6, 7, 8])
    assert split_gws([4, 5, 6]) == ([], [4, 5, 6])
    assert split_gws([]) == ([], [])


def test_eligible_filters():
    df = synthetic([4], n_per_pos=3)
    df.loc[0, "low_minute"] = 1
    df.loc[1, "label_gws"] = 2
    e = eligible(df)
    assert len(e) == len(df) - 2


def test_squash_rule():
    df = synthetic([4], n_per_pos=50)
    signed = {pos: {"epNext": 10.0, "form": 2.0} for pos in ["GK", "DEF", "MID", "FWD"]}
    sq = squash_from_train(df, signed)
    base = 10 * df["sm_epNextSignal"] + 2 * df["sm_form"]
    assert abs(sq["center"] - round(float(base.median()), 4)) < 1e-6
    assert abs(sq["scale"] - round(float((base.quantile(0.9) - base.quantile(0.1)) / 4), 4)) < 1e-6


def test_fit_live_insufficient_then_complete():
    small = synthetic([4, 5, 6, 7], n_per_pos=20)  # 20 train rows/pos → insufficient
    r = fit_live(small)
    assert not r["complete"] and r["candidate"] is None
    assert all(p["status"] == "insufficient" for p in r["positions"].values())
    big = synthetic(list(range(4, 12)), n_per_pos=60)  # 5 train GWs × 60 = 300 ≥ 200; holdout 180 ≥ 100
    r = fit_live(big)
    assert r["complete"] and r["candidate"] is not None
    assert r["train_gws"] == [4, 5, 6, 7, 8] and r["holdout_gws"] == [9, 10, 11]
    for pos in ["GK", "DEF", "MID", "FWD"]:
        assert r["positions"][pos]["n_train"] >= MIN_TRAIN and r["positions"][pos]["n_heldout"] >= MIN_HOLDOUT
        assert "ppg" not in r["candidate"]["SCORING_WEIGHTS"][pos]
        assert "epNext" in r["candidate"]["SCORING_WEIGHTS"][pos]
    ov = r["heldout_comparison"]["overall"]
    assert ov["candidate"]["mean_spearman"] > ov["shipped_composite"]["mean_spearman"] + 0.3  # noise baseline vs real signal


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok  {name}")
    print("all fit_live tests passed")
