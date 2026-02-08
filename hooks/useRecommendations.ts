// hooks/useRecommendations.ts
import { useState } from "react";
import type { RecommendationsResponse, Mode } from "@/types/api";
import { fetchRecommendations } from "@/lib/api";

export function useRecommendations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<RecommendationsResponse | null>(null);

  async function run(args: {
    lat: number;
    lon: number;
    radiusMiles: number;
    mode: Mode;
    departAtISO?: string;
  }) {
    setLoading(true);
    setError("");
    setData(null);

    try {
      const res = await fetchRecommendations(args);
      setData(res);
    } catch (e: any) {
      setError(e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return { run, loading, error, data, setData };
}
