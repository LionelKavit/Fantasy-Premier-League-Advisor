#!/usr/bin/env python3
"""Convert the canonical CSV dataset to Parquet (preferred format for the fit/eval).
The TS builder writes CSV (human-inspectable, dependency-free); this derives the
typed, compact Parquet artifact the Python side reads."""
import sys
from pathlib import Path
import pandas as pd

OUT = Path(__file__).parent / "out"


def main():
    name = sys.argv[1] if len(sys.argv) > 1 else "dataset.csv"
    src = OUT / name
    dst = src.with_suffix(".parquet")
    df = pd.read_csv(src, low_memory=False)
    df.to_parquet(dst, index=False)
    print(f"{src.name} ({len(df)} rows) -> {dst.name}")


if __name__ == "__main__":
    main()
