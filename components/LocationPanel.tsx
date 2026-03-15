"use client";

import React from "react";
import { MapPin, Search, Loader2 } from "lucide-react";
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
  address: string;
  onAddressChange: (v: string) => void;
  onUseAddress: () => void;
  geocodeLoading?: boolean;
}) {
  const disableMyLoc = Boolean(props.geoLoading);
  const addr = (props.address ?? "").trim();
  const disableAddress = Boolean(props.geocodeLoading) || addr.length === 0;

  return (
    <div className={styles.locationGrid}>
      {/* Coordinates Group */}
      <div className={styles.coordGroup}>
        <div className={styles.inputWrapper}>
          <label className={styles.inputLabel}>Latitude</label>
          <div className={styles.relative}>
            <input
              value={props.lat}
              onChange={(e) => props.onLatChange(e.target.value)}
              placeholder="37.7749"
              className={styles.input}
              inputMode="decimal"
            />
            <button
              type="button"
              onClick={props.onUseMyLocation}
              className={styles.inputAction}
              disabled={disableMyLoc}
              title="Use my location"
            >
              {props.geoLoading ? (
                <Loader2 size={16} className={styles.spinner} />
              ) : (
                <MapPin size={16} />
              )}
            </button>
          </div>
        </div>

        <div className={styles.inputWrapper}>
          <label className={styles.inputLabel}>Longitude</label>
          <input
            value={props.lon}
            onChange={(e) => props.onLonChange(e.target.value)}
            placeholder="-122.4194"
            className={styles.input}
            inputMode="decimal"
          />
        </div>
      </div>

      {/* Address Group */}
      <div className={styles.inputWrapper}>
        <label className={styles.inputLabel}>Address / City</label>
        <div className={styles.relative}>
          <input
            value={props.address ?? ""}
            onChange={(e) => props.onAddressChange(e.target.value)}
            placeholder='e.g. "Mountain View, CA"'
            className={styles.input}
            onKeyDown={(e) => e.key === "Enter" && !disableAddress && props.onUseAddress()}
          />
          <button
            type="button"
            onClick={props.onUseAddress}
            className={styles.inputAction}
            disabled={disableAddress}
          >
            {props.geocodeLoading ? (
              <Loader2 size={16} className={styles.spinner} />
            ) : (
              <Search size={16} />
            )}
          </button>
        </div>
      </div>

      {/* Radius Group */}
      <div className={styles.inputWrapper} style={{ maxWidth: "120px" }}>
        <label className={styles.inputLabel}>Radius (mi)</label>
        <input
          type="number"
          value={props.radiusMiles}
          min={1}
          max={200}
          onChange={(e) => props.onRadiusChange(Number(e.target.value))}
          className={styles.input}
        />
      </div>
    </div>
  );
}