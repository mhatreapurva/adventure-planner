// components/ModePanel.tsx
"use client";

import React from "react";
import type { Mode } from "@/types/api";

export function ModePanel(props: {
  mode: Mode;
  departAtLocal: string;
  onModeChange: (m: Mode) => void;
  onDepartAtLocalChange: (v: string) => void;
  loading: boolean;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 10 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#cfcfcf" }}>Mode</span>

        <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <input
            type="radio"
            checked={props.mode === "now"}
            onChange={() => props.onModeChange("now")}
            disabled={props.loading}
          />
          <span style={{ color: "#eaeaea" }}>Now</span>
        </label>

        <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <input
            type="radio"
            checked={props.mode === "later"}
            onChange={() => props.onModeChange("later")}
            disabled={props.loading}
          />
          <span style={{ color: "#eaeaea" }}>Later today</span>
        </label>
      </div>

      {props.mode === "later" && (
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#cfcfcf" }}>Depart at</span>
          <input
            type="datetime-local"
            value={props.departAtLocal}
            onChange={(e) => props.onDepartAtLocalChange(e.target.value)}
            disabled={props.loading}
            style={{
              padding: 10,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.06)",
              color: "#eaeaea",
            }}
          />
        </label>
      )}
    </div>
  );
}
