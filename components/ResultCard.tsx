// components/ResultCard.tsx
"use client";

import React from "react";
import type { Recommendation } from "@/types/api";
import styles from "@/app/page.module.css";

export function ResultCard({ r }: { r: Recommendation }) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${r.lat},${r.lon}`
  )}`;

  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <div>
          <div className={styles.cardTitle}>{r.name}</div>
          <div className={styles.eta}>ETA: {r.eta_minutes} min</div>
        </div>

        <div className={styles.score}>{r.score}/100</div>
      </div>

      <div className={styles.chips}>
        {r.chips.map((c) => (
          <span key={c} className={styles.chip}>
            {c}
          </span>
        ))}
      </div>

      {/* Remove r.why to avoid repeating chips */}
      <div className={styles.cardActions}>
        <a href={mapsUrl} target="_blank" rel="noreferrer" className={styles.link}>
          Open in Google Maps
        </a>
      </div>
    </div>
  );
}

