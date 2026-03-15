"use client";

import React from "react";
import { MapPin, Navigation, Thermometer, Cloud, Sun, Wind, ExternalLink } from "lucide-react";
import type { Recommendation } from "@/types/api";
import styles from "@/app/page.module.css";

// Helper to map chips to icons
const getChipIcon = (chip: string) => {
  const c = chip.toLowerCase();
  if (c.includes("sunny")) return <Sun size={14} />;
  if (c.includes("cloudy")) return <Cloud size={14} />;
  if (c.includes("windy")) return <Wind size={14} />;
  if (c.includes("temp") || c.includes("comfortable")) return <Thermometer size={14} />;
  if (c.includes("drive")) return <Navigation size={14} />;
  return null;
};

export function ResultCard({ r }: { r: Recommendation }) {
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lon}`;

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.cardInfo}>
          <h3 className={styles.cardTitle}>{r.name}</h3>
          <div className={styles.etaBadge}>
            <Navigation size={12} className={styles.iconInline} />
            <span>{r.eta_minutes}m drive</span>
          </div>
        </div>
        
        <div className={styles.scoreBadge}>
          <span className={styles.scoreValue}>{r.score}</span>
          <span className={styles.scoreLabel}>Score</span>
        </div>
      </div>

      <div className={styles.chipsContainer}>
        {r.chips.map((c) => (
          <span key={c} className={styles.modernChip}>
            {getChipIcon(c)}
            {c}
          </span>
        ))}
      </div>

      <div className={styles.cardFooter}>
        <a href={mapsUrl} target="_blank" rel="noreferrer" className={styles.actionButton}>
          <span>Route</span>
          <ExternalLink size={14} />
        </a>
      </div>
    </div>
  );
}