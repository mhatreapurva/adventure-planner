// app/api/recommendations/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// ---------------------------
// Types
// ---------------------------
type Mode = "now" | "later";

type Beach = {
  osmType: "node" | "way" | "relation";
  osmId: number;
  name: string;
  lat: number;
  lon: number;
  tags: Record<string, string>;
};

type WeatherAtSunset = {
  cloudCoverPct: number; // 0..100
  tempF: number;
  windMph: number;
  hazeRisk: boolean;
};

type Recommendation = {
  name: string;
  lat: number;
  lon: number;
  score: number;
  eta_minutes: number;
  chips: string[];
  why: string;
  sunset_time_local: string;
};

// ---------------------------
// Tiny in-memory cache (P0)
// ---------------------------
const memCache = new Map<string, { value: any; expiresAt: number }>();

function cacheGet<T>(key: string): T | null {
  const hit = memCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return hit.value as T;
}

function cacheSet(key: string, value: any, ttlMs: number) {
  memCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function round2(x: number) {
  return Math.round(x * 100) / 100;
}

// ---------------------------
// Utils: bbox + distance + sleep
// ---------------------------
function bboxFromRadiusMiles(lat: number, lon: number, radiusMiles: number) {
  const dLat = radiusMiles / 69.0;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const dLon = radiusMiles / (69.0 * Math.max(cosLat, 0.01));

  return {
    south: lat - dLat,
    west: lon - dLon,
    north: lat + dLat,
    east: lon + dLon,
  };
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------
// Overpass: fallback endpoints + retry
// ---------------------------
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
];

async function postOverpass(query: string): Promise<any> {
  let lastErr: any = null;

  for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
    const url = OVERPASS_ENDPOINTS[i];

    // a couple retries per endpoint for 504s/timeouts
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
          body: new URLSearchParams({ data: query }).toString(),
        });

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          // retry common transient failures
          if (resp.status === 429 || resp.status === 502 || resp.status === 503 || resp.status === 504) {
            lastErr = new Error(`Overpass transient error: HTTP ${resp.status} (${url}). ${text.slice(0, 120)}`);
            await sleep(350 * (attempt + 1));
            continue;
          }
          throw new Error(`Overpass error: HTTP ${resp.status} (${url}). ${text.slice(0, 200)}`);
        }

        return await resp.json();
      } catch (e: any) {
        lastErr = e;
        await sleep(250 * (attempt + 1));
      }
    }
  }

  throw lastErr ?? new Error("Overpass error: all endpoints failed");
}

// ---------------------------
// 1) Beaches via Overpass
// - stricter filters
// - drop obvious non-beaches
// - avoid unnamed
// - water-proximity validation
// ---------------------------
function isObviouslyNotABeach(tags: Record<string, string>): boolean {
  const leisure = (tags["leisure"] || "").toLowerCase();
  const sport = (tags["sport"] || "").toLowerCase();
  const natural = (tags["natural"] || "").toLowerCase();
  const place = (tags["place"] || "").toLowerCase();
  const manMade = (tags["man_made"] || "").toLowerCase();
  const amenity = (tags["amenity"] || "").toLowerCase();

  // common false positives
  if (sport.includes("volleyball") || sport.includes("beachvolleyball")) return true;
  if (leisure === "pitch" || leisure === "sports_centre" || leisure === "stadium") return true;

  // stuff that shouldn't be “beach”
  if (amenity) return true;
  if (manMade) return true;

  // allow the real beach tags
  if (natural === "beach") return false;
  if (place === "beach") {
    // "place=beach" can be junk; if it also has "natural=beach" it's fine
    return natural !== "beach";
  }

  return true;
}

function bestName(tags: Record<string, string>) {
  const n =
    tags["name"]?.trim() ||
    tags["name:en"]?.trim() ||
    tags["official_name"]?.trim() ||
    tags["alt_name"]?.trim() ||
    tags["loc_name"]?.trim() ||
    "";
  return n;
}

