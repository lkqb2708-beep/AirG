import argparse
import glob
import os
import pandas as pd
import numpy as np

def find_column(df, candidates):
    cols = {c.lower(): c for c in df.columns}
    for cand in candidates:
        if cand.lower() in cols:
            return cols[cand.lower()]
    return None

def aqi_category(aqi):
    if pd.isna(aqi):
        return pd.NA
    aqi = float(aqi)
    if aqi <= 50:
        return "Good"
    if aqi <= 100:
        return "Moderate"
    if aqi <= 150:
        return "Unhealthy for Sensitive Groups"
    if aqi <= 200:
        return "Unhealthy"
    if aqi <= 300:
        return "Very Unhealthy"
    return "Hazardous"

def main(csv_dir, out_file, pattern="**/*.csv"):
    files = glob.glob(os.path.join(csv_dir, pattern), recursive=True)
    if not files:
        print("No CSV files found in", csv_dir); return

    rows = []
    for f in files:
        try:
            df = pd.read_csv(f, dtype=str)
        except Exception as e:
            print("Skipping", f, ":", e); continue
        # normalize column names
        df.columns = [c.strip() for c in df.columns]
        # locate columns robustly
        col_site = find_column(df, ["Site"])
        col_param = find_column(df, ["Parameter"])
        col_year = find_column(df, ["Year"])
        col_month = find_column(df, ["Month"])
        col_day = find_column(df, ["Day"])
        col_nowcast = find_column(df, ["NowCast Conc.", "NowCast Conc", "NowCast"])
        col_aqi = find_column(df, ["AQI"])
        col_raw = find_column(df, ["Raw Conc.", "Raw Conc", "Raw Conc"])
        col_qc = find_column(df, ["QC Name", "QC_Name", "QC"])

        if not all([col_site, col_param, col_year, col_month, col_day, col_raw]):
            # skip files that don't have expected columns
            print("Skipping (missing required cols):", f)
            continue

        # coerce numeric
        for nc in [col_nowcast, col_aqi, col_raw, col_year, col_month, col_day]:
            if nc:
                df[nc] = pd.to_numeric(df[nc], errors="coerce")

        # Apply filters:
        # - exclude rows where QC Name missing OR QC Name == "Invalid" (case-insensitive)
        # - exclude rows where Raw Conc is < 0
        mask = df[col_raw].notna() & (df[col_raw] >= 0)
        if col_qc:
            qc_series = df[col_qc].astype(str).str.strip()
            mask &= qc_series.notna() & (qc_series.str.len() > 0) & (qc_series.str.lower() != "invalid")
        else:
            # If QC column missing, still enforce Raw Conc >= 0 per requirement
            pass

        df = df[mask].copy()
        if df.empty:
            continue

        # keep only relevant columns with consistent names
        df2 = pd.DataFrame({
            "Site": df[col_site].astype(str).str.strip(),
            "Parameter": df[col_param].astype(str).str.strip(),
            "Year": df[col_year].astype(int),
            "Month": df[col_month].astype(int),
            "Day": df[col_day].astype(int),
            "NowCast": df[col_nowcast] if col_nowcast else np.nan,
            "AQI": df[col_aqi] if col_aqi else np.nan,
            "RawConc": df[col_raw]
        })
        rows.append(df2)

    if not rows:
        print("No valid rows after filtering."); return

    all_df = pd.concat(rows, ignore_index=True)

    # group by site/parameter/date
    group_cols = ["Site", "Parameter", "Year", "Month", "Day"]
    agg = all_df.groupby(group_cols).agg(
        NowCast_Avg = ("NowCast", "mean"),
        AQI_Avg = ("AQI", "mean"),
        PM25_Avg = ("RawConc", "mean"),
        Hours = ("NowCast", "count")
    ).reset_index()

    # rounding/formatting
    agg["NowCast_Avg"] = agg["NowCast_Avg"].round(2)
    agg["PM25_Avg"] = agg["PM25_Avg"].round(2)
    # AQI average -> rounded integer (but keep nullable)
    agg["AQI_Avg"] = agg["AQI_Avg"].round().astype("Int64")

    agg["AQI_Category"] = agg["AQI_Avg"].apply(lambda x: aqi_category(x) if pd.notna(x) else pd.NA)

    final = agg[["Site","Parameter","Year","Month","Day","NowCast_Avg","AQI_Avg","PM25_Avg","AQI_Category","Hours"]]
    final.columns = ["Site","Parameter","Year","Month","Day","NowCast Conc (avg)","AQI (avg)","PM2.5 (avg)","AQI Category","Hours"]

    final.to_csv(out_file, index=False)
    print("Wrote", out_file, "rows:", len(final))

if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Combine hourly CSVs into daily averages (exclude QC==Invalid and RawConc<0).")
    p.add_argument("--csv-dir", required=True, help="Directory to search for CSV files (recursive).")
    p.add_argument("--out-file", default="daily_combined.csv", help="Output CSV path.")
    args = p.parse_args()
    main(args.csv_dir, args.out_file)