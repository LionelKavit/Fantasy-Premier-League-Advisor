#!/usr/bin/env python3
"""Unit tests for drift_live (run: python3 test_drift_live.py)."""
from pathlib import Path
import numpy as np
import pandas as pd
from drift_live import candidate_scores, saturation, drift, transfer_calibration_line, SATURATION
from test_fit_live import synthetic


def test_candidate_scores_squash():
    df = synthetic([4], n_per_pos=5)
    cand = {"SCORING_WEIGHTS": {p: {"epNext": 10.0} for p in ["GK", "DEF", "MID", "FWD"]},
            "COMPOSITE_SQUASH": {"center": 5.0, "scale": 1.0}}
    s = candidate_scores(df, cand)
    expected = 1 / (1 + np.exp(-(10 * df["sm_epNextSignal"] - 5.0) / 1.0))
    assert np.allclose(s.values, expected.values)


def test_saturation_counts_latest_gw():
    df = synthetic([4, 5], n_per_pos=10)
    df["composite"] = 0.5
    latest = df.gw == 5
    df.loc[latest, "composite"] = SATURATION  # every GW5 row saturated; GW4 untouched
    s = saturation(df)
    assert s["gw"] == 5 and s["all"] == 1.0 and s["eligible"] == 1.0 and s["n_all"] == 40


def test_drift_without_candidate_and_gate():
    df = synthetic(list(range(4, 9)), n_per_pos=30)
    d = drift(df, None, None, Path("/nonexistent/live-transfer-report.md"))
    assert d["window_gws"] == [6, 7, 8]
    assert "candidate" not in d["metrics"]["overall"]
    assert d["metrics"]["overall"]["xP"]["mean_spearman"] > 0.5
    assert d["transfer_calibration"].startswith("unavailable")


def test_transfer_line_parse(tmp_path=Path("/tmp")):
    p = tmp_path / "ltr-test.md"
    p.write_text("x\n**Calibration (n=3):** mean projected Δep 4.10 vs mean realized next-1 (in − out, net of hit) 2.33.\n")
    assert transfer_calibration_line(p) == "Calibration (n=3): mean projected Δep 4.10 vs mean realized next-1 (in − out, net of hit) 2.33."


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok  {name}")
    print("all drift_live tests passed")
