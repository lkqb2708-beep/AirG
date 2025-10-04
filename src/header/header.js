import React from 'react';
import './header.css';

export default function Header() {
  return (
    <header className="site-header">
      <div className="container">
        <h1 className="brand">AIRG</h1>
        <nav className="nav">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#contact">Contact</a>
        </nav>
      </div>
    </header>
  );
}