# ...existing code...
import argparse
import glob
import os
import re
import pandas as pd
import numpy as np

def find_column(df, candidates):
    cols = {c.lower(): c for c in df.columns}
    for cand in candidates:
        if cand and cand.lower() in cols:
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

# fallback: derive category from PM2.5 concentration (µg/m3) using common breakpoints
def pm25_category(pm25):
    if pd.isna(pm25):
        return pd.NA
    v = float(pm25)
    if v <= 12.0:
        return "Good"
    if v <= 35.4:
        return "Moderate"
    if v <= 55.4:
        return "Unhealthy for Sensitive Groups"
    if v <= 150.4:
        return "Unhealthy"
    if v <= 250.4:
        return "Very Unhealthy"
    return "Hazardous"

def sanitize_sheet_name(name):
    # Excel sheet name rules: max 31 chars, cannot contain : \ / ? * [ ]
    s = re.sub(r'[:\\/\?\*\[\]]', '_', str(name))
    return s[:31]

def main(csv_dir, out_file="hourly_combined.xlsx", pattern="**/*.csv"):
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
        col_site = find_column(df, ["Site","site","Station","station"])
        col_param = find_column(df, ["Parameter","parameter","Pollutant"])
        col_year = find_column(df, ["Year","year"])
        col_month = find_column(df, ["Month","month"])
        col_day = find_column(df, ["Day","day"])
        col_hour = find_column(df, ["Hour","hour","Hour24","HOUR","HH"])
        col_datetime = find_column(df, ["DateTime","Datetime","timestamp","Timestamp","Time","time"])
        col_raw = find_column(df, ["Raw Conc.","Raw Conc","RawConc","Raw Conc","Raw_Conc","RawConc.", "PM2.5"])
        col_aqi = find_column(df, ["AQI","Aqi","aqi"])
        col_qc = find_column(df, ["QC Name", "QC_Name", "QC", "qc"])

        if not all([col_site, col_param, col_raw]) :
            print("Skipping (missing required cols Site/Parameter/RawConc):", f)
            continue

        # try to extract year/month/day/hour from datetime if missing
        if col_datetime:
            try:
                dt = pd.to_datetime(df[col_datetime], errors="coerce")
                if col_year is None:
                    df["__year_tmp"] = dt.dt.year
                    col_year = "__year_tmp"
                if col_month is None:
                    df["__month_tmp"] = dt.dt.month
                    col_month = "__month_tmp"
                if col_day is None:
                    df["__day_tmp"] = dt.dt.day
                    col_day = "__day_tmp"
                if col_hour is None:
                    df["__hour_tmp"] = dt.dt.hour
                    col_hour = "__hour_tmp"
            except Exception:
                pass

        # if hour still missing, attempt to find 'Time' parts or default to 0
        if col_hour is None:
            # if there is a 'Time' column that looks like HH:MM
            tcol = find_column(df, ["Time","time","Local Time","local_time"])
            if tcol:
                try:
                    tt = pd.to_datetime(df[tcol], errors="coerce")
                    df["__hour_tmp2"] = tt.dt.hour
                    col_hour = "__hour_tmp2"
                except Exception:
                    pass

        # coerce numeric fields
        for nc in [col_raw, col_aqi, col_year, col_month, col_day, col_hour]:
            if nc:
                df[nc] = pd.to_numeric(df[nc], errors="coerce")

        # Apply filters:
        mask = df[col_raw].notna() & (df[col_raw] >= 0)
        if col_qc:
            qc_series = df[col_qc].astype(str).str.strip()
            mask &= qc_series.notna() & (qc_series.str.len() > 0) & (qc_series.str.lower() != "invalid")

        df = df[mask].copy()
        if df.empty:
            continue

        # ensure Year/Month/Day/Hour exist (fill with NaN -> will be dropped later)
        if col_year is None or col_month is None or col_day is None or col_hour is None:
            # try to infer from filename if it contains YYYY or YYYYMMDD
            m = re.search(r'(\d{4})', os.path.basename(f))
            if m and col_year is None:
                df["__year_infer"] = int(m.group(1))
                col_year = "__year_infer"
            # set missing numeric columns to 0 where absolutely necessary
            if col_year is None: df["__year_missing"] = pd.NA; col_year="__year_missing"
            if col_month is None: df["__month_missing"]=pd.NA; col_month="__month_missing"
            if col_day is None: df["__day_missing"]=pd.NA; col_day="__day_missing"
            if col_hour is None: df["__hour_missing"]=0; col_hour="__hour_missing"

        df2 = pd.DataFrame({
            "Site": df[col_site].astype(str).str.strip(),
            "Parameter": df[col_param].astype(str).str.strip(),
            "Year": df[col_year].astype("Int64"),
            "Month": df[col_month].astype("Int64"),
            "Day": df[col_day].astype("Int64"),
            "Hour": df[col_hour].astype("Int64"),
            "RawConc": df[col_raw],
            "AQI": df[col_aqi] if col_aqi else pd.NA
        })
        rows.append(df2)

    if not rows:
        print("No valid rows after filtering."); return

    all_df = pd.concat(rows, ignore_index=True)

    # drop rows missing key date parts (Year/Month/Day) -- keep Hour 0 allowed
    all_df = all_df[ all_df["Year"].notna() & all_df["Month"].notna() & all_df["Day"].notna() ]

    # group by site/parameter/date/hour
    group_cols = ["Site","Parameter","Year","Month","Day","Hour"]
    agg = all_df.groupby(group_cols).agg(
        PM25_Avg = ("RawConc","mean"),
        AQI_Avg = ("AQI","mean"),
        Hours = ("RawConc","count")
    ).reset_index()

    agg["PM25_Avg"] = agg["PM25_Avg"].round(2)
    agg["AQI_Avg"] = agg["AQI_Avg"].round().astype("Int64")

    # Category: prefer AQI_Avg -> aqi_category; if missing, derive from PM2.5
    def choose_category(row):
        if pd.notna(row["AQI_Avg"]):
            return aqi_category(row["AQI_Avg"])
        return pm25_category(row["PM25_Avg"])

    agg["Category"] = agg.apply(choose_category, axis=1)

    # final columns order: Site, Parameter, Year, Month, Day, Hour, PM2.5, Category
    final = agg[["Site","Parameter","Year","Month","Day","Hour","PM25_Avg","Category","Hours"]]
    final = final.rename(columns={"PM25_Avg":"PM2.5 (avg)","Hours":"Observations"})

    # write to Excel with sheets per Site_Year (e.g. HCMC_2023)
    out_lower = str(out_file).lower()
    if out_lower.endswith(".xlsx") or out_lower.endswith(".xls"):
        writer = pd.ExcelWriter(out_file, engine="openpyxl")
        for (site, year), group in final.groupby(["Site","Year"]):
            sheet_name = sanitize_sheet_name(f"{site}_{year}")
            # sort
            group = group.sort_values(["Year","Month","Day","Hour"])
            group.to_excel(writer, sheet_name=sheet_name, index=False)
        writer.save()
        print("Wrote Excel:", out_file, "sheets:", len(final.groupby(["Site","Year"])))
    else:
        # fallback: write a single CSV
        final.to_csv(out_file, index=False)
        print("Wrote CSV:", out_file, "rows:", len(final))

if __name__ == "__main__":
    p = argparse.ArgumentParser(description="Combine CSVs into hourly report (Site,Parameter,Year,Month,Day,Hour,PM2.5,Category).")
    p.add_argument("--csv-dir", required=True, help="Directory to search for CSV files (recursive).")
    p.add_argument("--out-file", default="hourly_combined.xlsx", help="Output Excel (.xlsx) or CSV path.")
    args = p.parse_args()
    main(args.csv_dir, args.out_file)
# ...existing code...