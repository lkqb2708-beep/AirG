import React from "react";
import "./App.css";
import Header from "./header/header";
import Map from "./map/map";
import seaMap from "./world-map-json/SEA_Map.json";
import PageLeft from "./pageleft/PageLeft"; // left TOC tab
import GifGallery from "./components/GifGallery";
import AOD from "./AOD_Map/AOD";
import Predict from "./predict/preditct";

// --- Child Components for better organization ---

const Hero = () => (
  <main
    className="hero"
    role="banner"
    style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/hero.jpg)` }}
  >
    <div className="hero-overlay" />
    <div className="container hero-content">
      <div className="hero-text">
        <h1 className="hero-title">Aero‑Cast — Seeing the invisible air</h1>
        <p className="hero-sub">
          Real‑time air quality monitoring and forecasts powered by NASA
          data and AI.
        </p>
      </div>
      <div className="hero-ctas">
        <a className="cta" href="#interactive">
          Explore the map
        </a>
        <a className="cta ghost" href="#interactive">
          Learn more
        </a>
      </div>
    </div>
  </main>
);

const AboutUs = () => (
  <section id="about-us" className="container">
    <h3>About Us</h3>
    <p>We are The Airguardian, a passionate student team from Vietnam, united by one mission: to make the invisible visible.</p>
    <p>Through our project Aero-Cast: Seeing the Invisible Air, we transform complex NASA satellite data into simple, engaging stories about the air we breathe.</p>
    <p>Our team combines creativity, science, and technology to build a platform that forecasts air quality, visualizes pollution in motion, and inspires communities to take action.</p>
    <p>From space data to local impact, we believe everyone — especially young people — can become a guardian of the air we share.</p>
  </section>
);

const AboutProject = () => (
  <section id="about-project" className="container">
    <h3>About the Project</h3>
    <p>Aero-Cast was born from a simple question asked by students: “Can we see the air we breathe?”</p>
    <p>In response, our team of young learners designed a project that turns invisible air data into stories that everyone can understand.</p>
    <p>Using NASA’s Terra and Aqua MODIS Aerosol Optical Depth (AOD) data, combined with meteorological variables from Nasa power and AI-based modeling, Aero-Cast estimates and forecasts PM2.5 concentrations.</p>
    <p>The results are visualized through an interactive web platform allowing users to explore real-time and predicted air quality across major cities in Southeast Asia, at their fingertips.</p>
    <p>Beyond forecasting, Aero-Cast embraces education and storytelling.</p>
    <p>The project integrates mini-games, animations, and illustrated handbooks to transform scientific data into interactive learning experiences for students and communities.</p>
    <p>By merging space science with creativity, it encourages young people to learn, reflect, and act toward protecting their environment.</p>
  </section>
);

const OurAnalysis = () => (
  <section id="our-analysis" className="container">
    <h3>Our Analysis</h3>
    <p>To reveal the invisible patterns of air pollution, we integrated NASA satellite data (Terra & Aqua MODIS AOD) with ground-based PM2.5 observations and meteorological data from open sources.</p>
    <p>Using AI and machine learning models, we analyzed how aerosols move across regions and how weather conditions such as wind, humidity, and temperature influence air quality.</p>
    <p>Our results show clear spatial and temporal patterns: PM2.5 levels tend to rise during dry, low-wind conditions and peak in urban or industrial zones.</p>
    <p>These insights help both scientists and citizens understand when and where air pollution becomes most dangerous — and what actions can be taken to stay safe.</p>
    <p>The analysis doesn’t stop at numbers.</p>
    <p>Through interactive maps, animations, and an educational game, we bring these findings to life, allowing everyone to explore, learn, and act for cleaner air.</p>
  </section>
);

const InteractiveSection = () => (
  <section id="interactive" className="container">
    <h3>Interactive Map & AI Forecast</h3>
    <p>Explore historical air quality data and see our AI-powered predictions for major cities across Southeast Asia.</p>
    <div className="map-container">
      <Map geojson={seaMap} width={900} height={600} />
    </div>
    <AOD />
    <Predict />
  </section>
);

const GameSection = () => (
  <section id="game" className="container">
    <h3>Game "SDG Challenge: For Our Shared Breath"</h3>
    <p>Do you have what it takes to save a city from pollution?</p>
    <p>Take on the "SDG Challenge: For Our Shared Breath" – the educational game designed to turn knowledge into action!</p>
    <p>In the game, you'll take on the role of an Environmental Guardian, facing realistic air pollution scenarios in the virtual cities of Southeast Asia.</p>
    <p>Your mission is to make wise choices—by correctly answering trivia questions—to clean the air and bring the green back to your city.</p>
    <p>This isn't just a typical knowledge quiz.</p>
    <p>Each question is designed to help you discover the deep connection between the air we breathe and the global Sustainable Development Goals (SDGs) – from Good Health and Well-being (SDG 3) and Sustainable Cities (SDG 11), to Climate Action (SDG 13).</p>
    <p>Every correct answer doesn't just help you win the game; it also equips you with a powerful real-world tool: knowledge.</p>
    <p>Let's play, learn, and become part of the solution for a cleaner future!</p>
  </section>
);

// ...existing code...
const HandbookSection = () => {
  const base = process.env.PUBLIC_URL || "";
  // exact filenames from your public/pdf folder (keeps order)
  const filenames = [
    "1 (1).png",
    "1 (2).png",
    "1 (3).png",
    "1 (4).png",
    "1 (5).png",
    "1 (6).png",
    "1 (7).png",
    "1 (8).png",
    "1 (9).png",
    "1 (10).png"
  ];
  const handbookImages = filenames.map(f => `${base}/pdf/${encodeURIComponent(f)}`);
  const pdfPath = `${base}/pdf/${encodeURIComponent("Ways to stop air pollution.pdf")}`;

  const perPage = 4;
  const [page, setPage] = React.useState(0);
  const totalPages = Math.ceil(handbookImages.length / perPage);
  const start = page * perPage;
  const pageImages = handbookImages.slice(start, start + perPage);

  return (
    <section id="handbook" className="container">
      <h3>Digital Health Handbook — A Compass for Your Breath</h3>

      <p>Have you ever wondered about the quality of every breath you take?</p>
      <p>Air pollution is an invisible challenge — understanding it is the first step toward action.</p>
      <p>This handbook, "A Compass for Your Breath," is designed to guide you from knowledge to action.</p>

      <div className="download-button-wrapper">
        <a href={pdfPath} download className="download-button" aria-label="Download handbook PDF">
          Download the Handbook (PDF)
        </a>
      </div>

      <div className="handbook-gallery">
        {pageImages.map((src, index) => (
          <img
            key={start + index}
            src={src}
            alt={`Handbook Page ${start + index + 1}`}
            className="handbook-image"
          />
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 16 }}>
        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding: "8px 12px" }}>
          Prev
        </button>

        <div style={{ display: "flex", gap: 6 }}>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              aria-current={i === page ? "true" : undefined}
              style={{
                padding: "6px 10px",
                borderRadius: 4,
                background: i === page ? "#2c3e50" : "#eee",
                color: i === page ? "#fff" : "#333",
                border: "none",
                cursor: "pointer"
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>

        <button
          onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
          style={{ padding: "8px 12px" }}
        >
          Next
        </button>
      </div>
    </section>
  );
};
// ...existing code...
// --- Main App Component ---

function App() {
  return (
    <div className="App">
      <Header />
      <Hero />
      <PageLeft />

      <AboutUs />
      <AboutProject />
      <OurAnalysis />
      <GifGallery />
      <InteractiveSection />
      
      <section id="take-action" className="container">
        <h3>Take Action</h3>
        {/* Content for Take Action can be added here */}
      </section>

      <GameSection />
      <HandbookSection />

      <footer className="site-footer container">
        <p>&copy; {new Date().getFullYear()} AirGuardians</p>
      </footer>
    </div>
  );
}

export default App;