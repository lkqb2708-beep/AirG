// ...existing code...
import React, { useEffect, useState, useRef } from "react";
import "./AOD.css";
import Map from "../map/map";

// GeoJSON imports for available countries
import Cambodia from "../world-map-json/Cambodia.json";
import Indonesia from "../world-map-json/Indonesia.json";
import Laos from "../world-map-json/Laos.json";
import Malaysia from "../world-map-json/Malaysia.json";
import Myanmar from "../world-map-json/Myanmar.json";
import Philippines from "../world-map-json/Philippines.json";
import Thailand from "../world-map-json/Thailand.json";
import Vietnam from "../world-map-json/Vietnam.json";

const YEARS = ["2019", "2020", "2021", "2022", "2023", "2024"]; // add more years as you add CSVs

const COUNTRY_OPTIONS = [
  {
    key: "Cambodia",
    geo: Cambodia,
    slug: "Phnom_Penh_Cambodia",
    csv: "PM2.5 - 2019_Phnom_Penh_Cambodia.csv",
    label: "Phnom Penh, Cambodia",
    monthlyCandidates: ["Phnom_Penh_Cambodia_monthly.csv", "Phnom_Penh_monthly.csv", "PhnomPenh_monthly.csv", "PhnomPenh_monthly.csv"],
  },
  {
    key: "Indonesia",
    geo: Indonesia,
    slug: "Jakarta_Indonesia",
    csv: "PM2.5 - 2019_Jakarta_Indonesia.csv",
    label: "Jakarta, Indonesia",
    monthlyCandidates: ["Jakarta_monthly.csv"],
  },
  {
    key: "Laos",
    geo: Laos,
    slug: "Vientiane_Laos",
    csv: "PM2.5 - 2019_Vientiane_Laos.csv",
    label: "Vientiane, Laos",
    monthlyCandidates: ["Vientiane_monthly.csv", "Vientiane_monthly.csv"],
  },
  {
    key: "Malaysia",
    geo: Malaysia,
    slug: "Kuala_Lumpur_Malaysia",
    csv: "PM2.5 - 2019_Kuala_Lumpur_Malaysia.csv",
    label: "Kuala Lumpur, Malaysia",
    monthlyCandidates: ["Kuala_monthly.csv", "KualaLumpur_monthly.csv", "KualaLumpur_monthly.csv"],
  },
  {
    key: "Myanmar",
    geo: Myanmar,
    slug: "Yangon_Myanmar",
    csv: "PM2.5 - 2019_Yangon_Myanmar.csv",
    label: "Yangon, Myanmar",
    monthlyCandidates: ["Yangon_monthly.csv"],
  },
  {
    key: "Philippines",
    geo: Philippines,
    slug: "Manila_Philippines",
    csv: "PM2.5 - 2019_Manila_Philippines.csv",
    label: "Manila, Philippines",
    monthlyCandidates: ["Manila_monthly.csv"],
  },
  {
    key: "Thailand",
    geo: Thailand,
    slug: "Bangkok_Thailand",
    csv: "PM2.5 - 2019_Bangkok_Thailand.csv",
    label: "Bangkok, Thailand",
    monthlyCandidates: ["Bangkok_monthly.csv"],
  },
  {
    key: "Vietnam-Hanoi",
    geo: Vietnam,
    slug: "Hanoi_Vietnam",
    csv: "PM2.5 - 2019_Hanoi_Vietnam.csv",
    label: "Hanoi, Vietnam",
    monthlyCandidates: ["hanoi_monthly.csv", "Hanoi_monthly.csv"],
  },
  {
    key: "Vietnam-HCM",
    geo: Vietnam,
    slug: "Ho_Chi_Minh_Vietnam",
    csv: "PM2.5 - 2019_Ho_Chi_Minh_Vietnam.csv",
    label: "Ho Chi Minh City, Vietnam",
    monthlyCandidates: ["hochi_minh_monthly.csv","HoChiMinh_monthly.csv","Ho_Chi_Minh_monthly.csv"],
  },
];

