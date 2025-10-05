"""
Produce YEAR, MONTH, LEVEL (AVG) for monthly predicted PM2.5.

By default the script computes Year+Month averages from the input CSV using the
predict_value_(t+3) column (auto-detected) and a date column (auto-detected,
prefer predict_day_(t+3) or original_day). Use --project to build a future grid
(starting at --start-year for --years) filled by monthly climatology.

Output columns: YEAR, MONTH, LEVEL (AVG)

Examples:
  python predict.py predicted_hanoi.csv --out monthly_long.csv
  python predict.py predicted_Manila.csv --project --start-year 2026 --years 3 --out monthly_long.csv --pivot-out Manila_monthly_pivot.csv
"""
import argparse
import sys
from pathlib import Path

import numpy as np
import pandas as pd


def find_column(df, pattern):
    """Return first column name containing all tokens in pattern (case-insensitive)."""
    tokens = pattern.lower().replace("(", "").replace(")", "").split()
    for col in df.columns:
        name = col.lower()
        if all(tok in name for tok in tokens):
            return col
    return None


def main():
    p = argparse.ArgumentParser(description="Produce YEAR, MONTH, LEVEL (AVG) for monthly predicted PM2.5")
    p.add_argument("csv", nargs="?", default="predicted_hanoi.csv", help="CSV file path (default predicted_hanoi.csv)")
    p.add_argument("--out", "-o", help="Write output CSV (default: monthly_pm25_{start}_x{n}.csv or monthly_pm25_from_data.csv)")
    p.add_argument("--pivot-out", help="Write pivot table (Year x Month) CSV")
    p.add_argument("--project", action="store_true", help="Build future grid and fill with monthly climatology (use with --start-year and --years)")
    p.add_argument("--start-year", type=int, default=2026, help="Start year for projection (default 2026)")
    p.add_argument("--years", type=int, default=3, help="Number of years to project (default 3)")
    p.add_argument("--month-col", help="Override date column name (e.g. 'predict_day_(t+3)')")
    p.add_argument("--value-col", help="Override value column name (e.g. 'predict_value_(t+3)')")
    args = p.parse_args()

    csv_path = Path(args.csv)
    if not csv_path.exists():
        print(f"File not found: {csv_path}", file=sys.stderr)
        sys.exit(2)

    df = pd.read_csv(csv_path, low_memory=False)

    # detect value column (prefer predict_value_(t+3))
    value_col = args.value_col or find_column(df, "predict_value t+3") or find_column(df, "predict_value") or find_column(df, "predict value")
    if value_col is None:
        if "predict_value_(t+3)" in df.columns:
            value_col = "predict_value_(t+3)"
        else:
            print("Could not find predictive value column (e.g. 'predict_value_(t+3)'). Available columns:", file=sys.stderr)
            print(", ".join(df.columns), file=sys.stderr)
            sys.exit(3)

    # detect date column (prefer predict_day_(t+3), fallback original_day or any datetime-looking column)
    date_col = args.month_col or find_column(df, "predict_day t+3") or find_column(df, "predict_day") or find_column(df, "predict day") or find_column(df, "original_day")
    if date_col is None:
        candidate = None
        for c in df.columns:
            sample = df[c].dropna().astype(str)
            if sample.empty:
                continue
            s = sample.iloc[0]
            if ("-" in s and any(ch.isdigit() for ch in s)) or ("/" in s and any(ch.isdigit() for ch in s)):
                candidate = c
                break
        if candidate is None:
            print("Could not find a date column to determine year/month. Please specify --month-col.", file=sys.stderr)
            print("Available columns:", ", ".join(df.columns), file=sys.stderr)
            sys.exit(4)
        date_col = candidate

    # parse dates
    try:
        dates = pd.to_datetime(df[date_col], errors="coerce")
    except Exception:
        dates = pd.to_datetime(df[date_col].astype(str), errors="coerce")

    if dates.isna().all():
        print(f"Parsed dates in column '{date_col}' are all NaT. Please check the column or pass --month-col.", file=sys.stderr)
        sys.exit(5)

    # numeric predicted values
    values = pd.to_numeric(df[value_col], errors="coerce")

    working = pd.DataFrame({"date": dates, "pm25": values})
    working = working.dropna(subset=["date"])
    working["Year"] = working["date"].dt.year
    working["Month"] = working["date"].dt.month  # 1..12

    # compute monthly average (Year + Month) from raw daily predictions
    grouped = (
        working
        .groupby(["Year", "Month"], as_index=False)["pm25"]
        .agg(lambda s: float(np.nanmean(s)))
    )
    grouped = grouped.rename(columns={"pm25": "Level_avg"})

    # optionally write pivot of observed grouped data (non-projected)
    if args.pivot_out and not args.project:
        pivot_obs = grouped.pivot(index="Year", columns="Month", values="Level_avg")
        pivot_obs.to_csv(args.pivot_out, index=True)
        print(f"Wrote pivot table to {args.pivot_out}")

    if not args.project:
        # Output actual Year-Month averages present in input data
        result = grouped.copy()
        result["Level (AVG)"] = result["Level_avg"].round(2)
        result = result[["Year", "Month", "Level (AVG)"]].sort_values(["Year", "Month"]).reset_index(drop=True)
    else:
        # Build grid of future years and fill using monthly climatology computed from daily predictions
        start = int(args.start_year)
        years = [start + i for i in range(int(args.years))]
        months = list(range(1, 13))
        grid = [{"Year": y, "Month": m} for y in years for m in months]
        grid_df = pd.DataFrame(grid)

        # climatology computed from working raw predictions by calendar month
        climatology = (
            working
            .dropna(subset=["pm25"])
            .groupby("Month", as_index=False)["pm25"]
            .mean()
            .rename(columns={"pm25": "Clim_avg"})
        )

        merged = grid_df.merge(climatology, on="Month", how="left")
        
        # **FIX**: If any months are still missing, fill them with the overall average.
        overall_avg = working["pm25"].mean()
        merged["Clim_avg"] = merged["Clim_avg"].fillna(overall_avg)
        
        merged["Level (AVG)"] = merged["Clim_avg"].round(2)
        result = merged[["Year", "Month", "Level (AVG)"]]

        # if pivot requested for projected grid
        if args.pivot_out:
            pivot_proj = merged.pivot(index="Year", columns="Month", values="Level (AVG)")
            pivot_proj.to_csv(args.pivot_out, index=True)
            print(f"Wrote pivot table to {args.pivot_out}")

    # print and write
    pd.set_option("display.width", 120)
    print(result.to_string(index=False, na_rep=""))

    out_path = args.out or (f"monthly_pm25_{int(args.start_year)}_x{int(args.years)}.csv" if args.project else "monthly_pm25_from_data.csv")
    result.to_csv(out_path, index=False)
    print(f"\nWrote output to {out_path}")


if __name__ == "__main__":
    main()