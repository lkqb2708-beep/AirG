// ...existing code...
import React from "react";
import "./App.css";
import Header from "./header/header";
import Map from "./map/map";
import seaMap from "./world-map-json/SEA_Map.json";
import PageLeft from "./pageleft/PageLeft"; // left TOC tab

function App() {
  return (
    <div className="App">
      <Header />

      {/* Landing hero */}
      <main
        className="hero"
        role="banner"
        style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/hero.jpg)` }}
      >
        <div className="hero-overlay" />
        <div
          className="container hero-content"
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          <div
            className="hero-text"
            style={{ display: "flex", alignItems: "baseline", gap: "16px" }}
          >
            <h1 className="hero-title">
              Aero‑Cast — Clean air insights for Southeast Asia
            </h1>
            <p className="hero-sub" style={{ margin: 0 }}>
              Real‑time air quality monitoring and forecasts powered by NASA
              data and AI.
            </p>
          </div>

          <div
            className="hero-ctas"
            style={{
              marginTop: 24,
              marginBottom: "24px",
              display: "flex",
              gap: "80px",
            }}
          >
            <a className="cta" href="#interactive">
              Explore the map
            </a>
            <a className="cta ghost" href="#interactive">
              Learn more
            </a>
          </div>
        </div>
      </main>

      <PageLeft />

      {/* About Us Section */}
      <section id="about-us" className="container">
        <h3>About Us</h3>
        <p>Short about us content.</p>
      </section>

      {/* About the Project Section */}
      <section id="about-project" className="container">
        <h3>About the Project</h3>
        <p>Project overview.</p>
      </section>

      {/* Our Analysis Section */}
      <section id="our-analysis" className="container">
        <h3>Our Analysis</h3>
        <p>Overview of analysis.</p>
      </section>

      {/* NASA satellite Section */}
      <section id="nasa" className="container">
        <h4>NASA satellite (TERRA)</h4>
        <p>Data & notes.</p>
      </section>

      {/* Ground trend Section */}
      <section id="ground-trend" className="container">
        <h4>Ground trend</h4>
        <p>Ground sensor trends.</p>
      </section>

      {/* Case Study Section */}
      <section id="case-study" className="container">
        <h4>Case Study: Transboundary pollution</h4>
        <p>Case study details.</p>
      </section>

      {/* Interactive Map & AI Forecast Section */}
      <section id="interactive" className="container">
        <h3>Interactive Map & AI Forecast</h3>
        <p>Interactive map and forecast information.</p>
        
        <div className="map-container" style={{ width: '100%', display: 'block', marginTop: '24px' }}>
          <Map geojson={seaMap} width={900} height={600} />
        </div>
      </section>

      {/* Take Action Section */}
      <section id="take-action" className="container">
        <h3>Take Action</h3>
      </section>

      {/* Game Section */}
      <section id="game" className="container">
        <h4>Game "Sky Guardians"</h4>
        <p>Game description.</p>
      </section>

      {/* Digital Health Handbook Section */}
      <section id="handbook" className="container">
        <h4>Digital Health Handbook</h4>
        <p>Digital health handbook.</p>
      </section>

      {/* Footer */}
      <footer className="site-footer container">
        <p>&copy; {new Date().getFullYear()} AirGuardians</p>
      </footer>
    </div>
  );
}

export default App;
// ...existing code...