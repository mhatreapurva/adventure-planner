export type Mode = "now" | "later";

export type Recommendation = {
  name: string;
  lat: number;
  lon: number;
  score: number;
  eta_minutes: number;
  chips: string[];
  why: string;
  sunset_time_local: string;
};

export type RecommendationsResponse = {
  mode: Mode;
  radius_miles: number;
  depart_at?: string;
  sunset_time_local: string;
  results: Recommendation[];
};
