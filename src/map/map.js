/* Full updated file - replace src/map/map.js with this */
import React, { useState, useEffect, useCallback, useRef } from "react";
import { scaleSequential } from "d3-scale";
import { interpolateYlOrRd } from "d3-scale-chromatic";
import { geoMercator, geoPath, geoGraticule, geoCentroid } from "d3-geo";
import "./map.css";
import seaMap from "../world-map-json/SEA_Map.json";
import { csvParse } from "d3-dsv";

function extractDateParts(timePoints) {
  const years = new Set();
  const months = new Set();
  const days = new Set();
  timePoints.forEach((ts) => {
    if (!ts || typeof ts !== "string") return;
    const [date] = ts.split("T");
    if (!date) return;
    const parts = date.split("-");
    const y = parts[0];
    const m = parts[1] || "01";
    years.add(y);
    months.add(`${y}-${m}`);
    days.add(date);
  });
  return {
    years: Array.from(years).sort(),
    months: Array.from(months).sort(),
    days: Array.from(days).sort(),
  };
}

function getPM25ForCity(
  aqByKey,
  city,
  timePoints,
  granularity,
  selectedYear,
  selectedMonth,
  selectedDay
) {
  // granularity: "hour", "day", "month", "year"
  // selectedYear: "2019", selectedMonth: "2019-01", selectedDay: "2019-01-01"
  let values = [];

  if (granularity === "hour" && selectedDay) {
    // All hours for the selected day
    values = timePoints
      .filter((ts) => ts.startsWith(selectedDay))
      .map((ts) => aqByKey[`${city}|${ts}`])
      .filter((v) => v != null);
    return values;
  }

  if (granularity === "day") {
    // All days in the selected month - or if no month, all days in the selected year
    const prefix = selectedMonth || selectedYear;
    if (!prefix) return [];

    const days = {};
    timePoints
      .filter((ts) => ts.startsWith(prefix))
      .forEach((ts) => {
        const day = ts.split("T")[0];
        const val = aqByKey[`${city}|${ts}`];
        if (val != null) {
          if (!days[day]) days[day] = [];
          days[day].push(val);
        }
      });
    // Average for each day
    const dayAverages = Object.values(days).map(
      (vals) => vals.reduce((a, b) => a + b, 0) / vals.length
    );
    return dayAverages;
  }

  if (granularity === "month") {
    // All months in the selected year - or if no year, use latest year
    const yearToUse = selectedYear || findLatestYear(timePoints);
    if (!yearToUse) return [];

    const months = {};
    timePoints
      .filter((ts) => ts.startsWith(yearToUse))
      .forEach((ts) => {
        const [y, m] = ts.split("T")[0].split("-");
        const month = `${y}-${m}`;
        const val = aqByKey[`${city}|${ts}`];
        if (val != null) {
          if (!months[month]) months[month] = [];
          months[month].push(val);
        }
      });
    // Average for each month
    const monthAverages = Object.values(months).map(
      (vals) => vals.reduce((a, b) => a + b, 0) / vals.length
    );
    return monthAverages;
  }
  return [];
}

// Add this helper function to get the latest year from timePoints
function findLatestYear(timePoints) {
  if (!timePoints || timePoints.length === 0) return null;
  const years = new Set();
  timePoints.forEach((ts) => {
    if (ts && typeof ts === "string") {
      const year = ts.split("-")[0];
      if (year) years.add(year);
    }
  });
  return Array.from(years).sort().pop();
}

