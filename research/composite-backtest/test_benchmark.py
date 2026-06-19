#!/usr/bin/env python3
"""Unit tests for the benchmark metric computation (run: python3 test_benchmark.py)."""
import pandas as pd
from benchmark import per_group_metrics, K, MIN_GROUP


def _df(pred_values, actual_values):
    n = len(pred_values)
    return pd.DataFrame({
        "season": ["s"] * n, "gw": [1] * n, "position": ["MID"] * n,
        "element": list(range(n)), "pred": pred_values, "next3_points": actual_values,
    })


def test_perfect_ranking():
    n = max(MIN_GROUP, 2 * K)
    df = _df(list(range(n)), list(range(n)))  # predictor order == actual order
    m = per_group_metrics(df, "pred")
    assert m["mean_spearman"] == 1.0, m
    assert m[f"top{K}_precision"] == 1.0, m


def test_reversed_ranking():
    # n >= 2K so the predictor's top-K and the actual top-K are disjoint.
    n = max(MIN_GROUP, 2 * K)
    df = _df(list(range(n)), list(range(n - 1, -1, -1)))  # exactly inverted
    m = per_group_metrics(df, "pred")
    assert m["mean_spearman"] == -1.0, m
    assert m[f"top{K}_precision"] == 0.0, m


def test_small_group_skipped():
    df = _df(list(range(MIN_GROUP - 1)), list(range(MIN_GROUP - 1)))
    assert per_group_metrics(df, "pred") is None


if __name__ == "__main__":
    test_perfect_ranking()
    test_reversed_ranking()
    test_small_group_skipped()
    print("ok: benchmark metric tests passed")