async function fetchBeachesOverpass(lat: number, lon: number, radiusMiles: number): Promise<Beach[]> {
  const cellKey = `beaches:v2:${round2(lat)}:${round2(lon)}:${radiusMiles}`;
  const cached = cacheGet<Beach[]>(cellKey);
  if (cached) return cached;

  const { south, west, north, east } = bboxFromRadiusMiles(lat, lon, radiusMiles);

  // NOTE: We request tags + center. We also filter out some things directly in query.
  const query = `
[out:json][timeout:25];
(
  nwr["natural"="beach"](${south},${west},${north},${east});
  nwr["place"="beach"](${south},${west},${north},${east});
);
out center tags;
`.trim();

  const data = await postOverpass(query);
  const elements: any[] = Array.isArray(data?.elements) ? data.elements : [];

  const normalized: Beach[] = [];

  for (const el of elements) {
    const osmType = el.type as "node" | "way" | "relation";
    const osmId = Number(el.id);
    const tags: Record<string, string> = el.tags ?? {};

    // access filtering
    const access = (tags["access"] || "").toLowerCase();
    if (access === "no" || access === "private") continue;

    // drop obvious non-beaches
    if (isObviouslyNotABeach(tags)) continue;

    // get location
    let bLat: number | null = null;
    let bLon: number | null = null;

    if (osmType === "node" && typeof el.lat === "number" && typeof el.lon === "number") {
      bLat = el.lat;
      bLon = el.lon;
    } else if (el.center && typeof el.center.lat === "number" && typeof el.center.lon === "number") {
      bLat = el.center.lat;
      bLon = el.center.lon;
    }
    if (bLat == null || bLon == null) continue;

    // prefer real names; if missing, skip (prevents "Unnamed beach" spam)
    const name = bestName(tags);
    if (!name) continue;

    normalized.push({ osmType, osmId, name, lat: bLat, lon: bLon, tags });
  }

  // Basic de-dupe: same name + within 0.3 miles
  const deduped: Beach[] = [];
  for (const b of normalized) {
    const keyName = b.name.toLowerCase();
    const close = deduped.find(
      (x) => x.name.toLowerCase() === keyName && haversineMiles(x.lat, x.lon, b.lat, b.lon) < 0.3
    );
    if (!close) deduped.push(b);
  }

  // WATER PROXIMITY CHECK:
  // Keep only beaches near water/coastline.
  // This kills “Fremont beaches” and other inland nonsense.
  const validated = await filterByWaterProximity(deduped);

  cacheSet(cellKey, validated, 7 * 24 * 60 * 60 * 1000);
  return validated;
}

async function filterByWaterProximity(beaches: Beach[]): Promise<Beach[]> {
  if (beaches.length === 0) return beaches;

  // Cap to avoid huge queries
  const cap = beaches.slice(0, 80);

  // Coastline-only query (ocean/littoral edges). No rivers, no lakes.
  const blocks = cap
    .map((b) => {
      return `
(
  nwr(around:6000,${b.lat},${b.lon})["natural"="coastline"];
);
out center;`;
    })
    .join("\n");

  const q = `
[out:json][timeout:25];
${blocks}
`.trim();

  let data: any;
  try {
    data = await postOverpass(q);
  } catch {
    // If Overpass is flaky, don't kill the request. Return unfiltered.
    return beaches;
  }

  const elements: any[] = Array.isArray(data?.elements) ? data.elements : [];

  // Extract coastline points we can measure against
  const coastPoints: Array<{ lat: number; lon: number }> = [];
  for (const el of elements) {
    const tags: Record<string, string> = el.tags ?? {};
    if (tags["natural"] !== "coastline") continue;

    if (typeof el.lat === "number" && typeof el.lon === "number") {
      coastPoints.push({ lat: el.lat, lon: el.lon });
    } else if (el.center && typeof el.center.lat === "number" && typeof el.center.lon === "number") {
      coastPoints.push({ lat: el.center.lat, lon: el.center.lon });
    }
  }

  if (coastPoints.length === 0) {
    // If we couldn't fetch coastline points, don't filter.
    return beaches;
  }

  // Keep only beaches within X miles of coastline.
  // 3.0 miles works well to remove Fremont/Niles-style “beaches”.
  const MAX_COAST_MILES = 3.0;

  return beaches.filter((b) => {
    let best = Infinity;
    for (const p of coastPoints) {
      const d = haversineMiles(b.lat, b.lon, p.lat, p.lon);
      if (d < best) best = d;
    }
    return best <= MAX_COAST_MILES;
  });
}

