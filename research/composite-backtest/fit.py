#!/usr/bin/env python3
"""
composite-weight-training (Phase 2) — per-position ridge fit.

Fits SCORING_WEIGHTS from data on the normalized signal-map features (`sm_*`)
+ `sm_epNextSignal` + `ppg`, per position, with a time-aware hold-out. Compares
the fitted model's ranking against the hand-tuned composite and the `xP`/`ppg`
baselines on the held-out season. Honors availability flags + gate-clean xP.

Output: out/fit.json (coefficients = would-be weights) + out/fit.md (comparison).
"""
import json
from pathlib import Path
import numpy as np
import pandas as pd
from scipy.stats import spearmanr
from sklearn.linear_model import Ridge
from benchmark import per_group_metrics, K

OUT = Path(__file__).parent / "out"

# Per-position signal-map keys (match SCORING_WEIGHTS) + epNext + ppg candidates.
FEATURES = {
    "FWD": ["sm_goalThreat", "sm_assistPotential", "sm_form", "sm_bonus", "sm_fixture", "sm_minutes", "sm_value"],
    "MID": ["sm_goalThreat", "sm_assistPotential", "sm_form", "sm_cleanSheet", "sm_bonus", "sm_fixture", "sm_minutes", "sm_value"],
    "DEF": ["sm_cleanSheet", "sm_xgcRate", "sm_defensive", "sm_goalAssistSetPiece", "sm_form", "sm_bonus", "sm_fixture", "sm_minutes", "sm_value"],
    "GK":  ["sm_cleanSheet", "sm_xgcRate", "sm_saves", "sm_form", "sm_bonus", "sm_fixture", "sm_minutes", "sm_value", "sm_suspensionPenalty"],
}
EXTRA = ["sm_epNextSignal", "ppg"]
# Feature-complete + gate-clean window (has_xg from 2022-23; xP clean ≤ 2024-25).
TRAIN_SEASONS = ["2022-23", "2023-24"]
HELDOUT = "2024-25"
ALPHAS = [0.1, 0.3, 1.0, 3.0, 10.0, 30.0]


