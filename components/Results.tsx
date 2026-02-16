// components/Results.tsx
"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { RecommendationsResponse } from "@/types/api";
import { formatLocalTime } from "@/lib/time";
import { ResultCard } from "@/components/ResultCard";

const ResultsMap = dynamic(() => import("./ResultsMap").then((m) => m.ResultsMap), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 320,
        borderRadius: 16,
        border: "1px solid rgba(255,255,255,0.14)",
        background: "rgba(255,255,255,0.06)",
      }}
    />
  ),
});

export function Results({ data }: { data: RecommendationsResponse }) {
  if (data.results.length === 0) {
    return <div style={{ color: "rgba(255,255,255,0.75)" }}>{data.message || "No results returned."}</div>;
  }

  return (
    <section style={{ marginTop: 22 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 14,
          marginBottom: 14,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 20, letterSpacing: "-0.01em" }}>Top picks</h2>

        <div style={{ fontSize: 15, color: "rgba(255,255,255,0.80)" }}>
          Sunset (local display):{" "}
          <strong style={{ color: "rgba(255,255,255,0.95)" }}>{formatLocalTime(data.sunset_time_local)}</strong>
        </div>
      </div>

      {/* Map */}
      <div style={{ marginBottom: 16 }}>
        <ResultsMap results={data.results} />
      </div>

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
        {data.results.map((r, idx) => (
          <ResultCard key={`${r.name}-${idx}`} r={r} />
        ))}
      </div>
    </section>
  );
}
