// app/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import type { Mode } from "@/types/api";
import { toDatetimeLocalValue } from "@/lib/time";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useRecommendations } from "@/hooks/useRecommendations";
import { LocationPanel } from "@/components/LocationPanel";
import { ModePanel } from "@/components/ModePanel";
import { Results } from "@/components/Results";
import styles from "./page.module.css";

export default function Page() {
  const [lat, setLat] = useState<string>("");
  const [lon, setLon] = useState<string>("");
  const [radiusMiles, setRadiusMiles] = useState<number>(30);
  const [mode, setMode] = useState<Mode>("now");

  const [departAtLocal, setDepartAtLocal] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 30);
    return toDatetimeLocalValue(d);
  });

  const { getLocation, error: geoError } = useGeolocation();
  const { run, loading, error: apiError, data } = useRecommendations();

  const hasCoords = useMemo(() => {
    const la = Number(lat);
    const lo = Number(lon);
    return Number.isFinite(la) && Number.isFinite(lo);
  }, [lat, lon]);

  async function onUseMyLocation() {
    const loc = await getLocation();
    if (loc) {
      setLat(String(loc.lat));
      setLon(String(loc.lon));
    }
  }

  async function onFind() {
    if (!hasCoords) return;

    const departAtISO = mode === "later" ? new Date(departAtLocal).toISOString() : undefined;

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
      <p className={styles.subtitle}>P0: Find the best nearby beaches for a sunset (top 3).</p>


      <section className={styles.panel}>
        <LocationPanel
          lat={lat}
          lon={lon}
          radiusMiles={radiusMiles}
          onLatChange={setLat}
          onLonChange={setLon}
          onRadiusChange={setRadiusMiles}
          onUseMyLocation={onUseMyLocation}
        />

        <ModePanel
          mode={mode}
          departAtLocal={departAtLocal}
          onModeChange={setMode}
          onDepartAtLocalChange={setDepartAtLocal}
          loading={loading}
          onFind={onFind}
        />

        {error && <div className={styles.error}>{error}</div>}
        {data?.message && <div className={styles.message}>{data.message}</div>}
      </section>

      {data && <Results data={data} />}
    </main>
  );
}
