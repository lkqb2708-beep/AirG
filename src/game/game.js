import React from "react";

export default function ScratchEmbed({ projectId = "1225140410", width = 485, height = 402 }) {
  const src = `https://scratch.mit.edu/projects/${projectId}/embed`;
  return (
    <div style={{ maxWidth: "100%", overflow: "hidden" }}>
      <div style={{ position: "relative", width, height, margin: "0 auto" }}>
        <iframe
          title="Scratch SDG Game"
          src={src}
          allowTransparency="true"
          width={width}
          height={height}
          frameBorder="0"
          scrolling="no"
          allowFullScreen
          style={{ border: "1px solid #ccc", borderRadius: 8 }}
        />
      </div>
      <p style={{ textAlign: "center", fontSize: 12, marginTop: 8 }}>
        Powered by Scratch (MIT). Click inside to play.
      </p>
    </div>
  );
}