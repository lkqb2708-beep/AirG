import React from 'react';
import './header.css';

export default function Header() {
  return (
    <header className="site-header">
      <div className="header-inner container">
        <h1 className="brand">THE AIR GUARDIAN</h1>
        <nav className="nav">
          <a href="#about-us">About Us</a>
          <a href="#interactive">Map</a>
          <a href="#game">Game</a>
        </nav>
      </div>
    </header>
  );
}