// ---------------------------
// 2) Sunset time
// ---------------------------
async function getSunsetTimeISO(lat: number, lon: number, dateISO: string): Promise<string> {
  const cacheKey = `sunset:${round2(lat)}:${round2(lon)}:${dateISO}`;
  const cached = cacheGet<string>(cacheKey);
  if (cached) return cached;

  const url = new URL("https://api.sunrise-sunset.org/json");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lng", String(lon));
  url.searchParams.set("date", dateISO);
  url.searchParams.set("formatted", "0");

  const resp = await fetch(url.toString());
  if (!resp.ok) throw new Error(`Sunset API error: HTTP ${resp.status}`);

  const j = await resp.json();
  const sunsetUtc = j?.results?.sunset;
  if (typeof sunsetUtc !== "string") throw new Error("Sunset API: missing sunset");

  cacheSet(cacheKey, sunsetUtc, 24 * 60 * 60 * 1000);
  return sunsetUtc;
}

// ---------------------------
// 3) Weather + Routing providers (stubs)
// ---------------------------
async function getWeatherAtSunset(_lat: number, _lon: number, _sunsetUtcISO: string): Promise<WeatherAtSunset> {
  return {
    cloudCoverPct: 20,
    tempF: 62,
    windMph: 10,
    hazeRisk: false,
  };
}

async function getEtaMinutes(
  _fromLat: number,
  _fromLon: number,
  _toLat: number,
  _toLon: number,
  _departAtISO: string
): Promise<{ etaMinutes: number; trafficLabel: "Low traffic" | "Heavy traffic" | null }> {
  const dist = haversineMiles(_fromLat, _fromLon, _toLat, _toLon);
  const eta = Math.max(5, Math.round((dist / 35) * 60));
  const trafficLabel = eta > 45 ? "Heavy traffic" : null;
  return { etaMinutes: eta, trafficLabel };
}

// ---------------------------
// 4) Scoring + chips
// ---------------------------
function skyScore(cloudPct: number, hazeRisk: boolean): { score: number; chip: string } {
  let score = 0;
  let chip = "Overcast risk";

  if (cloudPct <= 10) { score = 40; chip = "Clear skies"; }
  else if (cloudPct <= 30) { score = 32; chip = "Mostly clear"; }
  else if (cloudPct <= 60) { score = 20; chip = "Partly cloudy"; }
  else if (cloudPct <= 85) { score = 8; chip = "Cloudy"; }
  else { score = 0; chip = "Overcast risk"; }

  if (hazeRisk) score = Math.max(0, score - 8);

  return { score, chip: hazeRisk ? "Haze risk" : chip };
}

function feasibilityScore(
  sunsetUtcISO: string,
  departAtISO: string,
  etaMinutes: number
): { score: number; chip: string; bufferMin: number } {
  const tSunset = new Date(sunsetUtcISO).getTime();
  const tDepart = new Date(departAtISO).getTime();
  const tArrive = tDepart + etaMinutes * 60 * 1000;

  const bufferMin = Math.round((tSunset - tArrive) / (60 * 1000));

  let score = 0;
  let chip = "You’ll miss sunset";

  if (bufferMin >= 30) { score = 35; chip = `Arrive ${bufferMin} min early`; }
  else if (bufferMin >= 15) { score = 25; chip = `Arrive ${bufferMin} min early`; }
  else if (bufferMin >= 5) { score = 12; chip = `Tight timing (${bufferMin} min early)`; }
  else if (bufferMin >= 0) { score = 5; chip = `Very tight (${bufferMin} min early)`; }
  else { score = 0; chip = `Miss by ${Math.abs(bufferMin)} min`; }

  return { score, chip, bufferMin };
}