function parseCsv(text) {
  if (!text) return [];
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines.shift().split(",").map(h => h.trim());
  // detect common formats:
  // - Format A: header like "Month,MonthName,Value" or "Month,Value" where Month is "January" etc.
  // - Format B (monthly output): header contains "Month" with YYYY-MM and "PM2.5"
  const isMonthlyWithPM = header.some(h => /pm2\.?5/i.test(h) || h.toLowerCase().includes("pm2"));
  const monthIdx = header.findIndex(h => /^month$/i.test(h) || /^month_name$/i.test(h) || /^date$/i.test(h)) !== -1
    ? header.findIndex(h => /^month$/i.test(h) || /^month_name$/i.test(h) || /^date$/i.test(h))
    : 0;
  let pmIdx = -1;
  if (isMonthlyWithPM) {
    pmIdx = header.findIndex(h => /pm2\.?5/i.test(h) || h.toLowerCase().includes("pm2") || h.toLowerCase().includes("pm_2"));
  } else {
    // second column often contains AOD numeric in current AOD CSVs
    pmIdx = header.length > 1 ? 1 : 0;
  }

  return lines.map((l) => {
    const cols = l.split(",").map(c => c.trim());
    const rawMonth = (cols[monthIdx] || "").trim();
    const rawVal = cols[pmIdx];
    // try to extract year and month name
    let Year = null;
    let MonthName = rawMonth;
    const ymatch = rawMonth && rawMonth.match(/^(\d{4})-(\d{2})/);
    if (ymatch) {
      Year = ymatch[1];
      const m = Number(ymatch[2]);
      const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
      MonthName = monthNames[m-1] || rawMonth;
    } else {
      // try to parse MonthName that might include year like "January 2019"
      const m2 = rawMonth.match(/^([A-Za-z]+)\s+(\d{4})/);
      if (m2) {
        MonthName = m2[1];
        Year = m2[2];
      }
    }
    return {
      MonthRaw: rawMonth,
      Month: MonthName,
      Year: Year,
      Value: rawVal === undefined || rawVal === "" ? null : Number(rawVal),
    };
  });
}

function getSeasonType(month) {
  // Dry now = December + Jan–Apr
  const dryMonths = ["December", "January", "February", "March", "April"];
  // Wet now = May–November
  const wetMonths = [
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
  ];
  if (dryMonths.includes(month)) return "dry";
  if (wetMonths.includes(month)) return "wet";
  return "unknown";
}

