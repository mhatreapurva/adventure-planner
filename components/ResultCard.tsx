// components/ResultCard.tsx
"use client";

import React from "react";
import type { Recommendation } from "@/types/api";

export function ResultCard({ r }: { r: Recommendation }) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${r.lat},${r.lon}`)}`;

  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 700 }}>{r.name}</div>
        <div style={{ fontWeight: 700 }}>{r.score}/100</div>
      </div>

      <div style={{ marginTop: 6, fontSize: 13, color: "#555" }}>
        ETA: <strong>{r.eta_minutes} min</strong>
      </div>

      <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
        {r.chips.map((c) => (
          <span key={c} style={{ fontSize: 12, border: "1px solid #ccc", borderRadius: 999, padding: "4px 8px", background: "#fafafa" }}>
            {c}
          </span>
        ))}
      </div>

      <div style={{ marginTop: 10, fontSize: 13, color: "#333" }}>{r.why}</div>

      <div style={{ marginTop: 12 }}>
        <a href={mapsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 13 }}>
          Open in Google Maps
        </a>
      </div>
    </div>
  );
}
