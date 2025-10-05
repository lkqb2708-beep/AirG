# ...existing code...
#!/usr/bin/env python3
"""
Aggregate PM2.5 CSV files and produce monthly average PM2.5 for each Year+Month per city.

Output columns:
  Month (YYYY-MM),
  Year,
  Month_num (1-12),
  PM2.5 (monthly mean rounded to 2 decimals),
  City

Usage:
  python pm.py --input_dir ./data --output monthly_pm25_monthly_avg_by_year.csv
"""
import argparse
import glob
import os
import sys
import re
import pandas as pd
import numpy as np

# Common candidate column names for date and PM2.5
DATE_CANDIDATES = [
    "date", "Date", "datetime", "timestamp", "time", "Time", "DateLocal", "date_local"
]
PM_CANDIDATES = [
    "PM2.5", "PM2_5", "pm25", "pm2_5", "pm2.5", "pm_2_5", "value", "pm25_value", "pm25_concentration", "pm2"
]
CITY_CANDIDATES = ["city", "City", "station", "Station", "location", "Location"]

def _normalize_name(s):
    return re.sub(r"[^a-z0-9]", "", str(s).lower())

def find_column(df, candidates):
    # exact match first
    for c in candidates:
        if c in df.columns:
            return c
    # case-insensitive exact
    cols_map = {col.lower(): col for col in df.columns}
    for c in candidates:
        if c.lower() in cols_map:
            return cols_map[c.lower()]
    # substring / normalized match (e.g. "PM2.5 (avg)" matches "pm25")
    norm_candidates = [_normalize_name(c) for c in candidates]
    for col in df.columns:
        ncol = _normalize_name(col)
        for nc in norm_candidates:
            if nc and (nc in ncol or ncol in nc):
                return col
    return None

def clean_numeric_series(s):
    s = s.astype(str).str.replace(",", "")
    s = s.str.replace(r"[^0-9.\-eE]", "", regex=True)
    return pd.to_numeric(s, errors="coerce")

def process_file(path, city_override=None):
    df = pd.read_csv(path)
    original_columns = list(df.columns)

    # Find date column (or construct from Year/Month[/Day])
    date_col = find_column(df, DATE_CANDIDATES)
    if date_col is None:
        year_col = find_column(df, ["Year"])
        month_col = find_column(df, ["Month"])
        day_col = find_column(df, ["Day"])
        hour_col = find_column(df, ["Hour", "hour"])
        if year_col and month_col:
            try:
                # handle Month as YYYY-MM
                if df[month_col].astype(str).str.match(r"^\d{4}-\d{2}$").any():
                    df["_constructed_date"] = pd.to_datetime(df[month_col].astype(str) + "-01", errors="coerce")
                else:
                    day_series = df[day_col] if day_col else 1
                    df["_constructed_date"] = pd.to_datetime({
                        "year": df[year_col].astype(int),
                        "month": df[month_col].astype(int),
                        "day": pd.Series(day_series).astype(int) if day_col else 1
                    }, errors="coerce")
                    if hour_col:
                        try:
                            hrs = pd.to_numeric(df[hour_col], errors="coerce").fillna(0).astype(int)
                            df["_constructed_date"] = df["_constructed_date"] + pd.to_timedelta(hrs, unit="h")
                        except Exception:
                            pass
                date_col = "_constructed_date"
            except Exception:
                date_col = None

    if date_col is None:
        print(f"ERROR: Could not find or construct a date column in {path}. Columns: {original_columns}", file=sys.stderr)
        return None

    # parse dates
    try:
        if not np.issubdtype(df[date_col].dtype, np.datetime64):
            df[date_col] = pd.to_datetime(df[date_col], infer_datetime_format=True, errors="coerce")
    except Exception as e:
        print(f"Warning: date parsing problem in {path}: {e}", file=sys.stderr)
        df[date_col] = pd.to_datetime(df[date_col], errors="coerce")

    if df[date_col].isna().all():
        print(f"ERROR: All parsed dates are NaT for {path}.", file=sys.stderr)
        return None

    # Find PM2.5 column
    pm_col = find_column(df, PM_CANDIDATES)
    if pm_col is None:
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        numeric_cols = [c for c in numeric_cols if c not in {find_column(df, ["Year"]) or "", find_column(df, ["Month"]) or "", find_column(df, ["Day"]) or "", find_column(df, ["Hour"]) or ""}]
        if numeric_cols:
            pm_col = numeric_cols[0]
            print(f"Warning: PM2.5 column not explicitly found in {path}. Using first numeric column '{pm_col}'.", file=sys.stderr)
        else:
            print(f"ERROR: Could not find PM2.5 column in {path}. Columns: {original_columns}", file=sys.stderr)
            return None

    df[pm_col] = clean_numeric_series(df[pm_col])

    # City column
    city_col = find_column(df, CITY_CANDIDATES)
    if city_override:
        df["City"] = city_override
    elif city_col:
        df["City"] = df[city_col].astype(str)
    else:
        fname = os.path.splitext(os.path.basename(path))[0]
        city_guess = fname.replace("_", " ").replace("-", " ").strip()
        df["City"] = city_guess

    # keep rows with date and pm value
    df = df.dropna(subset=[date_col])
    df = df.loc[:, [date_col, pm_col, "City"]].copy()
    df = df.rename(columns={date_col: "_date", pm_col: "PM2.5"})
    df["PM2.5"] = pd.to_numeric(df["PM2.5"], errors="coerce")
    df = df.dropna(subset=["PM2.5"])

    # add Year, Month_num and Month string (YYYY-MM) for each record
    df["_date"] = pd.to_datetime(df["_date"], errors="coerce")
    df["Year"] = df["_date"].dt.year
    df["Month_num"] = df["_date"].dt.month
    df["Month"] = df["_date"].dt.to_period("M").astype(str)  # YYYY-MM

    return df

