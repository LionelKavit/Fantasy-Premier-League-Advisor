#!/usr/bin/env python3
"""
composite-refit-gate — live refit on the universe dataset (research/squad-eval/live-dataset.parquet).

Reuses fit.py's machinery (per-position ridge on the normalized signal map + epNext + ppg,
alpha grid tuned on held-out Spearman, squash calibrated from the training raw-score
distribution) with a ROLLING, time-aware holdout: train = every labelled gameweek except the
last HOLDOUT_GWS; holdout = those last gameweeks. The shipped baseline is the dataset's own
`composite` column (the lite composite the shipped weights produced at capture time).

Outputs (out/): live-fit.json, live-fit.md, and — only when EVERY position clears the sample
floors — live-weights-candidate.json ({SCORING_WEIGHTS, COMPOSITE_SQUASH} in the shape of
lib/scoring-weights.json). A stale candidate file is removed when the floors are not met.

Run:  python3 research/composite-backtest/fit_live.py [path/to/live-dataset.parquet]
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge

from fit import FEATURES, EXTRA, ALPHAS, _safe_rho
from benchmark import per_group_metrics

HERE = Path(__file__).parent
OUT = HERE / "out"
DEFAULT_DATASET = HERE.parent / "squad-eval" / "live-dataset.parquet"
HOLDOUT_GWS = 3
MIN_TRAIN = 200   # rows per position (fit.py's floor)
MIN_HOLDOUT = 100
POSITIONS = ["GK", "DEF", "MID", "FWD"]
NUMERIC = ["low_minute", "label_gws", "has_fixture", "has_xg", "next3_points", "element", "gw", "composite", "xP"]


def eligible(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    for c in NUMERIC:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    return df[(df.low_minute == 0) & (df.label_gws == 3) & (df.has_fixture == 1) & (df.has_xg == 1)].copy()


def split_gws(labelled_gws, holdout_n: int = HOLDOUT_GWS):
    """Rolling time-aware split: the last `holdout_n` labelled gameweeks are held out."""
    gws = sorted(set(int(g) for g in labelled_gws))
    if len(gws) <= holdout_n:
        return [], gws
    return gws[:-holdout_n], gws[-holdout_n:]


def squash_from_train(train: pd.DataFrame, signed: dict) -> dict:
    """fit.py's rule: center = median raw base, scale = (q90 − q10) / 4 over TRAIN rows."""
    bases = []
    for pos, w in signed.items():
        rows = train[train.position == pos]
        if rows.empty:
            continue
        s = pd.Series(0.0, index=rows.index)
        for k, coef in w.items():
            col = "sm_epNextSignal" if k == "epNext" else f"sm_{k}"
            s = s + coef * pd.to_numeric(rows[col], errors="coerce").fillna(0)
        bases.append(s)
    allbase = pd.concat(bases) if bases else pd.Series([0.0])
    center = round(float(allbase.median()), 4)
    scale = round(float((allbase.quantile(0.9) - allbase.quantile(0.1)) / 4) or 1.0, 4)
    return {"center": center, "scale": scale}


