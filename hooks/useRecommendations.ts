// hooks/useRecommendations.ts
"use client";

import { useCallback, useState } from "react";
import type { RecommendationsResponse, Mode } from "@/types/api";

type RunArgs = {
  lat: number;
  lon: number;
  radiusMiles: number;
  mode: Mode;
  departAtISO?: string;
};

function safeTruncate(s: string, n = 400) {
  const t = (s ?? "").trim();
  if (t.length <= n) return t;
  return t.slice(0, n) + "…";
}

export function useRecommendations() {
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const run = useCallback(async (args: RunArgs) => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });

      // IMPORTANT: do not call res.json() directly
      const text = await res.text();

      let json: any = null;
      if (text && text.trim().length > 0) {
        try {
          json = JSON.parse(text);
        } catch {
          // Not JSON (or truncated). Show something actionable.
          throw new Error(
            `API returned non-JSON (${res.status}). ${safeTruncate(text)}`
          );
        }
      }

      if (!res.ok) {
        // If API used NextResponse.json({error: ...}), this catches it.
        const msg =
          json?.error ||
          json?.message ||
          `Request failed (${res.status})`;
        throw new Error(msg);
      }

      if (!json) {
        throw new Error(`Empty response body (${res.status}).`);
      }

      setData(json as RecommendationsResponse);
    } catch (e: any) {
      setError(e?.message ?? "Failed to fetch recommendations.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, error, loading, run };
}