def main():
    parser = argparse.ArgumentParser(description="Produce monthly average PM2.5 per Year+Month per city.")
    parser.add_argument("--input", "-i", help="Single input CSV file")
    parser.add_argument("--input_dir", "-d", help="Directory containing CSV files (will read all *.csv)")
    parser.add_argument("--output", "-o", default="monthly_pm25_monthly_avg_by_year.csv", help="Output CSV path")
    parser.add_argument("--city", "-c", help="Optional city name override for files that lack a City column")
    args = parser.parse_args()

    if not args.input and not args.input_dir:
        parser.error("Specify --input <file> or --input_dir <directory>")

    input_files = []
    if args.input:
        input_files.append(args.input)
    if args.input_dir:
        pattern = os.path.join(args.input_dir, "*.csv")
        found = glob.glob(pattern)
        if not found:
            print(f"No CSV files found in directory: {args.input_dir}", file=sys.stderr)
        input_files.extend(found)

    if not input_files:
        print("No input files to process.", file=sys.stderr)
        sys.exit(1)

    frames = []
    for f in sorted(set(input_files)):
        print(f"Processing {f} ...")
        df = process_file(f, city_override=args.city)
        if df is not None and not df.empty:
            frames.append(df)

    if not frames:
        print("No valid results produced.", file=sys.stderr)
        sys.exit(1)

    all_records = pd.concat(frames, ignore_index=True)

    # Compute monthly average PM2.5 per City, Year and Month_num.
    all_records["PM2.5"] = pd.to_numeric(all_records["PM2.5"], errors="coerce")
    all_records = all_records.dropna(subset=["PM2.5"])

    # group by City + Year + Month_num and compute mean
    grouped = (
        all_records
        .groupby(["City", "Year", "Month_num"], as_index=False)["PM2.5"]
        .mean()
        .round(2)
    )

    # create Month string YYYY-MM
    grouped["Year"] = grouped["Year"].astype(int)
    grouped["Month_num"] = grouped["Month_num"].astype(int)
    grouped["Month"] = grouped.apply(lambda r: f"{int(r['Year'])}-{int(r['Month_num']):02d}", axis=1)

    # Ensure columns and order: Month (YYYY-MM), Year, Month_num, PM2.5, City
    out = grouped[["Month", "Year", "Month_num", "PM2.5", "City"]].copy()

    # Sort by Year then Month_num then City so output lists months per year sequentially
    out = out.sort_values(["Year", "Month_num", "City"]).reset_index(drop=True)

    out.to_csv(args.output, index=False)
    print(f"Wrote monthly averages by year to: {args.output}")

if __name__ == "__main__":
    main()
# ...existing code...