// ...existing code...
function SimpleLineChart({ aodData = [], pmData = [], mode = "aod", width = 380, height = 240 }) {
  // mode: 'aod' | 'pm25' | 'both'
  // Keep existing AOD appearance exactly when showing AOD-only.
  const hasAOD = aodData && aodData.length > 0;
  const hasPM = pmData && pmData.length > 0;
  if (!hasAOD && !hasPM) return <div className="aod-chart-empty">No chart data</div>;

  const padding = { top: 12, right: 56, bottom: 36, left: 36 }; // extra space on right for PM2.5 axis
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  // unify months order Jan..Dec and restrict to months present for the selected year
  const monthOrder = [
    "January","February","March","April","May","June","July","August","September","October","November","December",
  ];

  // build map month -> value for each series
  const aodMap = {};
  (aodData || []).forEach(d => { if (d.Month) aodMap[d.Month] = d.Value; });
  const pmMap = {};
  (pmData || []).forEach(d => { if (d.Month) pmMap[d.Month] = d.Value; });

  // months to render: union of months present in either series, keep calendar order
  const monthsPresent = Array.from(new Set([...(Object.keys(aodMap)), ...(Object.keys(pmMap))]));
  const sorted = monthOrder.filter(m => monthsPresent.includes(m));

  if (sorted.length === 0) {
    // fallback: use all 12 months if either series exists but month names missing
    sorted.push(...monthOrder);
  }

  const aodValues = sorted.map(m => (aodMap[m] == null ? NaN : aodMap[m]));
  const pmValues = sorted.map(m => (pmMap[m] == null ? NaN : pmMap[m]));

  // AOD scale (keep existing behaviour)
  const validAOD = aodValues.filter(v => !isNaN(v));
  const computedAODMax = validAOD.length ? Math.max(...validAOD) : 0;
  const aodMin = 0;
  const aodMax = Math.max(1.5, computedAODMax, 0.000001);

  const xa = (i) => (i / (sorted.length - 1 || 1)) * innerW + padding.left;
  const ya = (v) => {
    if (isNaN(v)) return padding.top + innerH;
    const t = (v - aodMin) / (aodMax - aodMin);
    return padding.top + (1 - t) * innerH;
  };
  const pathDa = sorted.map((m,i) => ` ${i===0?"M":"L"} ${xa(i).toFixed(2)} ${ya(aodMap[m]).toFixed(2)}`).join("");

  // PM2.5 scale (right axis)
  const validPM = pmValues.filter(v => !isNaN(v));
  const computedPMMax = validPM.length ? Math.max(...validPM) : 100;
  const pmMin = 0;
  const pmMax = Math.max(200, computedPMMax); // ensure we cover hazardous range
  const ypm = (v) => {
    if (isNaN(v)) return padding.top + innerH;
    const t = (v - pmMin) / (pmMax - pmMin);
    return padding.top + (1 - t) * innerH;
  };
  const pathDpm = sorted.map((m,i) => ` ${i===0?"M":"L"} ${xa(i).toFixed(2)} ${ypm(pmMap[m]).toFixed(2)}`).join("");

  // seasonal rectangles same as before (full height)
  const seasonalRects = [];
  const janIdx = sorted.indexOf("January");
  const aprIdx = sorted.indexOf("April");
  const mayIdx = sorted.indexOf("May");
  const novIdx = sorted.indexOf("November");
  const decIdx = sorted.indexOf("December");

  if (janIdx !== -1 && aprIdx !== -1) {
    const start = xa(janIdx) - innerW / (2 * sorted.length);
    const end = xa(aprIdx) + innerW / (2 * sorted.length);
    seasonalRects.push(<rect key="dry-jan-apr" x={start} y={0} width={Math.max(0,end-start)} height={height} fill="rgba(255,165,0,0.12)" />);
  }
  if (mayIdx !== -1 && novIdx !== -1) {
    const start = xa(mayIdx) - innerW / (2 * sorted.length);
    const end = xa(novIdx) + innerW / (2 * sorted.length);
    seasonalRects.push(<rect key="wet-may-nov" x={start} y={0} width={Math.max(0,end-start)} height={height} fill="rgba(125,185,222,0.15)" />);
  }
  if (decIdx !== -1) {
    const start = xa(decIdx) - innerW / (2 * sorted.length);
    const end = padding.left + innerW;
    seasonalRects.push(<rect key="dry-dec" x={start} y={0} width={Math.max(0,end-start)} height={height} fill="rgba(255,165,0,0.12)" />);
  }

  // Define paired categories so AOD and PM2.5 category levels are drawn at the same horizontal positions
  const pairedCategories = [
    { key: "Good", aodValue: 0.3, pmValue: 50, color: "#34A853", leftLabel: "Good (< 0.3)", rightLabel: "Good (0-50)" },
    { key: "Moderate", aodValue: 0.7, pmValue: 100, color: "#FB8C00", leftLabel: "Moderate (> 0.7)", rightLabel: "Moderate (51-100)" },
    { key: "Hazardous", aodValue: 1.0, pmValue: 200, color: "#D93025", leftLabel: "Hazardous (> 1.0)", rightLabel: "Hazardous (101+)" },
  ];

  // Compute a single horizontal position for each paired category.
  // We compute fraction for each axis then average them so the line sits at a compromise position,
  // and then draw both AOD and PM labels anchored to the same line.
  const pairedLines = pairedCategories.map((cat) => {
    const aodFrac = aodMax > 0 ? Math.min(1, Math.max(0, cat.aodValue / aodMax)) : 0;
    const pmFrac = pmMax > 0 ? Math.min(1, Math.max(0, cat.pmValue / pmMax)) : 0;
    const frac = (aodFrac + pmFrac) / 2; // compromise fraction so both are visually aligned
    const gy = padding.top + (1 - frac) * innerH;
    return { ...cat, frac, gy };
  });

  return (
    <svg className="aod-chart" viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <rect x="0" y="0" width={width} height={height} fill="transparent" />

      {/* seasonal backgrounds */}
      {seasonalRects}

      {/* AOD grid lines */}
      {[aodMax, aodMax/2, 0].map((t,i) => {
        const gy = padding.top + (1 - (t - aodMin) / (aodMax - aodMin)) * innerH;
        return <line key={`a-grid-${i}`} x1={padding.left} x2={padding.left + innerW} y1={gy} y2={gy} stroke="rgba(0,0,0,0.06)" />;
      })}

      {/* Paired category lines (single horizontal line per category, with both left and right labels) */}
      {pairedLines.map((pl, i) => {
        const gy = pl.gy;
        // left label (AOD)
        const leftRectW = 110;
        const leftLabelX = padding.left + 6;
        const leftLabelY = Math.max(padding.top + 10, Math.min(height - 12, gy - 6));
        // right label (PM2.5)
        const rightRectW = 110;
        const rightLabelX = padding.left + innerW - rightRectW - 6;
        const rightLabelY = leftLabelY;

        return (
          <g key={`paired-${i}`} aria-hidden="true">
            <line x1={padding.left} x2={padding.left + innerW} y1={gy} y2={gy} stroke={pl.color} strokeWidth={1.25} strokeDasharray="6,4" opacity={0.9} />
            {/* left connector */}
            <line x1={padding.left + 8} x2={leftLabelX + leftRectW + 6} y1={gy} y2={gy} stroke={pl.color} strokeWidth={1} opacity={0.7} />
            <rect x={leftLabelX} y={leftLabelY - 10} rx={3} ry={3} width={leftRectW} height={14} fill="rgba(255,255,255,0.95)" />
            <text x={leftLabelX + 6} y={leftLabelY} fontSize="10" fill={pl.color} fontWeight="600">{pl.leftLabel}</text>
            {/* right connector */}
            <line x1={padding.left + innerW - 4} x2={rightLabelX - 6 + rightRectW} y1={gy} y2={gy} stroke={pl.color} strokeWidth={1} opacity={0.7} />
            <rect x={rightLabelX - 4} y={rightLabelY - 10} rx={3} ry={3} width={rightRectW} height={14} fill="rgba(255,255,255,0.95)" />
            <text x={rightLabelX + 2} y={rightLabelY} fontSize="10" fill={pl.color} fontWeight="600">{pl.rightLabel}</text>
          </g>
        );
      })}

      {/* AOD data line (keep style identical) */}
      {hasAOD && (mode === "aod" || mode === "both") && (
        <>
          <path d={pathDa} fill="none" stroke="#0f766e" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
          <path d={`${pathDa} L ${padding.left + innerW} ${padding.top + innerH} L ${padding.left} ${padding.top + innerH} Z`} fill="rgba(15,118,110,0.08)" />
          {sorted.map((m,i) => {
            const vx = xa(i);
            const vy = ya(aodMap[m]);
            return <circle key={`a-dot-${i}`} cx={vx} cy={vy} r="3.4" fill={isNaN(aodMap[m]) ? "#ccc" : "#05625a"} />;
          })}
        </>
      )}

      {/* PM2.5 data line (right axis) */}
      {hasPM && (mode === "pm25" || mode === "both") && (
        <>
          <path d={pathDpm} fill="none" stroke="#7f1d1d" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" opacity={0.95} />
          <path d={`${pathDpm} L ${padding.left + innerW} ${padding.top + innerH} L ${padding.left} ${padding.top + innerH} Z`} fill="rgba(127,29,29,0.06)" />
          {sorted.map((m,i) => {
            const vx = xa(i);
            const vy = ypm(pmMap[m]);
            return <circle key={`pm-dot-${i}`} cx={vx} cy={vy} r="3.4" fill={isNaN(pmMap[m]) ? "#ccc" : "#7f1d1d"} />;
          })}
        </>
      )}

      {/* month labels */}
      {sorted.map((m,i) => {
        const vx = xa(i);
        const season = getSeasonType(m);
        return (
          <text key={`m-${i}`} x={vx} y={height - 10} fontSize="10" textAnchor="middle"
            fill={season === "wet" ? "#1a73e8" : season === "dry" ? "#e67700" : "#07332d"}
            fontWeight={season !== "unknown" ? "bold" : "normal"}
          >
            {m ? m.slice(0,3) : ""}
          </text>
        );
      })}

      {/* left AOD axis labels (top and bottom) */}
      <text x={6} y={padding.top + 10} fontSize="11" fill="#07332d">{aodMax.toFixed(2)}</text>
      <text x={6} y={padding.top + innerH} fontSize="11" fill="#07332d">{aodMin.toFixed(2)}</text>

      {/* right PM2.5 axis (top and bottom) */}
      <text x={padding.left + innerW + 8} y={padding.top + 10} fontSize="11" fill="#7f1d1d" textAnchor="start">{pmMax.toFixed(0)}</text>
      <text x={padding.left + innerW + 8} y={padding.top + innerH} fontSize="11" fill="#7f1d1d" textAnchor="start">{pmMin.toFixed(0)}</text>

      {/* Legend top-left (keep existing AOD legend as-is) */}
      <rect x={padding.left + 8} y={6} width={170} height={36} fill="rgba(255,255,255,0.85)" rx="3" />
      <g transform={`translate(${padding.left + 16}, ${16})`}>
        <rect width="12" height="8" fill="rgba(255,165,0,0.4)" />
        <text x="16" y="7" fontSize="9" fill="#333" fontWeight="bold">Dry Season (Dec, Jan-Apr)</text>
      </g>
      <g transform={`translate(${padding.left + 16}, ${30})`}>
        <rect width="12" height="8" fill="rgba(125,185,222,0.5)" />
        <text x="16" y="7" fontSize="9" fill="#333" fontWeight="bold">Wet Season (May-Nov)</text>
      </g>
    </svg>
  );
}
// ...existing code...