def fit_live(df: pd.DataFrame) -> dict:
    elig = eligible(df)
    train_gws, holdout_gws = split_gws(elig.gw.unique())
    tr_all = elig[elig.gw.isin(train_gws)]
    ho_all = elig[elig.gw.isin(holdout_gws)].copy()
    positions, signed, ho_frames = {}, {}, []
    for pos in POSITIONS:
        feats = FEATURES[pos] + EXTRA
        tr = tr_all[tr_all.position == pos]
        ho = ho_all[ho_all.position == pos].copy()
        if len(tr) < MIN_TRAIN or len(ho) < MIN_HOLDOUT:
            positions[pos] = {"status": "insufficient", "n_train": int(len(tr)), "n_heldout": int(len(ho)),
                              "floors": {"train": MIN_TRAIN, "heldout": MIN_HOLDOUT}}
            continue
        Xtr, ytr = tr[feats].fillna(0).values, tr.next3_points.values
        Xho, yho = ho[feats].fillna(0).values, ho.next3_points.values
        best = max(ALPHAS, key=lambda a: _safe_rho(Ridge(alpha=a).fit(Xtr, ytr).predict(Xho), yho))
        model = Ridge(alpha=best).fit(Xtr, ytr)
        ho["fitted"] = model.predict(Xho)
        ho_frames.append(ho)
        weights = {f.replace("sm_", ""): round(float(w), 4) for f, w in zip(feats, model.coef_)}
        signed[pos] = {("epNext" if k == "epNextSignal" else k): v for k, v in weights.items() if k != "ppg"}
        positions[pos] = {
            "status": "fitted", "alpha": best, "intercept": round(float(model.intercept_), 4),
            "weights": weights, "n_train": int(len(tr)), "n_heldout": int(len(ho)),
            "train_rho": round(_safe_rho(model.predict(Xtr), ytr), 4),
            "heldout_rho": round(_safe_rho(model.predict(Xho), yho), 4),
        }
    complete = all(p.get("status") == "fitted" for p in positions.values())
    comparison = {}
    if ho_frames:
        ho_cmp = pd.concat(ho_frames)
        for c in ["fitted", "composite", "xP"]:
            ho_cmp[c] = pd.to_numeric(ho_cmp[c], errors="coerce")
        comparison = {
            "overall": {"candidate": per_group_metrics(ho_cmp, "fitted"),
                        "shipped_composite": per_group_metrics(ho_cmp, "composite"),
                        "ep_next": per_group_metrics(ho_cmp, "xP")},
            "by_position": {pos: {"candidate": per_group_metrics(ho_cmp[ho_cmp.position == pos], "fitted"),
                                  "shipped_composite": per_group_metrics(ho_cmp[ho_cmp.position == pos], "composite"),
                                  "ep_next": per_group_metrics(ho_cmp[ho_cmp.position == pos], "xP")}
                            for pos in POSITIONS if pos in signed},
        }
    candidate = None
    if complete:
        candidate = {"SCORING_WEIGHTS": signed, "COMPOSITE_SQUASH": squash_from_train(tr_all, signed)}
    return {
        "dataset_rows": int(len(df)), "eligible_rows": int(len(elig)),
        "labelled_gws": sorted(int(g) for g in elig.gw.unique()),
        "train_gws": train_gws, "holdout_gws": holdout_gws,
        "positions": positions, "complete": complete,
        "heldout_comparison": comparison, "candidate": candidate,
    }


def write_md(r: dict) -> str:
    L = ["# Live refit (composite-refit-gate)", "",
         f"Rows {r['dataset_rows']} · eligible {r['eligible_rows']} · labelled GWs {r['labelled_gws'] or '—'} · "
         f"train {r['train_gws'] or '—'} · holdout {r['holdout_gws'] or '—'}", "",
         "| position | status | n_train | n_heldout | alpha | heldout ρ |", "|---|---|---|---|---|---|"]
    for pos in POSITIONS:
        p = r["positions"].get(pos, {})
        if p.get("status") == "fitted":
            L.append(f"| {pos} | fitted | {p['n_train']} | {p['n_heldout']} | {p['alpha']} | {p['heldout_rho']} |")
        else:
            L.append(f"| {pos} | insufficient (n={p.get('n_train', 0)}/{p.get('n_heldout', 0)}, floors {MIN_TRAIN}/{MIN_HOLDOUT}) | {p.get('n_train', 0)} | {p.get('n_heldout', 0)} | — | — |")
    ov = (r.get("heldout_comparison") or {}).get("overall") or {}
    if ov:
        L += ["", "## Held-out (last %d labelled GWs), row-weighted across positions" % HOLDOUT_GWS, "",
              "| predictor | spearman | top5 | groups | rows |", "|---|---|---|---|---|"]
        for k, lab in [("candidate", "candidate"), ("shipped_composite", "shipped composite"), ("ep_next", "raw ep_next")]:
            m = ov.get(k)
            L.append(f"| {lab} | {m['mean_spearman']} | {m['top5_precision']} | {m['groups']} | {m['rows']} |" if m else f"| {lab} | unavailable | | | |")
    if r["candidate"]:
        L += ["", f"Candidate squash: {r['candidate']['COMPOSITE_SQUASH']}", ""]
    else:
        L += ["", "No candidate emitted — at least one position is below the sample floors.", ""]
    return "\n".join(L)


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DATASET
    OUT.mkdir(exist_ok=True)
    df = pd.read_parquet(path)
    r = fit_live(df)
    (OUT / "live-fit.json").write_text(json.dumps(r, indent=2))
    (OUT / "live-fit.md").write_text(write_md(r))
    cand = OUT / "live-weights-candidate.json"
    if r["candidate"]:
        cand.write_text(json.dumps(r["candidate"], indent=2) + "\n")
    elif cand.exists():
        cand.unlink()
    print(write_md(r))


if __name__ == "__main__":
    main()
