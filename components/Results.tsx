// components/Results.tsx
"use client";

import React from "react";
import type { RecommendationsResponse } from "@/types/api";
import { formatLocalTime } from "@/lib/time";
import { ResultCard } from "@/components/ResultCard";

export function Results({ data }: { data: RecommendationsResponse }) {
  if (data.results.length === 0) {
    return <div style={{ color: "#555" }}>{data.message || "No results returned."}</div>;
  }

  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Top picks</h2>
        <div style={{ fontSize: 13, color: "#555" }}>
          Sunset (local display): <strong>{formatLocalTime(data.sunset_time_local)}</strong>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        {data.results.map((r, idx) => (
          <ResultCard key={`${r.name}-${idx}`} r={r} />
        ))}
      </div>
    </section>
  );
}
