// app/api.ts
import type {
  Mode,
  RecommendationsApiResponse,
  RecommendationsResponse,
} from "@/types/api";
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

  let json: RecommendationsApiResponse;
  try {
    json = (await resp.json()) as RecommendationsApiResponse;
  } catch {
    throw new Error(`Request failed with status ${resp.status}`);
  }

  if (!resp.ok) {
    if (isApiError(json)) throw new Error(json.error);
    throw new Error(`Request failed with status ${resp.status}`);
  }

  if (isApiError(json)) throw new Error(json.error);
  return json;
}
