import React, { useEffect, useMemo, useRef, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import vietnam from "../../world-map-json/vietnam.json";
import combinedCsvUrl from "../../world-map-json/HoChiMinhCity_daily_2023_combined.csv";
import "../map.css";

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines
    .shift()
    .split(",")
    .map((h) => h.trim());
  return lines.map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const obj = {};
    headers.forEach((h, i) => (obj[h] = cols[i] ?? ""));
    // normalize numeric fields
    obj["Year"] = parseInt(obj["Year"], 10);
    obj["Month"] = parseInt(obj["Month"], 10);
    obj["Day"] = parseInt(obj["Day"], 10);
    obj["PM2.5 (avg)"] = parseFloat(obj["PM2.5 (avg)"]);
    obj["NowCast Conc (avg)"] = parseFloat(obj["NowCast Conc (avg)"]);
    obj["AQI (avg)"] =
      obj["AQI (avg)"] === "" ? NaN : parseFloat(obj["AQI (avg)"]);
    obj._date = new Date(obj.Year, obj.Month - 1, obj.Day);
    return obj;
  });
}

const SITE_COORDS = {
  "Ho Chi Minh City": [106.660172, 10.762622], // [lon, lat]
};

const CATEGORY_COLOR = {
  Good: "#16a34a",
  Moderate: "#f97316",
  "Unhealthy for Sensitive Groups": "#ef4444",
  Unhealthy: "#dc2626",
  "Very Unhealthy": "#991b1b",
  Hazardous: "#7f1d1d",
};

const SEASON_COLOR = {
  Wet: "#0ea5e9", // blue
  Dry: "#f97316", // orange
};

function getPeriodForDate(date) {
  // date: JS Date
  const m = date.getMonth() + 1; // 1..12
  const d = date.getDate(); // 1..31

  // Dry: Jan 1 - Feb last day
  if (m === 1 || m === 2) return "Dry-1";
  // Dry: Mar 1 - Apr 30
  if (m === 3 || m === 4) return "Dry-2";
  // Wet: May 1 - Aug 15
  if (m >= 5 && m <= 7) return "Wet-1";
  if (m === 8) {
    return d <= 15 ? "Wet-1" : "Wet-2";
  }
  // Wet: Sep 1 - Nov 30
  if (m >= 9 && m <= 11) return "Wet-2";
  // Dry: all of Dec
  if (m === 12) return "Dry-3";

  return "Unknown";
}

function getPeriodLabel(periodKey, year) {
  // compute feb last day for the given year
  const febLastDay = new Date(year, 2, 0).getDate(); // monthIndex 2 => March, day 0 => last day of Feb
  const febLabel = `Feb ${febLastDay}th`;

  switch (periodKey) {
    case "Dry-1":
      return `Dry (Jan 1st – ${febLabel})`;
    case "Dry-2":
      return "Dry (Mar 1st – Apr 30th)";
    case "Wet-1":
      return "Wet (May 1st – Aug 15th)";
    case "Wet-2":
      return `Wet (Aug 16th – Nov 30th)`;
    case "Dry-3":
      return "Dry (Dec)";
    default:
      return periodKey;
  }
}

