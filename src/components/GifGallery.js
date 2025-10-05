// ...existing code...
import React, { useState } from "react";
import "./GifGallery.css";

const gifs = [
  {
    file: "Dec2018-Nov2019.gif",
    caption: "Southeast Asia AOD from December 2018 to November 2019",
  },
  {
    file: "Dec2019-Nov2020.gif",
    caption: "Southeast Asia AOD from December 2019 to November 2020",
  },
  {
    file: "Dec2020-Nov2021.gif",
    caption: "Southeast Asia AOD from December 2020 to November 2021",
  },
  {
    file: "Dec2021-Nov2022.gif",
    caption: "Southeast Asia AOD from December 2021 to November 2022",
  },
  {
    file: "Dec2022-Nov2023.gif",
    caption: "Southeast Asia AOD from December 2022 to November 2023",
  },
  {
    file: "Dec2023-Nov2024.gif",
    caption: "Southeast Asia AOD from December 2023 to November 2024",
  },
  {
    file: "Dec2024-Today.gif",
    caption: "Southeast Asia AOD from December 2024 to October 2025",
  },
];

export default function GifGallery() {
  const [selected, setSelected] = useState(gifs[0].file);
  const sel = gifs.find((g) => g.file === selected) || gifs[0];

  return (
    
    <section id="nasa" className="gif-gallery container">
      <h4>NASA satellite (TERRA)</h4>
      <p className="disclaimer">
        DISCLAIMER: The color around the map is{" "}
        <span className="highlight-not">NOT</span> a part of the AOD
        measurement, it is there to better help see the border of the countries.
      </p>
 {/* legend + grid remain */}
      <div className="gif-legend" role="figure" aria-label="AOD color legend">
        <img
          src={`${process.env.PUBLIC_URL}/gifs/Messurement.png`}
          alt="AOD colorbar legend: Aerosol Optical Depth (Terra / MODIS)"
          loading="lazy"
        />

        <div className="legend-explain">
          <p className="legend-title">Colorbar: Aerosol Optical Depth (AOD) — Terra / MODIS.</p>
        </div>

        <div className="legend-content" aria-hidden={false}>
          <div className="range-list" aria-label="AOD practical interpretation">
            <div className="range-item range--very-low">
              <span className="swatch" aria-hidden="true" />
              <span className="range-text"><strong>0.0–0.1:</strong> very low (clear)</span>
            </div>

            <div className="range-item range--low">
              <span className="swatch" aria-hidden="true" />
              <span className="range-text"><strong>0.1–0.3:</strong> low</span>
            </div>

            <div className="range-item range--moderate">
              <span className="swatch" aria-hidden="true" />
              <span className="range-text"><strong>0.3–0.6:</strong> moderate</span>
            </div>

            <div className="range-item range--high">
              <span className="swatch" aria-hidden="true" />
              <span className="range-text"><strong>0.6–1.0:</strong> high</span>
            </div>

            <div className="range-item range--extreme">
              <span className="swatch" aria-hidden="true" />
              <span className="range-text"><strong>&gt;1.0:</strong> very high / extreme (likely health/visibility impacts)</span>
            </div>
          </div>
        </div>
      </div>
      {/* File selector */}
      <div className="gif-controls" aria-label="Choose animation file">
        <label>
          Choose file:
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            aria-label="Select GIF to view"
          >
            {gifs.map((g) => (
              <option key={g.file} value={g.file}>
                {g.caption}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Large viewer for chosen GIF */}
      <figure className="gif-viewer" role="region" aria-label="Selected AOD animation">
        <img
          src={`${process.env.PUBLIC_URL}/gifs/${selected}`}
          alt={sel.caption}
          loading="lazy"
        />
        <figcaption>{sel.caption}</figcaption>
      </figure>

     

    
    </section>
  );
}
// ...existing code...