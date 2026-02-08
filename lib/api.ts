// lib/api.ts
import type { Mode, RecommendationsResponse } from "@/types/api";

export async function fetchRecommendations(args: {
  lat: number;
  lon: number;
  radiusMiles: number;
  mode: Mode;
  departAtISO?: string;
}): Promise<RecommendationsResponse> {
  const url = new URL("/api/recommendations", window.location.origin);
  url.searchParams.set("lat", String(args.lat));
  url.searchParams.set("lon", String(args.lon));
  url.searchParams.set("radius_miles", String(args.radiusMiles));
  url.searchParams.set("mode", args.mode);

  if (args.mode === "later" && args.departAtISO) {
    url.searchParams.set("depart_at", args.departAtISO);
  }

  const resp = await fetch(url.toString());
  const json = (await resp.json()) as RecommendationsResponse;

  if (!resp.ok) {
    throw new Error(json.error || `Request failed with status ${resp.status}`);
  }
  if (json.error) throw new Error(json.error);

  return json;
}

