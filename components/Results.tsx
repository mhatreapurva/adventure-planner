// components/Results.tsx
"use client";

import React from "react";
import type { RecommendationsResponse } from "@/types/api";
import { formatLocalTime } from "@/lib/time";
import { ResultCard } from "@/components/ResultCard";
import styles from "@/app/page.module.css";

export function Results({ data }: { data: RecommendationsResponse }) {
  if (data.results.length === 0) {
    return <div className={styles.message}>{data.message || "No results returned."}</div>;
  }

  return (
    <section className={styles.resultsSection}>
      <div className={styles.resultsHeader}>
        <h2 className={styles.resultsTitle}>Top picks</h2>

        <div className={styles.sunsetMeta}>
          Sunset (local display): <strong>{formatLocalTime(data.sunset_time_local)}</strong>
        </div>
      </div>

      <div className={styles.cardsWrapper}>
        <div className={styles.cards}>
          {data.results.map((r, idx) => (
            <ResultCard key={`${r.name}-${idx}`} r={r} />
          ))}
        </div>
      </div>
    </section>
  );
}