export default function Map({
  geojson,
  width = 900,
  height = 600,
  // path (from public/) to the CSV used to color the map
  csvPublicPath = "/data/HoChiMinhCity_daily_Alltime_combined.csv",
  // optional YYYY-MM-DD string to display and use for choropleth lookups
  dataDate = null,
  // allow overriding which city to show the hexagon for
  cityName: cityNameProp = "Ho Chi Minh City",
}) {
  const data = geojson || seaMap;
  const [selectedCountryIndex, setSelectedCountryIndex] = useState(null);
  const [provinces, setProvinces] = useState(null);
  const [countryDetail, setCountryDetail] = useState(null);
  const [timePoints, setTimePoints] = useState([]); // array of ISO timestamps (strings)
  const [timeIndex, setTimeIndex] = useState(0); // slider index
  const [hourIndex, setHourIndex] = useState(0);
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [granularity, setGranularity] = useState("hour"); // "hour", "day", "month"
  const [periodIndex, setPeriodIndex] = useState(0);
  const projRef = useRef(null);
  const pathRef = useRef(null);
  const graticuleRef = useRef(null);
  const [, setTick] = useState(0);
  const [aqByKey, setAqByKey] = useState({});
  const colorScale = scaleSequential()
    .domain([0, 120])
    .interpolator(interpolateYlOrRd);
  const { years, months, days } = extractDateParts(timePoints);
  const selectedFeatureName =
    selectedCountryIndex !== null && data.features[selectedCountryIndex]
      ? data.features[selectedCountryIndex].properties?.name ||
        data.features[selectedCountryIndex].properties?.admin ||
        null
      : null;
  const cityName = selectedFeatureName || cityNameProp;
  const highlightCities = [
    { display: "Hanoi", site: "Hanoi", country: "vietnam" },
    {
      display: "Ho Chi Minh City",
      site: "Ho Chi Minh City",
      country: "vietnam",
    },
    { display: "Manila", site: "Manila", country: "philippines" },
    { display: "Kuala Lumpur", site: "Kuala Lumpur", country: "malaysia" },
    // CSV for Jakarta uses "Jakarta Central" as Site; use display "Jakarta"
    { display: "Jakarta", site: "Jakarta Central", country: "indonesia" },
    { display: "Vientiane", site: "Vientiane", country: "laos" },
  ];
  const cityNameForPM = (() => {
    // Get the selected feature for country checking
    const selFeature =
      selectedCountryIndex !== null
        ? data.features[selectedCountryIndex]
        : null;
    const props = selFeature?.properties || {};
    const countryCode = (props.adm0_a3 || props.iso_a2 || "").toLowerCase();

    // Find the matching city for this country
    for (const city of highlightCities) {
      if (countryMatchesCity(selFeature, city.country)) {
        return city.site; // Use the site name from highlightCities
      }
    }

    // Fallback to the display name if no match
    return cityName;
  })();
  const sliderWidth = Math.round(width / 3);
  const targetNorm = normalizeName(cityName);
  const cityInfos = highlightCities.map((c) => {
    const defaultCoords = {
      Hanoi: [105.8342, 21.0278],
      "Ho Chi Minh City": [106.660172, 10.762622],
      Manila: [120.9842, 14.5995],
      "Kuala Lumpur": [101.6869, 3.139],
      Jakarta: [106.8456, -6.2088],
      Vientiane: [102.6331, 17.9757],
    };
    const coord =
      findCityCoordByName(c.display) ||
      defaultCoords[c.display] ||
      (c.display === "Hanoi" ? [105.8422, 21.0278] : [106.660172, 10.762622]);
    // project safely (try lon/lat and swapped order)
    const point =
      coord && projRef.current ? projectSafe(projRef.current, coord) : null;
    // if projection still failed, try using geoCentroid fallback for a feature match
    let finalPoint = point;
    if (!finalPoint) {
      // attempt to find a feature that matches the city's display and use its centroid
      for (const f of data.features) {
        const n = normalizeName(
          f.properties?.name || f.properties?.admin || ""
        );
        if (n && n.includes(normalizeName(c.display))) {
          try {
            const gc = geoCentroid(f);
            finalPoint = projRef.current
              ? projectSafe(projRef.current, gc)
              : null;
          } catch {}
          if (finalPoint) break;
        }
      }
    }
    const usedPoint = finalPoint || point;
    let vals = [];
    if (granularity === "hour" && selectedDay) {
      vals = getPM25ForCity(
        aqByKey,
        c.site,
        timePoints,
        "hour",
        selectedYear,
        selectedMonth,
        selectedDay
      );
    } else if (granularity === "day" && selectedMonth) {
      vals = getPM25ForCity(
        aqByKey,
        c.site,
        timePoints,
        "day",
        selectedYear,
        selectedMonth,
        null
      );
    } else if (granularity === "month" && selectedYear) {
      vals = getPM25ForCity(
        aqByKey,
        c.site,
        timePoints,
        "month",
        selectedYear,
        null,
        null
      );
    }
    const avg =
      vals && vals.length
        ? vals.reduce((a, b) => a + b, 0) / vals.length
        : null;
    return { ...c, coord, point: usedPoint, values: vals, avg };
  });
  const loadGeoJsonFile = useCallback(async (filename) => {
    if (!filename) return null;

    // normalize candidate roots
    const root = filename.toString();
    const rootNoExt = root.replace(/\.(geo)?json$/i, "");
    const lowerRoot = rootNoExt.toLowerCase();

    const tryList = [
      root,
      root.toLowerCase(),
      `${rootNoExt}.geojson`,
      `${rootNoExt}.json`,
      `${lowerRoot}.geojson`,
      `${lowerRoot}.json`,
      // try common lowercase name variants (e.g. "vnm" -> "vietnam")
      // attempt also name without underscores/dashes
      `${lowerRoot.replace(/[_\s-]+/g, "")}.geojson`,
      `${lowerRoot.replace(/[_\s-]+/g, "")}.json`,
    ];

    // remove duplicates while preserving order
    const seen = new Set();
    const candidates = tryList.filter((n) => {
      if (!n) return false;
      const key = n.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    for (const name of candidates) {
      // try module import (bundled files under src/world-map-json)
      try {
        // dynamic import resolves relative to this file
        const mod = await import(`../world-map-json/${name}`);
        return mod.default || mod;
      } catch (e) {
        // import failed, try fetch from public folder
        try {
          const res = await fetch(
            `${process.env.PUBLIC_URL}/world-map-json/${name}`
          );
          if (!res.ok) throw new Error("not found");
          const json = await res.json();
          return json;
        } catch (_err) {
          // continue to next candidate
        }
      }
    }

    return null;
  }, []);
  const loadProvinces = useCallback(
    async (feature) => {
      setProvinces(null);
      if (!feature) return;
      const props = feature.properties || {};
      const filename =
        props.filename || props.adm0_a3 || props.iso_a2 || props.name;
      if (!filename) return;
      const json = await loadGeoJsonFile(filename);
      setProvinces(json);
    },
    [loadGeoJsonFile]
  );
  const loadCountryDetail = useCallback(
    async (feature) => {
      setCountryDetail(null);
      if (!feature) return;
      const props = feature.properties || {};
      const candidates = [];
      if (props.filename) candidates.push(props.filename);
      if (props.adm0_a3) candidates.push(props.adm0_a3);
      if (props.iso_a2) candidates.push(props.iso_a2);
      if (props.name) {
        candidates.push(props.name);
        candidates.push(props.name.toLowerCase().replace(/\s+/g, ""));
      }

      for (const cand of candidates) {
        const json = await loadGeoJsonFile(cand);
        if (json) {
          setCountryDetail(json);
          return;
        }
      }

      // final fallback: try "vietnam" specifically when adm0_a3 === 'VNM' or name contains vietnam
      if (
        props.adm0_a3 === "VNM" ||
        (props.name && /vietnam/i.test(props.name))
      ) {
        const json =
          (await loadGeoJsonFile("vietnam.json")) ||
          (await loadGeoJsonFile("vietnam"));
        if (json) {
          setCountryDetail(json);
          return;
        }
      }

      setCountryDetail(null);
    },
    [loadGeoJsonFile]
  );
  const handleSelectCountry = useCallback(
    (featureIndex) => {
      if (featureIndex === null) {
        setSelectedCountryIndex(null);
        setProvinces(null);
        setCountryDetail(null);
        setSelectedYear(null);
        setSelectedMonth(null);
        setSelectedDay(null);
        setGranularity("hour");
        setPeriodIndex(0);
        setHourIndex(0);
        return;
      }
      if (selectedCountryIndex === featureIndex) {
        setSelectedCountryIndex(null);
        setProvinces(null);
        setCountryDetail(null);
        setSelectedYear(null);
        setSelectedMonth(null);
        setSelectedDay(null);
        setGranularity("hour");
        setPeriodIndex(0);
        setHourIndex(0);
        return;
      }
      setSelectedCountryIndex(featureIndex);
      const feat = data.features[featureIndex];
      loadProvinces(feat);
      loadCountryDetail(feat);
    },
    [data.features, loadProvinces, loadCountryDetail, selectedCountryIndex]
  );
  const proj = projRef.current;
  const pathGenerator = pathRef.current;
  const graticuleFeature = graticuleRef.current;
 const capitals = data.features
  .map((feature, i) => {
    const props = feature.properties || {};
    const lon = props.label_x;
    const lat = props.label_y;
    if (typeof lon !== "number" || typeof lat !== "number") return null;
    
    // Check if proj is a function before using it
    let point = null;
    if (proj && typeof proj === 'function') {
      try {
        point = proj([lon, lat]);
      } catch (e) {
        // Handle projection error gracefully
        console.error("Projection error:", e);
      }
    }
    
    if (!point || !Array.isArray(point)) return null;
    const iso2 = (props.iso_a2 || "").toString().toLowerCase();
    return {
      id: `cap-${i}`,
      name: props.name || props.admin || "",
      iso2,
      cx: point[0],
      cy: point[1],
      featureIndex: i,
    };
  })
  .filter(Boolean);

  let cityPoint = null;
  let pm25Values = [];
  let avgPM25 = null;
  let sliderLabels = [];
  let cityCoord = null;
  let selectedCountryLabel = null;

  function normalizeName(s = "") {
    return String(s)
      .normalize?.("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }
  function isValidPoint(p) {
    return (
      Array.isArray(p) &&
      p.length === 2 &&
      Number.isFinite(p[0]) &&
      Number.isFinite(p[1])
    );
  }
  function projectSafe(proj, coord) {
    if (!proj || !coord || coord.length !== 2) return null;
    const p1 = proj([Number(coord[0]), Number(coord[1])]);
    if (isValidPoint(p1)) return p1;
    const p2 = proj([Number(coord[1]), Number(coord[0])]);
    if (isValidPoint(p2)) return p2;
    return null;
  }
  function hexagonPoints(cx, cy, r) {
    const points = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      points.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)]);
    }
    return points.map((p) => p.join(",")).join(" ");
  }
  function getHexRadius(pm25) {
    // e.g. min 10, max 60
    if (pm25 == null) return 7;
    return 6 + Math.min(30, pm25 * 0.5555);
  }
  function getCategoryColors(pm) {
    if (pm == null) {
      return { fill: "#d1fae5", stroke: "#000000" };
    }
    if (pm <= 35) return { fill: "rgba(69, 194, 136, 1)", stroke: "#054a37ff" };
    if (pm <= 55) return { fill: "#e28b12ff", stroke: "#854310ff" };
    return { fill: "rgba(246, 10, 10, 1)", stroke: "#591313ff" };
  }
  function fmtPM(v) {
    return v == null || !Number.isFinite(v) ? "-" : v.toFixed(2);
  }
  function fmtPM1(v) {
    return v == null || !Number.isFinite(v) ? "-" : v.toFixed(1);
  }
  function formatDateForLabel(ts, gran) {
    if (!ts) return "";
    // ts may be "YYYY-MM-DDTHH:00:00", "YYYY-MM-DD" or "YYYY-MM"
    const datePart = ts.split("T")[0];
    const parts = datePart.split("-");
    if (gran === "month") {
      // "YYYY-MM" -> "MM/YY"
      const yy = (parts[0] || "").slice(2);
      const mm = parts[1] || "01";
      return `${mm}/${yy}`;
    }
    // day/hour -> "DD/MM/YY"
    const y = parts[0] || "0000";
    const m = (parts[1] || "01").padStart(2, "0");
    const d = (parts[2] || "01").padStart(2, "0");
    return `${d}/${m}/${y.slice(2)}`;
  }
  for (const f of data.features) {
    const props = f.properties || {};
    if (props.name === cityName || props.admin === cityName) {
      if (
        typeof props.label_x === "number" &&
        typeof props.label_y === "number"
      ) {
        cityCoord = [props.label_x, props.label_y];
      } else {
        cityCoord = [106.660172, 10.762622];
      }
      break;
    }
  }
  function findCityCoordByName(name) {
    if (!name) return null;
    const norm = normalizeName(name);
    // first exact/admin match
    for (const f of data.features) {
      const props = f.properties || {};
      if (props.name === name || props.admin === name) {
        if (
          typeof props.label_x === "number" &&
          typeof props.label_y === "number"
        )
          return [props.label_x, props.label_y];
        if (props.label_x && props.label_y)
          return [Number(props.label_x), Number(props.label_y)];
        try {
          const gc = geoCentroid(f);
          if (gc && gc.length === 2) return gc;
        } catch {}
      }
    }
    // second normalized includes
    for (const f of data.features) {
      const props = f.properties || {};
      const n = normalizeName(props.name || props.admin || "");
      if (n && n.includes(norm)) {
        if (
          typeof props.label_x === "number" &&
          typeof props.label_y === "number"
        )
          return [props.label_x, props.label_y];
        if (props.label_x && props.label_y)
          return [Number(props.label_x), Number(props.label_y)];
        try {
          const gc = geoCentroid(f);
          if (gc && gc.length === 2) return gc;
        } catch {}
      }
    }
    return null;
  }
  function countryMatchesCity(feature, cityCountryKey) {
    if (!feature) return false;
    const props = feature.properties || {};
    const adm0 = String(props.adm0_a3 || "").toLowerCase();
    const iso2 = String(props.iso_a2 || "").toLowerCase();
    const name = normalizeName(props.name || props.admin || "");
    const mapCodes = {
      vnm: "vietnam",
      phl: "philippines",
      mys: "malaysia",
      idn: "indonesia",
      lao: "laos",
      vn: "vietnam",
      ph: "philippines",
      my: "malaysia",
      id: "indonesia",
      la: "laos",
    };
    if (adm0 && mapCodes[adm0]) return mapCodes[adm0] === cityCountryKey;
    if (iso2 && mapCodes[iso2]) return mapCodes[iso2] === cityCountryKey;
    // fallback to name inclusion
    return name.includes(cityCountryKey);
  }
  function countryMatchesCity(feature, cityCountryKey) {
    if (!feature) return false;
    const props = feature.properties || {};
    const adm0 = String(props.adm0_a3 || "").toLowerCase();
    const iso2 = String(props.iso_a2 || "").toLowerCase();
    const name = normalizeName(props.name || props.admin || "");
    const mapCodes = {
      vnm: "vietnam",
      phl: "philippines",
      mys: "malaysia",
      idn: "indonesia",
      lao: "laos",
      vn: "vietnam",
      ph: "philippines",
      my: "malaysia",
      id: "indonesia",
      la: "laos",
    };
    if (adm0 && mapCodes[adm0]) return mapCodes[adm0] === cityCountryKey;
    if (iso2 && mapCodes[iso2]) return mapCodes[iso2] === cityCountryKey;
    // fallback to name inclusion
    return name.includes(cityCountryKey);
  }

  useEffect(() => {
    if (granularity === "month" || granularity === "day") {
      setPeriodIndex((pi) =>
        pm25Values && pm25Values.length > 0
          ? Math.max(0, Math.min(pm25Values.length - 1, pi))
          : 0
      );
    } else {
      setPeriodIndex(0);
    }
  }, [granularity, pm25Values.length, selectedMonth, selectedYear, pm25Values]);

  useEffect(() => {
    if (granularity === "hour") {
      setHourIndex((hi) =>
        pm25Values && pm25Values.length > 0
          ? Math.max(0, Math.min(pm25Values.length - 1, hi))
          : 0
      );
    } else {
      setHourIndex(0);
    }
  }, [
    granularity,
    pm25Values.length,
    selectedDay,
    selectedMonth,
    selectedYear,
    pm25Values,
  ]);

  useEffect(() => {
    if (!csvPublicPath) return;
    let cancelled = false;

    // Always attempt to load Ho Chi Minh and Hanoi datasets and additionally the other cities
    const defaultHCM = "/data/HoChiMinhCity_daily_Alltime_combined.csv";
    const hanoiPath = "/data/Hanoi_daily_Alltime_combined.csv";
    const manilaPath = "/data/Manila_daily_Alltime_combined.csv";
    const klPath = "/data/KualaLumpur_daily_Alltime_combined.csv";
    const jktPath = "/data/Jakarta_daily_Alltime_combined.csv";
    const vientianePath = "/data/Vientiane_daily_Alltime_combined.csv";

    const candidatePaths = [
      csvPublicPath || defaultHCM,
      defaultHCM,
      hanoiPath,
      manilaPath,
      klPath,
      jktPath,
      vientianePath,
    ].filter(Boolean);

    // keep unique preserve order
    const uniq = Array.from(new Set(candidatePaths));

    const urls = uniq.map((p) =>
      p.startsWith("http") || p.startsWith("//")
        ? p
        : `${process.env.PUBLIC_URL || ""}${p}`
    );

    // fetch all CSVs in parallel and merge results
    Promise.all(
      urls.map((u) =>
        fetch(u)
          .then((r) => {
            if (!r.ok) throw new Error(`CSV fetch failed: ${r.status}`);
            return r.text();
          })
          .catch((err) => {
            console.warn("CSV fetch failed:", u, err);
            return null;
          })
      )
    )
      .then((texts) => {
        if (cancelled) return;
        const byKey = {};
        const timesSet = new Set();

        texts.forEach((text) => {
          if (!text) return;
          const rows = csvParse(text);
          rows.forEach((r) => {
            const site = (r.Site || r.site || "").toString().trim();
            const year = r.Year ?? r.year;
            const month = r.Month ?? r.month;
            const day = r.Day ?? r.day;
            const hour = r.Hour ?? r.hour ?? "0";
            if (!site || !year) return;
            const yy = String(year).padStart(4, "0");
            const mm = String(month || "1").padStart(2, "0");
            const dd = String(day || "1").padStart(2, "0");
            const hh = String(hour || "0").padStart(2, "0");
            const ts = `${yy}-${mm}-${dd}T${hh}:00:00`;
            const valStr =
              r["PM2.5 (avg)"] ??
              r["PM2.5"] ??
              r["PM2.5 (Avg)"] ??
              r.Value ??
              r.value;
            const val = valStr === "" || valStr == null ? null : Number(valStr);
            // merge: later files simply overwrite same key (paths order gives csvPublicPath first)
            byKey[`${site}|${ts}`] = Number.isNaN(val) ? null : val;
            timesSet.add(ts);
          });
        });

        const times = Array.from(timesSet).sort();
        setAqByKey(byKey);
        setTimePoints(times);
        if (times.length > 0) {
          const initIndex = Math.max(0, times.length - 1);
          setTimeIndex(initIndex);
        }
      })
      .catch((err) => {
        console.warn("CSV load failed", err);
        setAqByKey({});
        setTimePoints([]);
      });

    return () => {
      cancelled = true;
    };
  }, [csvPublicPath, cityNameForPM]);

  useEffect(() => {
    if (timePoints.length === 0) return;
    // clamp timeIndex to valid range and force a redraw via tick
    const idx = Math.max(0, Math.min(timePoints.length - 1, timeIndex));
    setTick((t) => t + 1);
  }, [timeIndex, timePoints.length]);

  useEffect(() => {
    const p = geoMercator();
    const pg = geoPath().projection(p);
    const graticule = geoGraticule().step([5, 5]);

    if (data && data.type) {
      try {
        p.fitSize([width - 20, height - 20], data);
      } catch (e) {
        p.scale(1000).center([108, 15]);
      }
    } else {
      p.scale(1000).center([108, 15]);
    }

    projRef.current = p;
    pathRef.current = pg;
    graticuleRef.current = graticule();

    setTick((t) => t + 1);
  }, [data, width, height]);

  useEffect(() => {
    if (!projRef.current || !pathRef.current) return;

    let rafId = null;
    let start = null;
    const duration = 600;

    const targetFeature =
      selectedCountryIndex === null
        ? data
        : // prefer the loaded countryDetail (provinces / detailed file) when present
        countryDetail && countryDetail.type
        ? countryDetail
        : {
            type: "FeatureCollection",
            features: [data.features[selectedCountryIndex]],
          };

    const tempProj = geoMercator();
    try {
      tempProj.fitSize([width - 20, height - 20], targetFeature);
    } catch {
      tempProj.scale(1000).center([108, 15]);
    }

    const startScale = projRef.current.scale();
    const startTranslate = projRef.current.translate();
    const targetScale = tempProj.scale();
    const targetTranslate = tempProj.translate();

    if (
      Math.abs(startScale - targetScale) < 1e-6 &&
      Math.abs(startTranslate[0] - targetTranslate[0]) < 1e-6 &&
      Math.abs(startTranslate[1] - targetTranslate[1]) < 1e-6
    ) {
      projRef.current.scale(targetScale).translate(targetTranslate);
      pathRef.current = geoPath().projection(projRef.current);
      setTick((t) => t + 1);
      return;
    }

    function ease(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function step(ts) {
      if (!start) start = ts;
      const t = Math.min(1, (ts - start) / duration);
      const e = ease(t);

      const s = startScale + (targetScale - startScale) * e;
      const tx =
        startTranslate[0] + (targetTranslate[0] - startTranslate[0]) * e;
      const ty =
        startTranslate[1] + (targetTranslate[1] - startTranslate[1]) * e;

      projRef.current.scale(s).translate([tx, ty]);
      pathRef.current = geoPath().projection(projRef.current);
      setTick((t) => t + 1);

      if (t < 1) {
        rafId = requestAnimationFrame(step);
      }
    }

    rafId = requestAnimationFrame(step);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [selectedCountryIndex, data, countryDetail, width, height]);

  useEffect(() => {
    setSelectedCountryIndex(null);
    setProvinces(null);
    setCountryDetail(null);
  }, [data]);

  if (selectedCountryIndex !== null) {
    if (granularity === "hour" && selectedDay) {
      pm25Values = getPM25ForCity(
        aqByKey,
        cityNameForPM,
        timePoints,
        "hour",
        selectedYear,
        selectedMonth,
        selectedDay
      );
    } else if (granularity === "day") {
      // Remove the selectedMonth condition
      pm25Values = getPM25ForCity(
        aqByKey,
        cityNameForPM,
        timePoints,
        "day",
        selectedYear,
        selectedMonth || selectedYear,
        null
      );
    } else if (granularity === "month") {
      // Always fetch month values when a country is selected
      pm25Values = getPM25ForCity(
        aqByKey,
        cityNameForPM,
        timePoints,
        "month",
        selectedYear || findLatestYear(timePoints),
        null,
        null
      );
    }

    // If no values were found with the calculated city name, try with the display name from highlightCities
    if (pm25Values.length === 0) {
      const countryFeature = data.features[selectedCountryIndex];
      for (const city of highlightCities) {
        if (countryMatchesCity(countryFeature, city.country)) {
          const altPM25Values = getPM25ForCity(
            aqByKey,
            city.display, // Try with display name as fallback
            timePoints,
            granularity,
            selectedYear || findLatestYear(timePoints),
            selectedMonth,
            selectedDay
          );
          if (altPM25Values.length > 0) {
            pm25Values = altPM25Values;
            break;
          }
        }
      }
    }
  }

  if (granularity === "day" && pm25Values.length > 0) {
    avgPM25 = pm25Values.reduce((a, b) => a + b, 0) / pm25Values.length;
  }

  if (granularity === "month" && pm25Values.length > 0) {
    avgPM25 = pm25Values.reduce((a, b) => a + b, 0) / pm25Values.length;
  }

  if (granularity === "month") {
    // For month granularity, show all months in the selected year (or latest year)
    const yearToUse = selectedYear || years[years.length - 1];
    sliderLabels = months.filter((m) => m.startsWith(yearToUse));
  } else if (granularity === "day") {
    // For day granularity, show all days in the selected month (or first month of year)
    const prefixToUse = selectedMonth || (selectedYear && `${selectedYear}-01`);
    sliderLabels = days.filter((d) => prefixToUse && d.startsWith(prefixToUse));
  } else if (granularity === "hour" && selectedDay) {
    sliderLabels = timePoints.filter((ts) => ts.startsWith(selectedDay));
  }

  if (!cityCoord) {
    for (const f of data.features) {
      const props = f.properties || {};
      const n = normalizeName(props.name || props.admin || "");
      if (n && n.includes(targetNorm)) {
        if (
          typeof props.label_x === "number" &&
          typeof props.label_y === "number"
        ) {
          cityCoord = [props.label_x, props.label_y];
        } else if (props.label_x && props.label_y) {
          cityCoord = [Number(props.label_x), Number(props.label_y)];
        } else {
          cityCoord = [106.660172, 10.762622];
        }
        break;
      }
    }
  }

  if (!cityCoord) {
    cityCoord = [106.660172, 10.762622];
  }

  if (cityCoord && projRef.current) {
    cityPoint = projRef.current(cityCoord);
  }

  if (
    !data ||
    !data.features ||
    data.features.length === 0 ||
    !projRef.current ||
    !pathRef.current
  ) {
    return (
      <div className="map-error">
        No valid GeoJSON found — please add valid GeoJSON to
        src/world-map-json/SEA_Map.json
      </div>
    );
  }

  if (
    selectedCountryIndex !== null &&
    data.features[selectedCountryIndex] &&
    pathGenerator
  ) {
    try {
      const feat = data.features[selectedCountryIndex];
      const b = pathGenerator.bounds(feat);
      const x0 = b[0][0],
        y0 = b[0][1];
      const x1 = b[1][0],
        y1 = b[1][1];
      const centerX = (x0 + x1) / 2;
      let labelY = Math.max(12, y0 - Math.max(12, (y1 - y0) * 0.06));
      if (labelY < 12) labelY = Math.min(20, (y0 + y1) / 2);
      labelY += 10;
      const name =
        (feat.properties && (feat.properties.name || feat.properties.admin)) ||
        feat.properties?.sovereignt ||
        "";
      selectedCountryLabel = { x: centerX, y: labelY, name };
    } catch {
      selectedCountryLabel = null;
    }
  }

  return (
    <div className="map-wrapper" role="img" aria-label="SEA map">
      {/* Date selectors */}
      {selectedCountryIndex !== null && (
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <select
            value={selectedYear || ""}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setSelectedMonth(null);
              setSelectedDay(null);
              setGranularity("month");
            }}
          >
            <option value="">Select Year</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          {selectedYear && (
            <select
              value={selectedMonth || ""}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setSelectedDay(null);
                setGranularity("day");
              }}
            >
              <option value="">All Month</option>
              {months
                .filter((m) => m.startsWith(selectedYear))
                .map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
            </select>
          )}
          {selectedMonth && (
            <select
              value={selectedDay || ""}
              onChange={(e) => {
                setSelectedDay(e.target.value);
                setGranularity("hour");
              }}
            >
              <option value="">All Day</option>
              {days
                .filter((d) => d.startsWith(selectedMonth))
                .map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
            </select>
          )}
        </div>
      )}

      {/* Hour slider */}
      {selectedCountryIndex !== null && pm25Values.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {granularity === "hour" ? (
            <>
              <input
                type="range"
                min={0}
                max={pm25Values.length - 1}
                value={hourIndex}
                onChange={(e) => setHourIndex(Number(e.target.value))}
                style={{ width: sliderWidth }}
              />
              <div style={{ minWidth: 220 }}>
                <div style={{ fontSize: 12, color: "#374151" }}>
                  {sliderLabels[hourIndex] ?? `Hour ${hourIndex}`}
                </div>
                <div style={{ fontWeight: 700 }}>
                  PM2.5: {fmtPM(pm25Values[hourIndex])}
                </div>
              </div>
            </>
          ) : (
            // month/day slider uses periodIndex
            <>
              <input
                type="range"
                min={0}
                max={pm25Values.length - 1}
                value={periodIndex}
                onChange={(e) => setPeriodIndex(Number(e.target.value))}
                style={{ width: sliderWidth }}
              />
              <div style={{ minWidth: 220 }}>
                <div style={{ fontSize: 12, color: "#374151" }}>
                  {sliderLabels[periodIndex] ?? `#${periodIndex}`}
                </div>
                <div style={{ fontWeight: 700 }}>
                  PM2.5: {fmtPM(pm25Values[periodIndex])}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* date label (top-right) */}
        {dataDate && (
          <text
            x={width - 12}
            y={28}
            textAnchor="end"
            fontSize={18}
            fill="#0b6630"
            fontWeight="700"
            pointerEvents="none"
          >
            {dataDate}
          </text>
        )}
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="transparent"
          onClick={() => handleSelectCountry(null)}
          style={{ cursor: "default" }}
        />

        <defs>
          {capitals.map((c) => (
            <clipPath id={`clip-${c.id}`} key={`clip-${c.id}`}>
              <circle cx={c.cx} cy={c.cy - 12} r={10} />
            </clipPath>
          ))}
        </defs>

        <g>
          {/* base layer: graticule, country outlines and base markers.
              Hide completely when a country is selected so the detailed overlay is shown cleanly */}
          <g
            className="base-layer"
            style={{
              transition: "opacity .25s",
              opacity: selectedCountryIndex !== null ? 0 : 1,
              pointerEvents: selectedCountryIndex !== null ? "none" : "auto",
            }}
          >
            <path
              d={pathGenerator(graticuleFeature)}
              fill="none"
              stroke="#bfe6cf"
              strokeWidth={0.6}
              opacity={0.9}
              className="map-grid"
            />

            {data.features.map((feature, i) => {
              const isSelected = selectedCountryIndex === i;
              // compute name/key/value first (was declared after choropleth in original code)
              const fname =
                (feature.properties &&
                  (feature.properties.name ||
                    feature.properties.admin ||
                    feature.properties.id)) ||
                "";
              const key = dataDate ? `${fname}|${dataDate}` : null;
              const value = key ? aqByKey[key] : null;

              const choroplethFill =
                value != null ? colorScale(Math.min(120, value)) : null;

              const fill =
                choroplethFill ||
                (provinces ? (isSelected ? "#eafaf0" : "#d2efda") : "#dff7ea");
              const stroke = isSelected ? "#166534" : "#2f855a";
              return (
                <path
                  key={`country-${i}`}
                  d={pathGenerator(feature)}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSelected ? 1.2 : 0.8}
                  style={{ transition: "fill .15s, stroke .15s" }}
                  onMouseEnter={(e) =>
                    e.currentTarget.setAttribute("fill", "#c8f0d4")
                  }
                  onMouseLeave={(e) =>
                    e.currentTarget.setAttribute("fill", fill)
                  }
                  onClick={(ev) => {
                    ev.stopPropagation();
                    handleSelectCountry(i);
                  }}
                />
              );
            })}

            {capitals.map((c) => {
              const flagUrl = c.iso2
                ? `https://flagcdn.com/w40/${c.iso2}.png`
                : null;
              const markerCx = c.cx;
              const markerCy = c.cy - 12;
              return (
                <g
                  key={c.id}
                  className="capital-marker"
                  aria-label={c.name}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    handleSelectCountry(c.featureIndex);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <line
                    className="marker-tail"
                    x1={markerCx}
                    y1={markerCy + 8}
                    x2={c.cx}
                    y2={c.cy}
                    stroke="#2f855a"
                    strokeWidth={1.2}
                    strokeLinecap="round"
                  />
                  <polygon
                    className="arrow-tip"
                    points={`${c.cx - 4},${c.cy - 3} ${c.cx + 4},${c.cy - 3} ${
                      c.cx
                    },${c.cy + 4}`}
                    fill="#2f855a"
                    stroke="#214e3f"
                    strokeWidth={0.4}
                  />
                  <circle cx={markerCx} cy={markerCy} r={10} fill="#ffffff" />
                  {flagUrl ? (
                    <g clipPath={`url(#clip-${c.id})`}>
                      <image
                        href={flagUrl}
                        x={markerCx - 10}
                        y={markerCy - 10}
                        width={20}
                        height={20}
                        preserveAspectRatio="xMidYMid slice"
                        style={{ pointerEvents: "none", display: "block" }}
                      />
                    </g>
                  ) : (
                    <text
                      x={markerCx}
                      y={markerCy + 4}
                      fontSize={9}
                      textAnchor="middle"
                      fill="#2f855a"
                      style={{ pointerEvents: "none" }}
                    >
                      {c.name ? c.name[0] : "?"}
                    </text>
                  )}
                  <circle
                    className="marker-outline"
                    cx={markerCx}
                    cy={markerCy}
                    r={10}
                    fill="none"
                    stroke="#2f855a"
                    strokeWidth={1}
                  />
                </g>
              );
            })}
          </g>

          {/* country detail overlay (render when available) */}
          {countryDetail && countryDetail.features && (
            <g className="country-detail-layer">
              {countryDetail.features.map((f, idx) => (
                <path
                  key={`detail-${idx}`}
                  d={pathGenerator(f)}
                  fill="rgba(255,255,255,0.02)"
                  stroke="#0b6630"
                  strokeWidth={1}
                  style={{
                    opacity: 1,
                    filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.15))",
                  }}
                />
              ))}
            </g>
          )}

          {provinces && provinces.features && (
            <g className="provinces-layer">
              {provinces.features.map((p, idx) => (
                <path
                  key={`prov-${idx}`}
                  d={pathGenerator(p)}
                  fill="#fff8e6"
                  stroke="#d6b74a"
                  strokeWidth={0.6}
                  style={{ opacity: 0.95 }}
                />
              ))}
            </g>
          )}

          {/* time slider */}
          {selectedCountryIndex === null &&
            timePoints &&
            timePoints.length > 0 && (
              <div
                style={{
                  padding: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <button onClick={() => setTimeIndex(0)}>⏮</button>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, timePoints.length - 1)}
                  value={timeIndex}
                  onChange={(e) => setTimeIndex(Number(e.target.value))}
                  style={{ width: sliderWidth }}
                />
                <div
                  style={{
                    minWidth: 160,
                    textAlign: "right",
                    fontFamily: "monospace",
                  }}
                >
                  {timePoints[timeIndex]}
                </div>
              </div>
            )}

          {/* selected country label (same as before) */}
          {selectedCountryLabel && selectedCountryLabel.name && (
            <g className="selected-country-label" pointerEvents="none">
              <text
                className="country-title country-title-outline"
                x={selectedCountryLabel.x}
                y={selectedCountryLabel.y}
                textAnchor="middle"
                fontSize={18}
                fontWeight="700"
                fill="none"
                stroke="#ffffff"
                strokeWidth={5}
                strokeLinejoin="round"
                style={{ paintOrder: "stroke", opacity: 0.98 }}
              >
                {selectedCountryLabel.name}
              </text>
              <text
                className="country-title country-title-fill"
                x={selectedCountryLabel.x}
                y={selectedCountryLabel.y}
                textAnchor="middle"
                fontSize={18}
                fontWeight="700"
                fill="#0b6630"
                style={{ paintOrder: "normal" }}
              >
                {selectedCountryLabel.name}
              </text>
            </g>
          )}
        </g>

        {/* City hexagon marker */}
        {/* render one or more city hexagons when zoomed in */}
        {selectedCountryIndex !== null &&
          // compute selected country feature once
          (() => {
            const selFeat = data.features[selectedCountryIndex];
            return cityInfos
              .filter((ci) => {
                // Show hex only if the selected country matches that city's country
                return countryMatchesCity(selFeat, ci.country);
              })
              .map((ci, idx) => {
                if (!ci.point) return null;
                const currentPM =
                  granularity === "hour"
                    ? ci.values[hourIndex]
                    : ci.values[periodIndex] ?? ci.avg;
                const colors = getCategoryColors(currentPM);
                const r = getHexRadius(currentPM);
                const points = hexagonPoints(ci.point[0], ci.point[1], r);
                const selectedTs =
                  granularity === "hour"
                    ? timePoints.filter((ts) => ts.startsWith(selectedDay))[
                        hourIndex
                      ] || timePoints[hourIndex]
                    : sliderLabels[periodIndex] || timePoints[timeIndex];
                const dateLabel = formatDateForLabel(selectedTs, granularity);
                const valueLabel = fmtPM1(currentPM);
                const cityLabel = ci.display;

                return (
                  <g
                    key={`city-hex-${idx}`}
                    style={{
                      opacity: selectedCountryIndex !== null ? 1 : 0,
                      transition: "opacity 400ms ease",
                      pointerEvents: "none",
                    }}
                  >
                    <polygon
                      points={points}
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth={2}
                      opacity={1}
                    >
                      <animateTransform
                        attributeName="transform"
                        attributeType="XML"
                        type="rotate"
                        dur="8s"
                        from={`0 ${ci.point[0]} ${ci.point[1]}`}
                        to={`360 ${ci.point[0]} ${ci.point[1]}`}
                        repeatCount="indefinite"
                      />
                    </polygon>

                    <text
                      x={ci.point[0]}
                      y={ci.point[1] - r - 8}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight={700}
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth={0.8}
                      style={{ paintOrder: "stroke" }}
                      pointerEvents="none"
                    >
                      {dateLabel}
                    </text>

                    <text
                      x={ci.point[0]}
                      y={ci.point[1] + 4}
                      textAnchor="middle"
                      fontSize={12}
                      fontWeight={800}
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth={0.9}
                      style={{ paintOrder: "stroke" }}
                      pointerEvents="none"
                    >
                      {valueLabel}
                    </text>

                    <text
                      x={ci.point[0]}
                      y={ci.point[1] + r + 14}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={700}
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth={0.8}
                      style={{ paintOrder: "stroke" }}
                      pointerEvents="none"
                    >
                      {cityLabel}
                    </text>
                  </g>
                );
              });
          })()}
      </svg>
    </div>
  );
}
