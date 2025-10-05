import os
import sys
import argparse
import pandas as pd
import numpy as np

def get_month(date_str):
    if not isinstance(date_str, str):
        return None
    month_map = {
        'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
        'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
    }
    parts = date_str.split('-')
    if len(parts) != 2:
        return None
    return month_map.get(parts[1], None)

def process_pm25_data(input_file, out_dir=None):
    if not os.path.exists(input_file):
        print(f"File not found: {input_file}")
        return
    try:
        df = pd.read_csv(input_file)
    except Exception as e:
        print(f"Failed to read {input_file}: {e}")
        return

    df['Month'] = df['Date'].apply(get_month)
    cities = [col for col in df.columns if col not in ['Date', 'Month']]
    month_names = ["January", "February", "March", "April", "May", "June",
                   "July", "August", "September", "October", "November", "December"]

    base_name = os.path.splitext(os.path.basename(input_file))[0]
    out_dir = out_dir or os.path.dirname(os.path.abspath(input_file))
    os.makedirs(out_dir, exist_ok=True)

    for city in cities:
        monthly_data = {"Month": month_names, "PM2.5": [np.nan] * 12}
        for month in range(1, 13):
            month_series = pd.to_numeric(df[df['Month'] == month][city], errors='coerce')
            vals = month_series.dropna()
            if len(vals) >= 1:
                monthly_data["PM2.5"][month-1] = vals.mean()
        monthly_df = pd.DataFrame(monthly_data)
        clean_city = city.replace(' - ', '_').replace(', ', '_').replace(' ', '_')
        output_file = os.path.join(out_dir, f"{base_name}_{clean_city}.csv")
        monthly_df.to_csv(output_file, index=False)
        print(f"Created {output_file}")

def main():
    parser = argparse.ArgumentParser(description="Split PM2.5 CSV into per-city monthly averages.")
    parser.add_argument("files", nargs="+", help="Input CSV file(s). Use quotes if path contains spaces.")
    parser.add_argument("--outdir", "-o", help="Output directory (optional).")
    args = parser.parse_args()
    for f in args.files:
        process_pm25_data(f, args.outdir)

if __name__ == "__main__":
    main()