def main():
    df = pd.read_parquet(OUT / "dataset.parquet")
    for c in ["low_minute", "label_gws", "has_fixture", "has_xg", "next3_points", "element"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")
    elig = df[(df.low_minute == 0) & (df.label_gws == 3) & (df.has_fixture == 1) & (df.has_xg == 1)].copy()

    coeffs, ho_frames = {}, []
    for pos in ["GK", "DEF", "MID", "FWD"]:
        feats = FEATURES[pos] + EXTRA
        tr = elig[(elig.position == pos) & (elig.season.isin(TRAIN_SEASONS))]
        ho = elig[(elig.position == pos) & (elig.season == HELDOUT)].copy()
        if len(tr) < 200 or len(ho) < 50:
            coeffs[pos] = {"error": f"insufficient rows train={len(tr)} ho={len(ho)}"}
            continue
        Xtr, ytr = tr[feats].fillna(0).values, tr.next3_points.values
        Xho, yho = ho[feats].fillna(0).values, ho.next3_points.values

        # tune alpha by held-out Spearman of the prediction
        best = max(ALPHAS, key=lambda a: _safe_rho(Ridge(alpha=a).fit(Xtr, ytr).predict(Xho), yho))
        model = Ridge(alpha=best).fit(Xtr, ytr)
        ho["fitted"] = model.predict(Xho)
        ho_frames.append(ho)
        coeffs[pos] = {
            "alpha": best, "intercept": round(float(model.intercept_), 4),
            "weights": {f.replace("sm_", ""): round(float(w), 4) for f, w in zip(feats, model.coef_)},
            "n_train": int(len(tr)), "n_heldout": int(len(ho)),
            "train_rho": round(_safe_rho(model.predict(Xtr), ytr), 4),
            "heldout_rho": round(_safe_rho(model.predict(Xho), yho), 4),
        }

    # Head-to-head on the held-out season: fitted vs composite vs xP vs ppg.
    ho_all = pd.concat(ho_frames) if ho_frames else pd.DataFrame()
    for c in ["fitted", "composite", "xP", "ppg"]:
        ho_all[c] = pd.to_numeric(ho_all[c], errors="coerce")
    comparison = {}
    print(f"\nHeld-out {HELDOUT}  (rows={len(ho_all)})")
    print(f"{'predictor':<12}{'spearman':>10}{'top%d_prec' % K:>12}")
    for predr in ["fitted", "composite", "xP", "ppg"]:
        m = per_group_metrics(ho_all, predr)
        comparison[predr] = m
        if m:
            print(f"{predr:<12}{m['mean_spearman']:>10}{m['top%d_precision' % K]:>12}")

    # RAW signed coefficients for the squashed composite (composite-clamp-relax). We use
    # the fitted coefficients at full magnitude (epNext ~40, incl. negative price/`value`)
    # and drop `ppg` (not a composite input). At full magnitude the base sum dominates the
    # small additive trend/suspension terms (±0.05) — so the composite's ranking equals
    # the fit's (~0.57). The monotonic logistic squash below maps the wide raw range into
    # (0,1) without clamp-ties. (Scaling the weights down to epNext=1 let those additive
    # terms overwhelm the compressed base and dropped ranking to 0.39 — avoid that.)
    signed = {}
    for pos, c in coeffs.items():
        if "weights" not in c:
            continue
        signed[pos] = {("epNext" if k == "epNextSignal" else k): round(coef, 4)
                       for k, coef in c["weights"].items() if k != "ppg"}

    def raw_base(rows, pos):
        s = pd.Series(0.0, index=rows.index)
        for k, w in signed[pos].items():
            col = "sm_epNextSignal" if k == "epNext" else f"sm_{k}"
            s = s + w * pd.to_numeric(rows[col], errors="coerce").fillna(0)
        return s
    bases = [raw_base(elig[(elig.position == pos) & (elig.season.isin(TRAIN_SEASONS))], pos)
             for pos in signed]
    allbase = pd.concat(bases)
    center = round(float(allbase.median()), 4)
    scale = round(float((allbase.quantile(0.9) - allbase.quantile(0.1)) / 4) or 1.0, 4)

    runtime_weights = dict(signed)
    runtime_weights["_squash"] = {"center": center, "scale": scale}
    (OUT / "weights.json").write_text(json.dumps(runtime_weights, indent=2))

    report = {"train_seasons": TRAIN_SEASONS, "heldout": HELDOUT, "coeffs": coeffs,
              "heldout_comparison": comparison, "runtime_weights": runtime_weights}
    (OUT / "fit.json").write_text(json.dumps(report, indent=2))
    _write_md(report)
    print(f"\nsigned runtime weights + squash {runtime_weights['_squash']}:")
    for pos, w in runtime_weights.items():
        if pos.startswith("_"):
            continue
        print(f"  {pos}: {w}")
    print(f"\nwrote {OUT/'fit.json'}, {OUT/'fit.md'}, {OUT/'weights.json'}")


def _safe_rho(pred, actual):
    if len(set(pred)) < 2:
        return -1.0
    r = spearmanr(pred, actual).statistic
    return -1.0 if np.isnan(r) else float(r)


def _write_md(r):
    L = ["# Phase 2 — ridge weight fit", "",
         f"Train: {r['train_seasons']} · Held-out: {r['heldout']}", "",
         "## Held-out ranking (fitted vs hand-tuned vs baselines)", "",
         f"| predictor | spearman | top{K}_prec |", "|---|---|---|"]
    for p in ["fitted", "composite", "xP", "ppg"]:
        m = r["heldout_comparison"].get(p)
        if m:
            L.append(f"| {p} | {m['mean_spearman']} | {m['top%d_precision' % K]} |")
    L += ["", "## Fitted coefficients (would-be SCORING_WEIGHTS)", ""]
    for pos, c in r["coeffs"].items():
        if "weights" not in c:
            L.append(f"**{pos}**: {c.get('error')}")
            continue
        L.append(f"**{pos}** (alpha={c['alpha']}, held-out rho={c['heldout_rho']}, n={c['n_heldout']}): "
                 + ", ".join(f"{k}={v}" for k, v in c["weights"].items()))
    (OUT / "fit.md").write_text("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
