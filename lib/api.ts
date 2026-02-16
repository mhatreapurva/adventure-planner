// lib/api.ts
import type { Mode, RecommendationsApiResponse, RecommendationsResponse } from "@/types/api";
import { isApiError } from "@/types/api";

export async function fetchRecommendations(args: {
  lat: number;
  lon: number;
  radiusMiles: number;
  mode: Mode;
  departAtISO?: string;
}): Promise<RecommendationsResponse> {
  const resp = await fetch("/api/recommendations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });

  const json: RecommendationsApiResponse = await resp.json().catch(() => ({
    error: "Failed to parse server response.",
  }));

  // Handle non-2xx
  if (!resp.ok) {
    if (isApiError(json)) throw new Error(json.error);
    throw new Error(`Request failed with status ${resp.status}`);
  }

  // Handle 2xx but error payload (defensive)
  if (isApiError(json)) throw new Error(json.error);

  return json;
}
