#!/usr/bin/env python3
"""
composite-refit-gate — weekly drift report (deterministic, no judgment).

On the last HOLDOUT_GWS labelled gameweeks of the universe dataset: within-position
Spearman + top-K precision of the shipped composite (the `composite` column), the current
candidate (out/live-weights-candidate.json, if any — recomputed as Σ w·sm → squash), and raw
ep_next. Plus the squash saturation share (composite ≥ SATURATION on the latest captured GW),
the projected-Δep vs realized line from the live transfer report, and the gate streak.

Run:  python3 research/composite-backtest/drift_live.py [path/to/live-dataset.parquet]
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from benchmark import per_group_metrics
from fit_live import eligible, split_gws, HOLDOUT_GWS, POSITIONS

HERE = Path(__file__).parent
OUT = HERE / "out"
SE = HERE.parent / "squad-eval"
DEFAULT_DATASET = SE / "live-dataset.parquet"
SATURATION = 0.98


def candidate_scores(rows: pd.DataFrame, cand: dict) -> pd.Series:
    """Composite under candidate weights + squash from the stored signal-map columns."""
    out = pd.Series(np.nan, index=rows.index)
    sq = cand["COMPOSITE_SQUASH"]
    for pos, w in cand["SCORING_WEIGHTS"].items():
        idx = rows.index[rows.position == pos]
        if len(idx) == 0:
            continue
        s = pd.Series(0.0, index=idx)
        for k, coef in w.items():
            col = "sm_epNextSignal" if k == "epNext" else f"sm_{k}"
            s = s + coef * pd.to_numeric(rows.loc[idx, col], errors="coerce").fillna(0)
        s = s + pd.to_numeric(rows.loc[idx, "trend_adj"], errors="coerce").fillna(0)
        out.loc[idx] = 1 / (1 + np.exp(-(s - sq["center"]) / sq["scale"]))
    return out


def saturation(df: pd.DataFrame, col: str = "composite") -> dict:
    """Share of rows at/above SATURATION on the latest captured GW (all rows, and eligible-only)."""
    if df.empty:
        return {"gw": None, "all": None, "eligible": None}
    gw = int(pd.to_numeric(df.gw, errors="coerce").max())
    latest = df[pd.to_numeric(df.gw, errors="coerce") == gw]
    comp = pd.to_numeric(latest[col], errors="coerce")
    elig = latest[pd.to_numeric(latest.low_minute, errors="coerce") == 0]
    ecomp = pd.to_numeric(elig[col], errors="coerce")
    return {"gw": gw, "all": round(float((comp >= SATURATION).mean()), 4) if len(comp) else None,
            "eligible": round(float((ecomp >= SATURATION).mean()), 4) if len(ecomp) else None,
            "n_all": int(len(comp)), "n_eligible": int(len(ecomp))}


def transfer_calibration_line(report: Path) -> str:
    if not report.exists():
        return "unavailable — no live-transfer-report.md"
    m = re.search(r"\*\*Calibration \(n=\d+\):\*\*[^\n]*", report.read_text())
    return m.group(0).replace("**", "") if m else "unavailable — no scored transfer gameweek yet"


def drift(df: pd.DataFrame, cand: dict | None, gate: dict | None, transfer_report: Path) -> dict:
    elig = eligible(df)
    _, window = split_gws(elig.gw.unique())
    win = elig[elig.gw.isin(window)].copy()
    for c in ["composite", "xP"]:
        win[c] = pd.to_numeric(win[c], errors="coerce")
    if cand is not None and not win.empty:
        win["candidate"] = candidate_scores(win, cand)
    preds = ["composite", "xP"] + (["candidate"] if "candidate" in win else [])
    metrics = {"overall": {p: per_group_metrics(win, p) for p in preds} if not win.empty else {},
               "by_position": {pos: {p: per_group_metrics(win[win.position == pos], p) for p in preds}
                               for pos in POSITIONS} if not win.empty else {}}
    return {
        "window_gws": window, "window_rows": int(len(win)),
        "metrics": metrics,
        "saturation": saturation(df),
        "candidate_present": cand is not None,
        "gate": gate,
        "transfer_calibration": transfer_calibration_line(transfer_report),
    }


def write_md(d: dict) -> str:
    ov = d["metrics"].get("overall", {})
    def cell(p):
        m = ov.get(p)
        return f"{m['mean_spearman']} (top5 {m['top5_precision']}, n={m['rows']})" if m else "insufficient"
    gate = d.get("gate") or {}
    streak = gate.get("streak", 0)
    headline = (f"**Drift GW{d['window_gws'][0]}–{d['window_gws'][-1]}: shipped {cell('composite')} · "
                f"candidate {cell('candidate') if d['candidate_present'] else 'none'} · ep_next {cell('xP')} · "
                f"saturation {d['saturation']['eligible']} · gate {streak}/2 consecutive**"
                if d["window_gws"] else "**Drift: no labelled gameweeks yet**")
    L = ["# Live drift (composite-refit-gate)", "", headline, "",
         f"Window: last {HOLDOUT_GWS} labelled GWs = {d['window_gws'] or '—'} ({d['window_rows']} eligible rows).", "",
         "| predictor | spearman | top5 | groups | rows |", "|---|---|---|---|---|"]
    for p, lab in [("composite", "shipped composite"), ("candidate", "candidate"), ("xP", "raw ep_next")]:
        m = ov.get(p)
        if p == "candidate" and not d["candidate_present"]:
            L.append("| candidate | none (below sample floors) | | | |")
        else:
            L.append(f"| {lab} | {m['mean_spearman']} | {m['top5_precision']} | {m['groups']} | {m['rows']} |" if m else f"| {lab} | insufficient | | | |")
    bp = d["metrics"].get("by_position", {})
    if bp:
        L += ["", "| position | shipped | candidate | ep_next |", "|---|---|---|---|"]
        for pos in POSITIONS:
            r = bp.get(pos, {})
            f = lambda k: (r.get(k) or {}).get("mean_spearman", "—")
            L.append(f"| {pos} | {f('composite')} | {f('candidate') if d['candidate_present'] else '—'} | {f('xP')} |")
    s = d["saturation"]
    L += ["", f"Squash saturation (composite ≥ {SATURATION}) on GW{s['gw']}: all rows {s['all']} (n={s.get('n_all')}), "
             f"eligible rows {s['eligible']} (n={s.get('n_eligible')}).",
          "", f"Transfer calibration: {d['transfer_calibration']}", ""]
    if gate:
        L += [f"Gate (last run {gate.get('at', '?')}): pass={gate.get('pass')} streak={streak}; " +
              "; ".join(f"{k}={'✓' if v.get('ok') else '✗'}" for k, v in (gate.get('criteria') or {}).items()), ""]
    return "\n".join(L)


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_DATASET
    OUT.mkdir(exist_ok=True)
    df = pd.read_parquet(path)
    cand_p, gate_p = OUT / "live-weights-candidate.json", OUT / "gate.json"
    cand = json.loads(cand_p.read_text()) if cand_p.exists() else None
    gate = json.loads(gate_p.read_text()) if gate_p.exists() else None
    d = drift(df, cand, gate, SE / "live-transfer-report.md")
    (OUT / "live-drift.json").write_text(json.dumps(d, indent=2, default=str))
    (OUT / "live-drift.md").write_text(write_md(d))
    print(write_md(d))


if __name__ == "__main__":
    main()
