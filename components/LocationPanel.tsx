// components/LocationPanel.tsx
"use client";

import React from "react";
import styles from "@/app/page.module.css";

export function LocationPanel(props: {
  lat: string;
  lon: string;
  radiusMiles: number;
  onLatChange: (v: string) => void;
  onLonChange: (v: string) => void;
  onRadiusChange: (v: number) => void;

  onUseMyLocation: () => void;
  geoLoading?: boolean;

  // NEW: Address search
  address: string;
  onAddressChange: (v: string) => void;
  onUseAddress: () => void;
  geocodeLoading?: boolean;
}) {
  const disableMyLoc = Boolean(props.geoLoading);
  const addr = (props.address ?? "").trim();
  const disableAddress = Boolean(props.geocodeLoading) || addr.length === 0;

  return (
    <div className={styles.locationRow}>
      <button
        type="button"
        onClick={props.onUseMyLocation}
        className={styles.secondary}
        disabled={disableMyLoc}
        title={disableMyLoc ? "Getting location..." : "Use your current location"}
      >
        {disableMyLoc ? "Locating..." : "Use my location"}
      </button>

      <label className={styles.field}>
        <span className={styles.label}>Latitude</span>
        <input
          value={props.lat}
          onChange={(e) => props.onLatChange(e.target.value)}
          placeholder="e.g. 37.7749"
          className={styles.input}
          inputMode="decimal"
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Longitude</span>
        <input
          value={props.lon}
          onChange={(e) => props.onLonChange(e.target.value)}
          placeholder="e.g. -122.4194"
          className={styles.input}
          inputMode="decimal"
        />
      </label>

      <label className={styles.fieldSm}>
        <span className={styles.label}>Radius (miles)</span>
        <input
          type="number"
          value={props.radiusMiles}
          min={1}
          max={200}
          onChange={(e) => props.onRadiusChange(Number(e.target.value))}
          className={styles.input}
        />
      </label>

      {/* Address row */}
      <label className={styles.fieldGrow}>
        <span className={styles.label}>Address / City</span>
        <input
          value={props.address ?? ""}
          onChange={(e) => props.onAddressChange(e.target.value)}
          placeholder='e.g. "Mountain View, CA"'
          className={styles.input}
        />
      </label>

      <button
        type="button"
        onClick={props.onUseAddress}
        className={styles.secondary}
        disabled={disableAddress}
        title={addr.length === 0 ? "Enter an address/city first" : "Use this address to set lat/lon"}
      >
        {props.geocodeLoading ? "Searching..." : "Use address"}
      </button>
    </div>
  );
}
