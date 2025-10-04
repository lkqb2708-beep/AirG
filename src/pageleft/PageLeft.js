// ...existing code...
import React, { useEffect, useState } from "react";
import "./PageLeft.css";

export default function PageLeft() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Check if user scrolled past 600px
      if (window.scrollY > 600) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className={`pageleft-container ${scrolled ? 'scrolled' : ''}`} aria-hidden={false}>
      <nav className="pageleft-panel" aria-label="Page contents">
        <a className="pageleft-link" href="#about-us">About Us</a>

        <a className="pageleft-link" href="#about-project">About the Project</a>

        <div className="pageleft-group">
          <div className="pageleft-heading">Our Analysis</div>
          <a className="pageleft-sublink" href="#nasa">NASA satellite (TERRA)</a>
          <a className="pageleft-sublink" href="#ground-trend">Ground trend</a>
          <a className="pageleft-sublink" href="#case-study">Case Study: Transboundary pollution</a>
        </div>

        <a className="pageleft-link pageleft-top-gap" href="#interactive">Interactive Map & AI Forecast</a>

        <div className="pageleft-group">
          <div className="pageleft-heading">Take Action</div>
          <a className="pageleft-sublink" href="#game">Game "Sky Guardians"</a>
          <a className="pageleft-sublink" href="#handbook">Digital Health Handbook</a>
        </div>
      </nav>
    </div>
  );
}
// ...existing code...