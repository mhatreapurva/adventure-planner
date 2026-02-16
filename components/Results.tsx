"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { RecommendationsResponse } from "@/types/api";
import { formatLocalTime } from "@/lib/time";
import { ResultCard } from "@/components/ResultCard";

// IMPORTANT: if ResultsMap is a NAMED export, select it via .then(...)
const ResultsMap = dynamic(
  () => import("@/components/ResultsMap").then((m) => m.ResultsMap),
  { ssr: false }
);

type LatLon = { lat: number; lon: number };

type Props = {
  data: RecommendationsResponse;
  origin?: LatLon | null;
};

export function Results({ data, origin = null }: Props) {
  if (data.results.length === 0) {
    return <div style={{ color: "#555" }}>No results returned.</div>;
  }

  return (
    <section>
      {origin ? <ResultsMap origin={origin} results={data.results} /> : null}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginTop: 16,
          marginBottom: 14,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>Top picks</h2>

        <div style={{ fontSize: 15, color: "#555" }}>
          Sunset (local display):{" "}
          <strong>{formatLocalTime(data.sunset_time_local)}</strong>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 12,
        }}
      >
        {data.results.map((r, idx) => (
          <ResultCard key={`${r.name}-${idx}`} r={r} />
        ))}
      </div>
    </section>
  );
}
