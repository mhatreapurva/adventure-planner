// app/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

import { LocationPanel } from "@/components/LocationPanel";
import { ModePanel } from "@/components/ModePanel";
import { Results } from "@/components/Results";

import { useGeolocation } from "@/hooks/useGeolocation";
import { useRecommendations } from "@/hooks/useRecommendations";
import type { Mode } from "@/types/api";

export default function Page() {
  const { coords, error: geoError, loading: geoLoading, refresh } = useGeolocation();
  const { data, error: apiError, loading, run } = useRecommendations();

  const [lat, setLat] = useState<string>("");
  const [lon, setLon] = useState<string>("");
  const [radiusMiles, setRadiusMiles] = useState<number>(30);
  const [mode, setMode] = useState<Mode>("now");

  // Default depart time: now (local). Only used when mode === "later"
  const [departAtLocal, setDepartAtLocal] = useState<string>(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    // datetime-local expects "YYYY-MM-DDTHH:mm"
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  // When geolocation updates, populate lat/lon (but don’t overwrite user input)
  useEffect(() => {
    if (!coords) return;

    setLat((prev) => (prev.trim() ? prev : String(coords.lat)));
    setLon((prev) => (prev.trim() ? prev : String(coords.lon)));
  }, [coords]);

  const hasCoords = useMemo(() => {
    return Number.isFinite(Number(lat)) && Number.isFinite(Number(lon));
  }, [lat, lon]);

  function onUseMyLocation() {
    // Trigger geolocation refresh; useEffect will populate when coords arrives
    refresh?.();
  }

  async function onFind() {
    if (!hasCoords) return;

    const departAtISO =
      mode === "later" && departAtLocal ? new Date(departAtLocal).toISOString() : undefined;

    await run({
      lat: Number(lat),
      lon: Number(lon),
      radiusMiles,
      mode,
      departAtISO,
    });
  }

  const error = apiError || geoError;

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Adventure Planner</h1>

      <section className={styles.panel}>
        {/* Top row: inputs left, action right */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <LocationPanel
              lat={lat}
              lon={lon}
              radiusMiles={radiusMiles}
              onLatChange={setLat}
              onLonChange={setLon}
              onRadiusChange={setRadiusMiles}
              onUseMyLocation={onUseMyLocation}
              loading={geoLoading}
            />
          </div>

          <div className={styles.toolbarRight}>
            <button
              type="button"
              className={styles.primary}
              onClick={onFind}
              disabled={loading || !hasCoords}
              title={!hasCoords ? "Enter valid latitude/longitude first" : ""}
            >
              {loading ? "Finding..." : "Find beaches"}
            </button>
          </div>
        </div>

        <ModePanel
          mode={mode}
          departAtLocal={departAtLocal}
          onModeChange={setMode}
          onDepartAtLocalChange={setDepartAtLocal}
          loading={loading}
        />

        {error && <div className={styles.error}>{error}</div>}
        {data?.message && <div className={styles.message}>{data.message}</div>}
      </section>

      {data && <Results data={data} />}
    </main>
  );
}
