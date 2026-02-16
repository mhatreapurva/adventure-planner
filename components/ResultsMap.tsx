"use client";

import "leaflet/dist/leaflet.css";

import React, { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap, Circle } from "react-leaflet";
import type { Recommendation } from "@/types/api";

type LatLon = { lat: number; lon: number };

type Props = {
  origin: LatLon;
  results: Recommendation[];
  radiusMiles?: number;
};

// Fix Leaflet default icon issue in Next.js (production-safe)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Forces Leaflet to recompute size after first paint (prevents appendChild/initContainer issues)
function InvalidateSizeOnce() {
  const map = useMap();

  useEffect(() => {
    const t = setTimeout(() => {
      map.invalidateSize();
    }, 50);

    return () => clearTimeout(t);
  }, [map]);

  return null;
}

const milesToMeters = (mi: number) => mi * 1609.344;

export function ResultsMap({ origin, results, radiusMiles }: Props) {
  // Render map ONLY after client mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const center = useMemo(() => {
    return [origin.lat, origin.lon] as [number, number];
  }, [origin.lat, origin.lon]);

  if (!mounted) return null;

  return (
    <div
      style={{
        height: 360,
        width: "100%",
        borderRadius: 16,
        overflow: "hidden",
        marginBottom: 14,
        border: "1px solid rgba(255,255,255,0.12)",
      }}
    >
      <MapContainer center={center} zoom={10} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <InvalidateSizeOnce />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Radius ring */}
        {typeof radiusMiles === "number" && radiusMiles > 0 ? (
        <Circle
        center={[origin.lat, origin.lon]}
        radius={milesToMeters(radiusMiles)}
        pathOptions={{ color: "#60a5fa", weight: 2, fillOpacity: 0.08 }}
      />
        ) : null}

        {/* Origin */}
        <Marker position={[origin.lat, origin.lon]}>
          <Popup>Start</Popup>
        </Marker>

        {/* Beaches */}
        {results.map((r, idx) => (
          <Marker key={`${r.name}-${idx}`} position={[r.lat, r.lon]}>
            <Popup>
              <strong>{r.name}</strong>
              <br />
              Score: {r.score}/100
              <br />
              ETA: {r.eta_minutes} min
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}