function comfortScore(tempF: number, windMph: number): { score: number; chips: string[] } {
  let score = 15;
  const chips: string[] = [];

  if (tempF < 50) { score -= 6; chips.push("Cold"); }
  else if (tempF < 58) { score -= 3; chips.push("Chilly"); }
  else if (tempF <= 75) { chips.push("Comfortable temp"); }
  else { score -= 3; chips.push("Warm"); }

  if (windMph > 25) { score -= 10; chips.push("Very windy"); }
  else if (windMph > 15) { score -= 5; chips.push("Windy"); }

  score = Math.max(0, Math.min(15, score));
  return { score, chips };
}

function osmSignalScore(tags: Record<string, string>): number {
  if (tags["natural"] === "beach") return 10;
  if (tags["place"] === "beach") return 6;
  return 0;
}

function buildWhy(chips: string[]): string {
  const top = chips.slice(0, 3);
  return top.length ? `${top.join(", ")}.` : "Best option nearby based on current conditions.";
}

// ---------------------------
// Route handler
// ---------------------------
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const lat = Number(searchParams.get("lat"));
    const lon = Number(searchParams.get("lon"));
    const radiusMiles = Number(searchParams.get("radius_miles") ?? "30");
    const mode = (searchParams.get("mode") ?? "now") as Mode;
    const departAt = searchParams.get("depart_at");

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ error: "Missing/invalid lat/lon" }, { status: 400 });
    }
    if (!Number.isFinite(radiusMiles) || radiusMiles <= 0 || radiusMiles > 200) {
      return NextResponse.json({ error: "Invalid radius_miles (1..200)" }, { status: 400 });
    }
    if (mode !== "now" && mode !== "later") {
      return NextResponse.json({ error: "Invalid mode (now|later)" }, { status: 400 });
    }

    const now = new Date();
    const dateISO = now.toISOString().slice(0, 10);
    const departAtISO = mode === "later" && departAt ? new Date(departAt).toISOString() : now.toISOString();

    // 1) Beaches
    const beaches = await fetchBeachesOverpass(lat, lon, radiusMiles);

    if (beaches.length === 0) {
      return NextResponse.json({
        mode,
        radius_miles: radiusMiles,
        results: [],
        message: "No beaches found in this radius. Try increasing radius_miles.",
      });
    }

    // 2) Sunset
    const sunsetUtcISO = await getSunsetTimeISO(lat, lon, dateISO);

    // 3) Score beaches
    const maxCandidates = Math.min(beaches.length, 40);
    const candidates = beaches
      .map((b) => ({ b, dist: haversineMiles(lat, lon, b.lat, b.lon) }))
      .sort((a, c) => a.dist - c.dist)
      .slice(0, maxCandidates);

    const recs: Recommendation[] = [];
    for (const { b } of candidates) {
      const { etaMinutes, trafficLabel } = await getEtaMinutes(lat, lon, b.lat, b.lon, departAtISO);
      const wx = await getWeatherAtSunset(b.lat, b.lon, sunsetUtcISO);

      const sky = skyScore(wx.cloudCoverPct, wx.hazeRisk);
      const feas = feasibilityScore(sunsetUtcISO, departAtISO, etaMinutes);
      const comfort = comfortScore(wx.tempF, wx.windMph);
      const osm = osmSignalScore(b.tags);

      const total = Math.round(sky.score + feas.score + comfort.score + osm);

      const chips: string[] = [];
      chips.push(sky.chip);
      chips.push(feas.chip);
      if (trafficLabel) chips.push(trafficLabel);
      chips.push(...comfort.chips);

      recs.push({
        name: b.name,
        lat: b.lat,
        lon: b.lon,
        score: Math.max(0, Math.min(100, total)),
        eta_minutes: etaMinutes,
        chips,
        why: buildWhy(chips),
        sunset_time_local: sunsetUtcISO,
      });
    }

    recs.sort((a, b) => b.score - a.score);
    const top10 = recs.slice(0,10)

    return NextResponse.json({
      mode,
      radius_miles: radiusMiles,
      depart_at: departAtISO,
      sunset_time_local: sunsetUtcISO,
      results: top10,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
