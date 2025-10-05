#!/usr/bin/env python3
"""
Combine all CSV files in a specified folder into a single CSV.

Usage:
  python combine_csvs.py --input-dir /path/to/csvs --output combined.csv [--include-filename] [--recursive]

The script:
- Finds files matching *.csv in the input directory (optionally recursive).
- Reads each file using utf-8-sig to handle BOMs.
- Builds a union of all headers (preserving first-seen order).
- Writes a combined CSV with a single header row.
- Optionally adds a "source_file" column indicating the origin file.
"""
from pathlib import Path
import csv
import argparse
from typing import List, Dict, Set

def find_csv_files(folder: Path, recursive: bool) -> List[Path]:
    pattern = "**/*.csv" if recursive else "*.csv"
    return sorted(folder.glob(pattern))

def collect_rows(files: List[Path], include_filename: bool):
    seen_headers: List[str] = []
    seen_set: Set[str] = set()
    rows: List[Dict[str, str]] = []

    for fp in files:
        try:
            with fp.open("r", encoding="utf-8-sig", newline="") as f:
                reader = csv.DictReader(f)
                if reader.fieldnames is None:
                    continue
                # Update header order preserving first-seen
                for h in reader.fieldnames:
                    if h not in seen_set:
                        seen_set.add(h)
                        seen_headers.append(h)
                for r in reader:
                    row = dict(r)  # make a copy
                    if include_filename:
                        row["source_file"] = fp.name
                        if "source_file" not in seen_set:
                            seen_set.add("source_file")
                            seen_headers.append("source_file")
                    rows.append(row)
        except Exception as e:
            print(f"Warning: failed to read {fp}: {e}")
    return seen_headers, rows

def write_combined(output_path: Path, headers: List[str], rows: List[Dict[str, str]]):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=headers, extrasaction="ignore")
        writer.writeheader()
        for r in rows:
            # Ensure all headers are present
            out_row = {h: r.get(h, "") for h in headers}
            writer.writerow(out_row)

def parse_args():
    p = argparse.ArgumentParser(description="Combine CSV files in a folder into one CSV.")
    p.add_argument("--input-dir", "-i", type=Path, required=True, help="Folder containing CSV files.")
    p.add_argument("--output", "-o", type=Path, default=Path("combined.csv"), help="Output CSV file path.")
    p.add_argument("--include-filename", action="store_true", help="Add a source_file column with the original filename.")
    p.add_argument("--recursive", action="store_true", help="Search directories recursively.")
    return p.parse_args()

def main():
    args = parse_args()
    folder = args.input_dir
    if not folder.exists() or not folder.is_dir():
        raise SystemExit(f"Input directory does not exist: {folder}")

    files = find_csv_files(folder, args.recursive)
    if not files:
        raise SystemExit(f"No CSV files found in {folder} (recursive={args.recursive}).")

    headers, rows = collect_rows(files, args.include_filename)
    if not headers:
        raise SystemExit("No headers found in any CSV files.")

    write_combined(args.output, headers, rows)
    print(f"Combined {len(files)} files into {args.output} rows={len(rows)} columns={len(headers)}")

if __name__ == "__main__":
    main()