export default function AOD() {
  const [selected, setSelected] = useState(COUNTRY_OPTIONS[0].key);
  const [year, setYear] = useState(YEARS[0]);
  const [aodData, setAodData] = useState([]); // existing AOD series (kept behaviour)
  const [pmData, setPmData] = useState([]); // monthly PM2.5 series
  const [mode, setMode] = useState("aod"); // "aod" | "pm25" | "both"

  const yearRef = useRef(null);
  const regionRef = useRef(null);

  const selectedOpt =
    COUNTRY_OPTIONS.find((c) => c.key === selected) || COUNTRY_OPTIONS[0];

  useEffect(() => {
    // fetch AOD CSV (existing behaviour) - unchanged logic except storing into aodData
    let filename = null;
    if (selectedOpt.slug) {
      filename = `PM2.5 - ${year}_${selectedOpt.slug}.csv`;
    } else if (selectedOpt.csv) {
      filename = selectedOpt.csv.replace(/2019|2020/, year);
    }
    if (!filename) {
      setAodData([]);
    } else {
      const url = `${process.env.PUBLIC_URL || ""}/data/${filename}`;
      fetch(url)
        .then((r) => {
          if (!r.ok) {
            console.error("Failed to fetch CSV:", url, r.status);
            throw new Error("Data not found");
          }
          return r.text();
        })
        .then((txt) => {
          const parsed = parseCsv(txt);
          // follow original AOD expectation: Month names + numeric value
          setAodData(parsed);
        })
        .catch((err) => {
          console.error("CSV load error:", err);
          setAodData([]);
        });
    }

    // try to fetch monthly PM2.5 file(s) using candidate names provided in COUNTRY_OPTIONS
    async function tryLoadMonthly() {
      setPmData([]); // reset
      if (!selectedOpt.monthlyCandidates || selectedOpt.monthlyCandidates.length === 0) {
        // try a few generated patterns from the label as fallback
        const label = selectedOpt.label.split(",")[0].trim(); // e.g. "Ho Chi Minh City"
        const words = label.split(/\s+/);
        const fallbacks = [
          `${label.replace(/\s+/g, "_")}_monthly.csv`,
          `${label.replace(/\s+/g, "")}_monthly.csv`,
          `${words.slice(0,2).join("_")}_monthly.csv`,
          `${words[0]}_monthly.csv`,
        ];
        selectedOpt.monthlyCandidates = fallbacks;
      }
      const base = process.env.PUBLIC_URL || "";
      for (const candidate of selectedOpt.monthlyCandidates) {
        const cands = [
          candidate,
          candidate.toLowerCase(),
          candidate.replace(/\s+/g, "_"),
          candidate.replace(/\s+/g, ""),
        ];
        let success = false;
        for (const c of cands) {
          const url = `${base}/data/${c}`;
          try {
            const resp = await fetch(url);
            if (!resp.ok) continue;
            const txt = await resp.text();
            const parsed = parseCsv(txt);
            // filter to the selected year only (if Year known in parsed rows)
            const filtered = parsed.filter(d => !d.Year || String(d.Year) === String(year)).map(d => ({
              Month: d.Month,
              Year: d.Year || year,
              Value: d.Value
            }));
            setPmData(filtered);
            success = true;
            break;
          } catch (e) {
            // ignore and try next
          }
        }
        if (success) break;
      }
    }
    tryLoadMonthly();
  }, [selectedOpt, year]);

  // prepare geojson for highlighting (unchanged)
  const emptyGeo = { type: "FeatureCollection", features: [] };
  let geoToRender = emptyGeo;
  if (selectedOpt.geo) {
    try {
      const copy = JSON.parse(JSON.stringify(selectedOpt.geo));
      if (Array.isArray(copy.features)) {
        copy.features = copy.features.map((f) => {
          f.properties = f.properties || {};
          f.properties.__highlight = true;
          return f;
        });
      }
      geoToRender = copy;
    } catch (e) {
      geoToRender = selectedOpt.geo || emptyGeo;
    }
  }

  // Clickable labels to focus/open selects (makes select focus on label click)
  return (
    <section id="aod" className="container aod-container">
      <h3>Regional map + monthly AOD chart</h3>

      <div
        className="aod-controls"
        style={{ display: "flex", gap: 12, alignItems: "center" }}
      >
        <label style={{ cursor: "pointer" }} onClick={() => yearRef.current && yearRef.current.focus()}>
          Year:
          <select
            ref={yearRef}
            value={year}
            onChange={(e) => setYear(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>

        <label style={{ cursor: "pointer" }} onClick={() => regionRef.current && regionRef.current.focus()}>
          Region:
          <select
            ref={regionRef}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            {COUNTRY_OPTIONS.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        {/* Toggle control for series */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginLeft: 8 }}>
          <label style={{ fontSize: 12 }}>
            <input type="radio" name="series" value="aod" checked={mode==="aod"} onChange={() => setMode("aod")} /> AOD
          </label>
          <label style={{ fontSize: 12 }}>
            <input type="radio" name="series" value="pm25" checked={mode==="pm25"} onChange={() => setMode("pm25")} /> PM2.5
          </label>
          <label style={{ fontSize: 12 }}>
            <input type="radio" name="series" value="both" checked={mode==="both"} onChange={() => setMode("both")} /> Both
          </label>
        </div>
      </div>

      <div className="aod-grid">
        <div
          className="aod-map"
          style={{ borderRadius: 8, overflow: "hidden" }}
        >
          <Map geojson={geoToRender} width={520} height={420} />
        </div>

        <div className="aod-side">
          <div className="aod-chart-header">
            <strong>
              {selectedOpt.label} — {year}
            </strong>
            <div className="aod-chart-sub">Monthly AOD — 0 to at least 3 (left). PM2.5 (right): Good/Moderate/Hazardous</div>
          </div>

          <div className="aod-chart-wrap">
            {/* Provide both series to the chart. chart will keep AOD rendering unchanged. */}
            <SimpleLineChart aodData={aodData || []} pmData={pmData || []} mode={mode} width={380} height={240} />
          </div>
        </div>
      </div>
    </section>
  );
}
// ...existing code...