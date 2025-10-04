import React, { useState, useEffect, useCallback, useRef } from "react";
import { geoMercator, geoPath, geoGraticule } from "d3-geo";
import "./map.css";
import seaMap from "../world-map-json/SEA_Map.json";

export default function Map({ geojson, width = 900, height = 600 }) {
  const data = geojson || seaMap;

  const [selectedCountryIndex, setSelectedCountryIndex] = useState(null);
  const [provinces, setProvinces] = useState(null);
  const [countryDetail, setCountryDetail] = useState(null);

  const projRef = useRef(null);
  const pathRef = useRef(null);
  const graticuleRef = useRef(null);
  const [, setTick] = useState(0);

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

  // Robust loader - try many normalized filename variants (so VNM.geojson -> vietnam.json works)
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
        candidates.push(props.name.toLowerCase().replace(/[\s\.]+/g, "_"));
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
        return;
      }
      if (selectedCountryIndex === featureIndex) {
        setSelectedCountryIndex(null);
        setProvinces(null);
        setCountryDetail(null);
        return;
      }
      setSelectedCountryIndex(featureIndex);
      const feat = data.features[featureIndex];
      loadProvinces(feat);
      loadCountryDetail(feat);
    },
    [data.features, loadProvinces, loadCountryDetail, selectedCountryIndex]
  );

  // animate projection to selected feature (existing logic)
  useEffect(() => {
    if (!projRef.current || !pathRef.current) return;

    let rafId = null;
    let start = null;
    const duration = 600;

    const targetFeature =
      selectedCountryIndex === null
        ? data
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
  }, [selectedCountryIndex, data, width, height]);

  useEffect(() => {
    setSelectedCountryIndex(null);
    setProvinces(null);
    setCountryDetail(null);
  }, [data]);

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

  const proj = projRef.current;
  const pathGenerator = pathRef.current;
  const graticuleFeature = graticuleRef.current;

  const capitals = data.features
    .map((feature, i) => {
      const props = feature.properties || {};
      const lon = props.label_x;
      const lat = props.label_y;
      if (typeof lon !== "number" || typeof lat !== "number") return null;
      const point = proj([lon, lat]);
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

  // compute selected country label (kept as in previous)
  let selectedCountryLabel = null;
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
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
      >
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
              const fill = provinces ? (isSelected ? "#eafaf0" : "#d2efda") : "#dff7ea";
              const stroke = isSelected ? "#166534" : "#2f855a";
              return (
                <path
                  key={`country-${i}`}
                  d={pathGenerator(feature)}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSelected ? 1.2 : 0.8}
                  style={{ transition: "fill .15s, stroke .15s" }}
                  onMouseEnter={(e) => e.currentTarget.setAttribute("fill", "#c8f0d4")}
                  onMouseLeave={(e) => e.currentTarget.setAttribute("fill", fill)}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    handleSelectCountry(i);
                  }}
                />
              );
            })}

            {capitals.map((c) => {
              const flagUrl = c.iso2 ? `https://flagcdn.com/w40/${c.iso2}.png` : null;
              const markerCx = c.cx;
              const markerCy = c.cy - 12;
              const labelY = markerCy - 14;
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
                  <line className="marker-tail" x1={markerCx} y1={markerCy + 8} x2={c.cx} y2={c.cy} stroke="#2f855a" strokeWidth={1.2} strokeLinecap="round" />
                  <polygon className="arrow-tip" points={`${c.cx - 4},${c.cy - 3} ${c.cx + 4},${c.cy - 3} ${c.cx},${c.cy + 4}`} fill="#2f855a" stroke="#214e3f" strokeWidth={0.4} />
                  <circle cx={markerCx} cy={markerCy} r={10} fill="#ffffff" />
                  {flagUrl ? (
                    <g clipPath={`url(#clip-${c.id})`}>
                      <image href={flagUrl} x={markerCx - 10} y={markerCy - 10} width={20} height={20} preserveAspectRatio="xMidYMid slice" style={{ pointerEvents: "none", display: "block" }} />
                    </g>
                  ) : (
                    <text x={markerCx} y={markerCy + 4} fontSize={9} textAnchor="middle" fill="#2f855a" style={{ pointerEvents: "none" }}>{c.name ? c.name[0] : "?"}</text>
                  )}
                  <circle className="marker-outline" cx={markerCx} cy={markerCy} r={10} fill="none" stroke="#2f855a" strokeWidth={1} />
                </g>
              );
            })}
          </g>

          {/* country detail overlay (render when available) */}
          {countryDetail && countryDetail.features && (
            <g className="country-detail-layer">
              {countryDetail.features.map((f, idx) => (
                <path key={`detail-${idx}`} d={pathGenerator(f)} fill="rgba(255,255,255,0.02)" stroke="#0b6630" strokeWidth={1} style={{ opacity: 1, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.15))" }} />
              ))}
            </g>
          )}

          {provinces && provinces.features && (
            <g className="provinces-layer">
              {provinces.features.map((p, idx) => (
                <path key={`prov-${idx}`} d={pathGenerator(p)} fill="#fff8e6" stroke="#d6b74a" strokeWidth={0.6} style={{ opacity: 0.95 }} />
              ))}
            </g>
          )}

          {/* selected country label (same as before) */}
          {selectedCountryLabel && selectedCountryLabel.name && (
            <g className="selected-country-label" pointerEvents="none">
              <text className="country-title country-title-outline" x={selectedCountryLabel.x} y={selectedCountryLabel.y} textAnchor="middle" fontSize={18} fontWeight="700" fill="none" stroke="#ffffff" strokeWidth={5} strokeLinejoin="round" style={{ paintOrder: "stroke", opacity: 0.98 }}>{selectedCountryLabel.name}</text>
              <text className="country-title country-title-fill" x={selectedCountryLabel.x} y={selectedCountryLabel.y} textAnchor="middle" fontSize={18} fontWeight="700" fill="#0b6630" style={{ paintOrder: "normal" }}>{selectedCountryLabel.name}</text>
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
