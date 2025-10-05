import React, { useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "./PDFFlipViewer.css";

// use the CDN worker bundled with pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL || ""}/pdf.worker.min.js`;

export default function PDFFlipViewer({ fileUrl, initialScale = 1.1 }) {
  const [numPages, setNumPages] = useState(null);
  const [page, setPage] = useState(1);
  const [flipping, setFlipping] = useState(false);
  const [scale] = useState(initialScale);

  function onDocumentLoadSuccess({ numPages: n }) {
    setNumPages(n);
    setPage(1);
  }

  const goTo = (newPage) => {
    if (newPage < 1 || (numPages && newPage > numPages)) return;
    // quick flip animation
    setFlipping(true);
    setTimeout(() => {
      setPage(newPage);
      setFlipping(false);
    }, 300);
  };

  return (
    <div className="pdf-flip-root">
      <div className="pdf-controls">
        <button onClick={() => goTo(page - 1)} disabled={page <= 1}>
          ◀ Prev
        </button>
        <div className="pdf-page-indicator">
          Page {page}{numPages ? ` / ${numPages}` : ""}
        </div>
        <button onClick={() => goTo(page + 1)} disabled={numPages && page >= numPages}>
          Next ▶
        </button>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => window.open(fileUrl, "_blank", "noopener noreferrer")}
        >
          Download / Open
        </button>
      </div>

      <div className={`pdf-page-wrap ${flipping ? "flipping" : ""}`}>
        <Document file={fileUrl} onLoadSuccess={onDocumentLoadSuccess} loading="Loading...">
          <Page
            pageNumber={page}
            scale={scale}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading=""
          />
        </Document>
      </div>
    </div>
  );
}