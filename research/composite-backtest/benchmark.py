#!/usr/bin/env python3
"""
composite-backtest — Phase 1 benchmark.

Scores each predictor (the app's `composite`, plus baselines `xP` and `ppg`)
against the realized next-3-GW points, using rank-correlation-within-position
and top-K precision. Answers: is the composite reliable, and does it beat
FPL's own numbers?

Metrics here are the ones a player-universe dataset supports. Captain hit-rate
and transfer realized gain need a manager-squad simulation (not in this dataset)
and are deferred to a follow-up.
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

OUT = Path(__file__).parent / "out"
K = 5            # top-K precision
MIN_GROUP = 6    # skip (season,gw,position) groups smaller than this
PREDICTORS = ["composite", "xP", "ppg"]


def per_group_metrics(df: pd.DataFrame, pred: str):
    """Mean Spearman + top-K precision over (season, gw, position) groups."""
    rhos, precs, weights = [], [], []
    for _, g in df.groupby(["season", "gw", "position"], sort=False):
        g = g.dropna(subset=[pred, "next3_points"])
        n = len(g)
        if n < MIN_GROUP:
            continue
        if g[pred].nunique() < 2 or g["next3_points"].nunique() < 2:
            continue
        rho = spearmanr(g[pred], g["next3_points"]).statistic
        if np.isnan(rho):
            continue
        top_pred = set(g.nlargest(K, pred)["element"])
        top_act = set(g.nlargest(K, "next3_points")["element"])
        rhos.append(rho)
        precs.append(len(top_pred & top_act) / K)
        weights.append(n)
    if not rhos:
        return None
    w = np.array(weights)
    return {
        "mean_spearman": round(float(np.average(rhos, weights=w)), 4),
        "top%d_precision" % K: round(float(np.average(precs, weights=w)), 4),
        "groups": len(rhos),
        "rows": int(w.sum()),
    }


def evaluate(df: pd.DataFrame, label: str):
    print(f"\n## {label}  (rows={len(df)})")
    block = {"rows": len(df), "by_position": {}, "overall": {}}
    for pos in ["GK", "DEF", "MID", "FWD"]:
        sub = df[df["position"] == pos]
        block["by_position"][pos] = {p: per_group_metrics(sub, p) for p in PREDICTORS}
    block["overall"] = {p: per_group_metrics(df, p) for p in PREDICTORS}
    # pretty print overall
    print(f"{'predictor':<12}{'spearman':>10}{'top%d_prec' % K:>12}{'groups':>9}")
    for p in PREDICTORS:
        m = block["overall"].get(p)
        if m:
            print(f"{p:<12}{m['mean_spearman']:>10}{m['top%d_precision' % K]:>12}{m['groups']:>9}")
        else:
            print(f"{p:<12}{'n/a':>10}")
    return block


def main():
    arg = sys.argv[1] if len(sys.argv) > 1 else "dataset"
    base = OUT / arg
    # Prefer Parquet (typed/compact) when present; fall back to CSV.
    pq = base.with_suffix(".parquet")
    path = pq if pq.exists() else (base if base.suffix else base.with_suffix(".csv"))
    df = pd.read_parquet(path) if str(path).endswith(".parquet") else pd.read_csv(path, low_memory=False)
    for c in PREDICTORS + ["next3_points", "low_minute", "label_gws", "has_xP", "element"]:
        df[c] = pd.to_numeric(df[c], errors="coerce")

    # Eligible: full 3-GW label window, not a low-minute placeholder.
    elig = df[(df["label_gws"] == 3) & (df["low_minute"] == 0)].copy()

    report = {"source": str(path), "eligible_rows": len(elig), "K": K, "blocks": {}}

    # All eligible — composite vs ppg (xP may be absent in older seasons).
    report["blocks"]["all_eligible"] = evaluate(elig, "ALL ELIGIBLE (composite vs ppg; xP where present)")

    # Head-to-head on the xP-available subset — restricted to GATE-CLEAN seasons
    # (per-season xP integrity gate), so xP isn't credited on contaminated data.
    gate_path = OUT / "xp_gate.json"
    clean = set()
    if gate_path.exists():
        clean = {r["season"] for r in json.loads(gate_path.read_text()) if r["verdict"] == "pre_deadline"}
    report["clean_xp_seasons"] = sorted(clean)
    print(f"\n(gate-clean xP seasons: {sorted(clean)})")
    xp_sub = elig[(elig["has_xP"] == 1) & (elig["season"].isin(clean))]
    report["blocks"]["xp_clean_seasons"] = evaluate(xp_sub, "xP CLEAN-SEASON SUBSET (composite vs xP vs ppg, gate-passed rows only)")

    (OUT / "benchmark.json").write_text(json.dumps(report, indent=2))
    write_markdown(report)
    print(f"\nwrote {OUT/'benchmark.json'} and {OUT/'benchmark.md'}")


def write_markdown(report):
    lines = ["# Composite backtest — benchmark report", ""]
    lines.append(f"Source: `{Path(report['source']).name}` · eligible rows: {report['eligible_rows']} · top-K = {report['K']}")
    lines.append("")
    lines.append("> Higher Spearman / top-K precision = better ranking vs realized next-3-GW points. "
                 "Captain hit-rate & transfer realized gain need a manager-squad simulation (deferred).")
    for name, block in report["blocks"].items():
        lines += ["", f"## {name}  (rows={block['rows']})", "",
                  f"| scope | predictor | spearman | top{report['K']}_prec | groups |",
                  "|---|---|---|---|---|"]
        for scope in ["overall"] + [f"pos:{p}" for p in ["GK", "DEF", "MID", "FWD"]]:
            data = block["overall"] if scope == "overall" else block["by_position"][scope.split(":")[1]]
            for p in PREDICTORS:
                m = data.get(p)
                if m:
                    lines.append(f"| {scope} | {p} | {m['mean_spearman']} | {m['top%d_precision' % report['K']]} | {m['groups']} |")
    (OUT / "benchmark.md").write_text("\n".join(lines) + "\n")


if __name__ == "__main__":
    main()
