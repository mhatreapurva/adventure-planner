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
  onFind: () => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginTop: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "#555" }}>Mode</span>
        <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <input type="radio" checked={props.mode === "now"} onChange={() => props.onModeChange("now")} />
          <span>Now</span>
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
          <input type="radio" checked={props.mode === "later"} onChange={() => props.onModeChange("later")} />
          <span>Later today</span>
        </label>
      </div>

      {props.mode === "later" && (
        <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, color: "#555" }}>Depart at</span>
          <input
            type="datetime-local"
            value={props.departAtLocal}
            onChange={(e) => props.onDepartAtLocalChange(e.target.value)}
            style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
          />
        </label>
      )}

      <button
        onClick={props.onFind}
        disabled={props.loading}
        style={{
          padding: "10px 14px",
          borderRadius: 10,
          border: "1px solid #333",
          background: props.loading ? "#eee" : "#111",
          color: props.loading ? "#444" : "white",
          cursor: props.loading ? "not-allowed" : "pointer",
          marginLeft: "auto",
        }}
        type="button"
      >
        {props.loading ? "Finding..." : "Find beaches"}
      </button>
    </div>
  );
}