export default function MapWithSlider({ width = 900, height = 600 }) {
  const [rows, setRows] = useState([]);
  const [dates, setDates] = useState([]);
  const [index, setIndex] = useState(0);

  const [autoplay, setAutoplay] = useState(true);
  const autoplayRef = useRef(null);
  const rafRef = useRef(null);

  const [animatedIndex, setAnimatedIndex] = useState(0);
  const animatedIndexRef = useRef(0);

  useEffect(() => {
    animatedIndexRef.current = index;
    setAnimatedIndex(index);
  }, [index]);

  useEffect(() => {
    fetch(combinedCsvUrl)
      .then((r) => r.text())
      .then((t) => {
        const parsed = parseCsv(t);
        const filtered = parsed.filter((r) => SITE_COORDS[r.Site]);
        setRows(filtered);
        const uniqTimes = Array.from(
          new Set(filtered.map((r) => r._date.getTime()))
        );
        const uniqDates = uniqTimes
          .sort((a, b) => a - b)
          .map((t) => new Date(t));
        setDates(uniqDates);
        setIndex(Math.max(0, uniqDates.length - 1));
      })
      .catch(() => setRows([]));
  }, []);

  // autoplay effect: advances index automatically until user interaction stops it
  useEffect(() => {
    // stop any running RAF
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (!autoplay || dates.length <= 1) return;

    let last = performance.now();
    const stepsPerSecond = 1.0; // how many date-steps per second (tune for speed)

    function loop(now) {
      const dt = now - last;
      last = now;
      // advance float index
      animatedIndexRef.current += (dt / 1000) * stepsPerSecond;
      // wrap
      if (animatedIndexRef.current > dates.length - 1) {
        animatedIndexRef.current = 0;
      }
      const ai = animatedIndexRef.current;
      setAnimatedIndex(ai);

      // update discrete index when crossing integer boundaries
      const newIndex = Math.round(ai);
      setIndex((prev) => (prev !== newIndex ? newIndex : prev));

      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [autoplay, dates.length]);

  function stopAutoplay() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setAutoplay(false);
    // snap animatedIndex to the current discrete index
    animatedIndexRef.current = index;
    setAnimatedIndex(index);
  }

  const { projection, pathGenerator } = useMemo(() => {
    const proj = geoMercator();
    const pg = geoPath().projection(proj);
    try {
      proj.fitSize([width - 20, height - 20], vietnam);
    } catch (e) {
      proj.scale(1000).center([108, 15]);
    }
    return { projection: proj, pathGenerator: pg };
  }, [width, height]);

  if (!rows.length || !dates.length) {
    return <div className="map-wrapper">Loading map/data…</div>;
  }

  const currentDate = dates[Math.min(Math.max(0, index), dates.length - 1)];
  const dateKey = currentDate.toISOString().slice(0, 10);
  const rowsToday = rows.filter(
    (r) => r._date.toISOString().slice(0, 10) === dateKey
  );

  // prepare chart series for Ho Chi Minh
  const site = "Ho Chi Minh City";
  const seriesAll = rows
    .filter((r) => r.Site === site)
    .sort((a, b) => +a._date - +b._date);

  // determine current period key/label and base season color
  const periodKey = getPeriodForDate(currentDate);
  // use the currentDate's year so the label shows Feb 28 or 29 correctly
  const periodLabel = getPeriodLabel(periodKey, currentDate.getFullYear());

  const baseSeason = periodKey.startsWith("Wet") ? "Wet" : "Dry";
  const seasonColor = SEASON_COLOR[baseSeason] || "#000";

  // filter series to the same period (period window across the whole dataset)
  const periodSeries = seriesAll.filter(
    (s) => getPeriodForDate(s._date) === periodKey
  );

  const chartWidth = 320;
  const chartHeight = 220;
  const pmVals = periodSeries
    .map((s) => s["PM2.5 (avg)"])
    .filter((v) => !isNaN(v));

  // Force the chart y-range to 0..80
  const yMin = 0;
  const yMax = 80;
  const yTicks = [0, 10, 20, 30, 40, 50, 60, 70, 80];

  const xScale = (d) => {
    if (!periodSeries.length) return 0;
    const t0 = +periodSeries[0]._date;
    const t1 = +periodSeries[periodSeries.length - 1]._date;
    return ((+d._date - t0) / Math.max(1, t1 - t0)) * (chartWidth - 30) + 20;
  };
  const yScale = (v) => {
    const range = yMax - yMin || 1;
    return chartHeight - 20 - ((v - yMin) / range) * (chartHeight - 40);
  };

  // helper to detect unhealthy-like categories (case-insensitive)
  const isUnhealthyCategory = (cat) =>
    typeof cat === "string" && cat.toLowerCase().includes("unhealthy");

  return (
    <div
      className="map-wrapper map-with-slider"
      role="region"
      aria-label="Vietnam map with pm2.5 slider"
    >
      <div className="map-controls">
        <div className="map-and-chart">
          <svg
            className="map-svg"
            width="100%"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
          >
            <g>
              {/* country shape */}
              <path
                d={pathGenerator(vietnam)}
                fill="#ffffff"
                stroke="#000"
                strokeWidth={0.8}
              />

              {/* grid: vertical + horizontal lines (placed above country, behind markers) */}
              {[0.1, 0.3, 0.5, 0.7, 0.9].map((gx, i) => {
                const x = gx * width;
                return (
                  <line
                    key={"gridv" + i}
                    className="map-grid"
                    x1={x}
                    x2={x}
                    y1={0}
                    y2={height}
                    stroke="#e6eef6"
                    strokeWidth={1}
                    strokeDasharray="3 4"
                    opacity="0.9"
                  />
                );
              })}

              {[0.1, 0.3, 0.5, 0.7, 0.9].map((gy, i) => {
                const y = gy * height;
                return (
                  <line
                    key={"gridh" + i}
                    className="map-grid"
                    x1={0}
                    x2={width}
                    y1={y}
                    y2={y}
                    stroke="#e6eef6"
                    strokeWidth={1}
                    strokeDasharray="3 4"
                    opacity="0.9"
                  />
                );
              })}

              {/* markers for current date */}
              {rowsToday.map((r, i) => {
                const coords = SITE_COORDS[r.Site];
                if (!coords) return null;
                const [cx, cy] = projection(coords);
                const pm = isNaN(r["PM2.5 (avg)"]) ? 0 : r["PM2.5 (avg)"];
                // radius scaled - make circle visually large relative to number
                const radius = Math.min(120, 8 + pm * 1.6);
                const color = CATEGORY_COLOR[r["AQI Category"]] || "#999";
                return (
                  <g
                    key={i}
                    transform={`translate(${cx}, ${cy})`}
                    className="map-marker"
                  >
                    <circle
                      r={radius}
                      fill={color}
                      opacity="0.7"
                      stroke="#000"
                      strokeWidth={0.6}
                    />
                    <text
                      y="6"
                      textAnchor="middle"
                      fill="#000"
                      fontWeight="700"
                      fontSize={Math.max(10, Math.min(20, radius / 3))}
                      pointerEvents="none"
                    >
                      {Math.round(pm)}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          <div className="chart-box" aria-hidden="false">
            <div className="chart-title">
              Ho Chi Minh City — PM2.5 (avg) -{" "}
              <span style={{ color: seasonColor, fontWeight: 700 }}>
                {periodLabel}
              </span>
            </div>

            <svg
              width={chartWidth}
              height={chartHeight}
              className="chart-svg"
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            >
              {/* chart border */}
              <rect
                x="0.5"
                y="0.5"
                width={chartWidth - 1}
                height={chartHeight - 1}
                rx="6"
                ry="6"
                fill="none"
                stroke="#94a3b8"
                strokeWidth="1.2"
              />

              {/* vertical ruler lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((g, i) => {
                const x = 20 + g * (chartWidth - 30);
                return (
                  <line
                    key={"v" + i}
                    x1={x}
                    x2={x}
                    y1={10}
                    y2={chartHeight - 10}
                    stroke="#cbd5e1"
                    strokeWidth="1"
                  />
                );
              })}

              {/* horizontal grid lines + y tick labels */}
              {yTicks.map((tick, i) => {
                const y = yScale(tick);
                return (
                  <g key={"h" + i} className="chart-tick">
                    <line
                      x1={20}
                      x2={chartWidth - 10}
                      y1={y}
                      y2={y}
                      stroke="#cbd5e1"
                      strokeWidth="1"
                    />
                    <text
                      x={6}
                      y={y + 4}
                      fontSize="10"
                      fill="#334155"
                      textAnchor="start"
                    >
                      {tick}
                    </text>
                  </g>
                );
              })}

              {/* black line for the period/season series */}
              <path
                d={periodSeries
                  .map(
                    (d, i) =>
                      `${i === 0 ? "M" : "L"} ${xScale(d)} ${yScale(
                        d["PM2.5 (avg)"]
                      )}`
                  )
                  .join(" ")}
                fill="none"
                stroke="#000"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {/* vertical faint tick markers at each data x (light) */}
            {(() => {
                if (!periodSeries.length) return null;
                const MS_PER_DAY = 24 * 60 * 60 * 1000;
                const start = new Date(periodSeries[0]._date);
                start.setHours(0, 0, 0, 0);
                const end = new Date(periodSeries[periodSeries.length - 1]._date);
                end.setHours(0, 0, 0, 0);

                const totalDays = Math.round((end - start) / MS_PER_DAY);
                const stepDays = 10;

                // build marker dates at start + n*stepDays
                const markerDates = [];
                for (let day = 0; day <= totalDays; day += stepDays) {
                  markerDates.push(new Date(start.getTime() + day * MS_PER_DAY));
                }
                // ensure final end date is included
                const last = markerDates[markerDates.length - 1];
                if (!last || last.getTime() !== end.getTime()) markerDates.push(end);

                return markerDates.map((d, i) => {
                  const x = xScale({ _date: d });
                  return (
                    <line
                      key={"vx" + i}
                      x1={x}
                      x2={x}
                      y1={10}
                      y2={chartHeight - 10}
                      stroke="#f3f4f6"
                      strokeWidth="0.9"
                      opacity="0.95"
                    />
                  );
                });
              })()}


              {/* show dots ONLY for 'unhealthy' category points */}
              {periodSeries.map((d, i) => {
                if (!isUnhealthyCategory(d["AQI Category"])) return null;
                return (
                  <circle
                    key={"dot" + i}
                    cx={xScale(d)}
                    cy={yScale(d["PM2.5 (avg)"])}
                    r={6}
                    fill="#ef4444"
                    opacity="0.95"
                    stroke="#000"
                    strokeWidth="0.6"
                  />
                );
              })}

              {/* small gray points for all data (subtle) */}
              {periodSeries.map((d, i) => (
                <circle
                  key={"pt" + i}
                  cx={xScale(d)}
                  cy={yScale(d["PM2.5 (avg)"])}
                  r={2.2}
                  fill="#475569"
                  opacity={0.7}
                />
              ))}

              {/* highlight selected date if present in periodSeries */}
              {periodSeries
                .filter((s) => s._date.toISOString().slice(0, 10) === dateKey)
                .map((d, i) => (
                  <circle
                    key={"sel" + i}
                    cx={xScale(d)}
                    cy={yScale(d["PM2.5 (avg)"])}
                    r={8}
                    fill="#f97316"
                    opacity="0.95"
                    stroke="#000"
                    strokeWidth="0.8"
                  />
                ))}
            </svg>

            <div className="chart-legend">
              <span className="legend-dot" style={{ background: "#16a34a" }} />{" "}
              Good
              <span
                className="legend-dot"
                style={{ background: "#f97316", marginLeft: 12 }}
              />{" "}
              Moderate
              <span
                className="legend-dot"
                style={{ background: "#ef4444", marginLeft: 12 }}
              />{" "}
              Unhealthy
            </div>
          </div>
        </div>

        <div className="slider-row">
          <label className="date-label">
            {currentDate.toISOString().slice(0, 10)}
          </label>
          <input
            type="range"
            min={0}
            max={Math.max(0, dates.length - 1)}
            step="0.01"
            value={animatedIndex}
            onChange={(e) => {
              // user interaction should stop autoplay
              stopAutoplay();
              const v = parseFloat(e.target.value);
              // update both animated and discrete index/state
              animatedIndexRef.current = v;
              setAnimatedIndex(v);
              setIndex(Math.round(v));
            }}
            onPointerDown={stopAutoplay}
            onTouchStart={stopAutoplay}
            className="date-slider"
          />
        </div>
      </div>
    </div>
  );
}
