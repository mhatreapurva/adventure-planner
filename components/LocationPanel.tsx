// components/LocationPanel.tsx
"use client";

import React from "react";

export function LocationPanel(props: {
  lat: string;
  lon: string;
  radiusMiles: number;
  onLatChange: (v: string) => void;
  onLonChange: (v: string) => void;
  onRadiusChange: (v: number) => void;
  onUseMyLocation: () => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
      <button
        onClick={props.onUseMyLocation}
        style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc", background: "white", cursor: "pointer" }}
        type="button"
      >
        Use my location
      </button>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 12, color: "#555" }}>Latitude</span>
        <input
          value={props.lat}
          onChange={(e) => props.onLatChange(e.target.value)}
          placeholder="e.g. 37.7749"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", width: 180 }}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 12, color: "#555" }}>Longitude</span>
        <input
          value={props.lon}
          onChange={(e) => props.onLonChange(e.target.value)}
          placeholder="e.g. -122.4194"
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", width: 180 }}
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 12, color: "#555" }}>Radius (miles)</span>
        <input
          type="number"
          value={props.radiusMiles}
          min={1}
          max={200}
          onChange={(e) => props.onRadiusChange(Number(e.target.value))}
          style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", width: 140 }}
        />
      </label>
    </div>
  );
}
