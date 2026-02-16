// components/ResultsMap.tsx
"use client";

import React, { useEffect, useMemo } from "react";
import type { Recommendation } from "@/types/api";

import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";

type Props = {
  results: Recommendation[];
};

export function ResultsMap({ results }: Props) {
  // Fix default marker icons (Next bundlers often break the default icon paths)
  useEffect(() => {
    // @ts-expect-error leaflet internal
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  const center = useMemo(() => {
    if (results.length === 0) return { lat: 37.7749, lon: -122.4194 };
    // center around best result
    return { lat: results[0].lat, lon: results[0].lon };
  }, [results]);

  return (
    <div
      style={{
        height: 320,
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
      }}
    >
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={10}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {results.map((r, idx) => (
          <Marker key={`${r.name}-${idx}`} position={[r.lat, r.lon]}>
            <Popup>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{r.name}</div>
              <div style={{ fontSize: 13 }}>Score: {r.score}/100</div>
              <div style={{ fontSize: 13 }}>ETA: {r.eta_minutes} min</div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
