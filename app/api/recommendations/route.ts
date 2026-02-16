// app/api/recommendations/route.ts
import { NextResponse } from "next/server";

// ---------------------------
// Types
// ---------------------------
type Mode = "now" | "later";

type Recommendation = {
  name: string;
  lat: number;
  lon: number;
  score: number;
  eta_minutes: number;
  chips: string[];
  why: string;
  sunset_time_local: string; // ISO string in local timezone (Open-Meteo "timezone=auto" output)
};

type RecommendationsResponse = {
  mode: Mode;
  radius_miles: number;
  depart_at?: string;
  sunset_time_local: string;
  results: Recommendation[];
};

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type BeachCandidate = {
  name: string;
  lat: number;
  lon: number;
  tags: Record<string, string>;
};

type WxAtTime = {
  // “sky”
  cloudCoverPct: number;
  hazeRisk: boolean;

  // rain / precip
  precipMm: number;
  precipProb: number;
  weatherCode: number;

  // comfort
  tempF: number;
  windMph: number;

  // time (local)
  timeLocalISO: string;
};

// ---------------------------
// Tiny in-memory cache (best-effort)
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

const milesToMeters = (mi: number) => mi * 1609.344;

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
// Chips: remove empties + dedupe
// ---------------------------
function cleanChips(input: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const s = raw.trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }

  return out;
}

function buildWhy(chips: string[]) {
  if (!chips || chips.length === 0) return "No signals available.";
  return chips.slice(0, 3).join(" • ");
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

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
          body: new URLSearchParams({ data: query }).toString(),
        });

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          const is504 = resp.status === 504 || text.includes("HTTP 504");
          lastErr = new Error(`Overpass error ${resp.status}: ${text.slice(0, 200)}`);
          if (is504) {
            await sleep(400 + attempt * 400);
            continue;
          }
          throw lastErr;
        }

        const json = await resp.json();
        return json;
      } catch (e: any) {
        lastErr = e;
        await sleep(400 + attempt * 400);
      }
    }
  }

  throw lastErr ?? new Error("Overpass request failed");
}

// ---------------------------
// Coastline gate (prevents inland “fake beaches”)
// ---------------------------
// If the requested radius doesn't reach a coastline, we return 0 results.
// This avoids cases where OSM has "beach" tagged inland (lakes/parks/mis-tags).
async function hasCoastlineNearby(lat: number, lon: number, radiusMiles: number): Promise<boolean> {
  const rM = Math.max(1, Math.round(milesToMeters(radiusMiles)));
  const key = `coast:${round2(lat)}:${round2(lon)}:${Math.round(radiusMiles)}`;

  const cached = cacheGet<{ ok: boolean }>(key);
  if (cached) return cached.ok;

  const q = `
[out:json][timeout:25];
(
  way["natural"="coastline"](around:${rM},${lat},${lon});
  relation["natural"="coastline"](around:${rM},${lat},${lon});
);
out ids;
`.trim();

  try {
    const json = await postOverpass(q);
    const elements: OverpassElement[] = Array.isArray(json?.elements) ? json.elements : [];
    const ok = elements.length > 0;
    cacheSet(key, { ok }, 60 * 60 * 1000); // 1 hour
    return ok;
  } catch {
    // If Overpass is flaky, don't hard-block; fall back to normal behavior.
    // (We'll still filter aggressively by name + tags.)
    return true;
  }
}

// ---------------------------
// Overpass query / parsing
// ---------------------------
function buildBeachOverpassQuery(bbox: { south: number; west: number; north: number; east: number }) {
  return `
[out:json][timeout:25];
(
  node["natural"="beach"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["natural"="beach"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  relation["natural"="beach"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});

  node["tourism"="beach"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["tourism"="beach"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  relation["tourism"="beach"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});

  node["leisure"="beach_resort"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  way["leisure"="beach_resort"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
  relation["leisure"="beach_resort"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});
);
out center tags;
`.trim();
}

function elementToCandidate(el: OverpassElement): BeachCandidate | null {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") return null;

  // Require a real name. This eliminates most junk results immediately.
  const name = tags.name || tags["name:en"] || tags["alt_name"];
  if (!name || !String(name).trim()) return null;

  return { name: String(name).trim(), lat, lon, tags };
}

// Heuristic filter to kill obvious junk
function isPlausibleBeach(b: BeachCandidate): boolean {
  const t = b.tags || {};
  const natural = t.natural;
  const tourism = t.tourism;
  const leisure = t.leisure;

  const taggedAsBeach = natural === "beach" || tourism === "beach" || leisure === "beach_resort";
  if (!taggedAsBeach) return false;

  // Reject inland-ish mis-tags:
  const water = (t.water || "").toLowerCase();
  const waterway = (t.waterway || "").toLowerCase();
  const landuse = (t.landuse || "").toLowerCase();

  const inlandSignals = ["lake", "reservoir", "river", "canal", "pond", "basin"];
  const inlandHit =
    inlandSignals.includes(water) || inlandSignals.includes(waterway) || landuse === "reservoir";

  if (inlandHit && natural !== "beach") return false;

  return true;
}

// ---------------------------
// Open-Meteo helpers
// ---------------------------
function closestHourlyIndex(hourlyTimes: string[], targetISO: string) {
  const target = Date.parse(targetISO);
  if (!Number.isFinite(target)) return 0;

  let bestIdx = 0;
  let bestAbs = Infinity;

  for (let i = 0; i < hourlyTimes.length; i++) {
    const t = Date.parse(hourlyTimes[i]);
    if (!Number.isFinite(t)) continue;
    const abs = Math.abs(t - target);
    if (abs < bestAbs) {
      bestAbs = abs;
      bestIdx = i;
    }
  }

  return bestIdx;
}

async function fetchSunsetAndWx(
  lat: number,
  lon: number,
  opts?: { targetISO?: string; cacheTag?: string }
): Promise<{ sunsetLocalISO: string; wxAtTarget: WxAtTime; wxAtSunset: WxAtTime }> {
  const tag = opts?.cacheTag ?? (opts?.targetISO ? "target" : "sunset");
  const key = `wx:${round2(lat)}:${round2(lon)}:${tag}`;

  const cached = cacheGet<{ sunsetLocalISO: string; wxAtTarget: WxAtTime; wxAtSunset: WxAtTime }>(key);
  if (cached) return cached;

  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${encodeURIComponent(String(lat))}` +
    `&longitude=${encodeURIComponent(String(lon))}` +
    "&timezone=auto" +
    "&daily=sunset" +
    "&hourly=cloud_cover,precipitation_probability,precipitation,weathercode,temperature_2m,windspeed_10m";

  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Open-Meteo error ${resp.status}: ${text.slice(0, 180)}`);
  }

  const json = await resp.json();

  const sunsetArr: string[] = json?.daily?.sunset ?? [];
  const sunsetLocalISO = sunsetArr[0];
  if (!sunsetLocalISO) {
    throw new Error("Open-Meteo did not return sunset time.");
  }

  const hourlyTimes: string[] = json?.hourly?.time ?? [];
  const cloud: number[] = json?.hourly?.cloud_cover ?? [];
  const pp: number[] = json?.hourly?.precipitation_probability ?? [];
  const pr: number[] = json?.hourly?.precipitation ?? [];
  const wc: number[] = json?.hourly?.weathercode ?? [];
  const tempC: number[] = json?.hourly?.temperature_2m ?? [];
  const windKmh: number[] = json?.hourly?.windspeed_10m ?? [];

  function wxFromIdx(idx: number): WxAtTime {
    const cloudCoverPct = Number(cloud?.[idx] ?? 100);
    const precipProb = Number(pp?.[idx] ?? 0);
    const precipMm = Number(pr?.[idx] ?? 0);
    const weatherCode = Number(wc?.[idx] ?? 0);

    const tempF = Number.isFinite(tempC?.[idx]) ? (Number(tempC[idx]) * 9) / 5 + 32 : 60;
    const windMph = Number.isFinite(windKmh?.[idx]) ? Number(windKmh[idx]) * 0.621371 : 5;

    const hazeRisk = false;

    return {
      cloudCoverPct,
      hazeRisk,
      precipMm,
      precipProb,
      weatherCode,
      tempF,
      windMph,
      timeLocalISO: hourlyTimes[idx] ?? sunsetLocalISO,
    };
  }

  const sunsetIdx = closestHourlyIndex(hourlyTimes, sunsetLocalISO);
  const wxAtSunset = wxFromIdx(sunsetIdx);

  const targetISO = opts?.targetISO ?? sunsetLocalISO;
  const targetIdx = closestHourlyIndex(hourlyTimes, targetISO);
  const wxAtTarget = wxFromIdx(targetIdx);

  const out = { sunsetLocalISO, wxAtTarget, wxAtSunset };
  cacheSet(key, out, 10 * 60 * 1000);
  return out;
}

// ---------------------------
// Scoring
// ---------------------------
function skyScore(input: {
  cloudPct: number;
  hazeRisk: boolean;
  precipMm: number;
  precipProb: number;
  weatherCode: number;
}): { score: number; chip: string } {
  const cloudPct = Number.isFinite(input.cloudPct) ? input.cloudPct : 100;
  const precipMm = Number.isFinite(input.precipMm) ? input.precipMm : 0;
  const precipProb = Number.isFinite(input.precipProb) ? input.precipProb : 0;

  const rainingLikely = precipProb >= 50 || precipMm >= 1.0;

  let score = 0;
  let chip = "";

  if (rainingLikely) {
    score = 0;
    chip = precipProb >= 70 ? "Rain likely" : "Possible rain";
  } else {
    if (cloudPct <= 10) {
      score = 40;
      chip = "Clear skies";
    } else if (cloudPct <= 30) {
      score = 32;
      chip = "Mostly clear";
    } else if (cloudPct <= 60) {
      score = 20;
      chip = "Partly cloudy";
    } else if (cloudPct <= 85) {
      score = 8;
      chip = "Cloudy";
    } else {
      score = 0;
      chip = "Overcast risk";
    }
  }

  if (input.hazeRisk) {
    score = Math.max(0, score - 8);
    chip = "Haze risk";
  }

  if (!chip.trim()) chip = "Sky unknown";
  return { score, chip };
}

function feasibilityScore(
  sunsetLocalISO: string,
  departAtISO: string | undefined,
  etaMinutes: number
): { score: number; chip: string; bufferMin: number } {
  const depart = departAtISO ? Date.parse(departAtISO) : Date.now();
  const sunset = Date.parse(sunsetLocalISO);

  if (!Number.isFinite(sunset) || !Number.isFinite(depart)) {
    return { score: 0, chip: "Timing unknown", bufferMin: 0 };
  }

  const arrive = depart + etaMinutes * 60_000;
  const bufferMin = Math.floor((sunset - arrive) / 60_000);

  let score = 0;
  let chip = "";

  if (bufferMin >= 30) {
    score = 35;
    chip = `Arrive ${bufferMin} min early`;
  } else if (bufferMin >= 15) {
    score = 25;
    chip = `Arrive ${bufferMin} min early`;
  } else if (bufferMin >= 5) {
    score = 12;
    chip = `Tight timing (${bufferMin} min early)`;
  } else if (bufferMin >= 0) {
    score = 5;
    chip = `Very tight (${bufferMin} min early)`;
  } else {
    score = 0;
    chip = `Miss by ${Math.abs(bufferMin)} min`;
  }

  if (!chip.trim()) chip = "Timing unknown";
  return { score, chip, bufferMin };
}

function comfortScore(tempF: number, windMph: number): { score: number; chips: string[] } {
  let score = 15;
  const chips: string[] = [];

  if (tempF < 50) {
    score -= 6;
    chips.push("Cold");
  } else if (tempF < 58) {
    score -= 3;
    chips.push("Chilly");
  } else if (tempF <= 75) {
    chips.push("Comfortable temp");
  } else {
    score -= 3;
    chips.push("Warm");
  }

  if (windMph > 25) {
    score -= 10;
    chips.push("Very windy");
  } else if (windMph > 15) {
    score -= 5;
    chips.push("Windy");
  }

  score = Math.max(0, Math.min(15, score));
  return { score, chips };
}

function osmSignalScore(tags: Record<string, string>): number {
  let s = 0;
  if ((tags?.natural || "") === "beach") s += 6;
  if (tags?.name) s += 2;
  if ((tags?.access || "").toLowerCase() === "private") s -= 3;
  return Math.max(-5, Math.min(10, s));
}

function trafficChip(etaMinutes: number): string | null {
  if (!Number.isFinite(etaMinutes)) return null;
  if (etaMinutes <= 20) return null;
  if (etaMinutes <= 35) return "Moderate drive";
  return "Longer drive";
}

// ---------------------------
// Main route
// ---------------------------
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const lat = Number(body?.lat);
    const lon = Number(body?.lon);
    const radiusMiles = Number(body?.radiusMiles ?? 30);
    const mode: Mode = body?.mode === "later" ? "later" : "now";
    const departAtISO: string | undefined = body?.departAtISO ? String(body.departAtISO) : undefined;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return NextResponse.json({ error: "Invalid lat/lon" }, { status: 400 });
    }

    if (!Number.isFinite(radiusMiles) || radiusMiles <= 0 || radiusMiles > 200) {
      return NextResponse.json({ error: "Invalid radiusMiles" }, { status: 400 });
    }

    // 0) Coastline gate: if your radius doesn't reach a coastline, return no results.
    // This prevents cases like "Thane, Maharashtra + 30mi" returning weird inland OSM beach tags.
    const touchesCoast = await hasCoastlineNearby(lat, lon, radiusMiles);
    if (!touchesCoast) {
      // Still compute sunset so UI can show consistent sunset header.
      const useNow = mode === "now";
      const { sunsetLocalISO } = await fetchSunsetAndWx(lat, lon, {
        targetISO: useNow ? new Date().toISOString() : undefined,
        cacheTag: useNow ? "now" : "sunset",
      });

      const empty: RecommendationsResponse = {
        mode,
        radius_miles: radiusMiles,
        depart_at: departAtISO,
        sunset_time_local: sunsetLocalISO,
        results: [],
      };
      return NextResponse.json(empty);
    }

    // 1) Sunset + weather at user location (used for scoring)
    const useNow = mode === "now";
    const { sunsetLocalISO, wxAtTarget, wxAtSunset } = await fetchSunsetAndWx(lat, lon, {
      targetISO: useNow ? new Date().toISOString() : undefined,
      cacheTag: useNow ? "now" : "sunset",
    });

    // 2) Overpass beaches
    const bbox = bboxFromRadiusMiles(lat, lon, radiusMiles);
    const overpassQuery = buildBeachOverpassQuery(bbox);

    const overpassKey = `overpass:${round2(bbox.south)}:${round2(bbox.west)}:${round2(bbox.north)}:${round2(
      bbox.east
    )}`;
    let elements: OverpassElement[] | null = cacheGet(overpassKey);

    if (!elements) {
      const json = await postOverpass(overpassQuery);
      elements = Array.isArray(json?.elements) ? (json.elements as OverpassElement[]) : [];
      cacheSet(overpassKey, elements, 15 * 60 * 1000);
    }

    const candidates: BeachCandidate[] = [];
    for (const el of elements) {
      const c = elementToCandidate(el);
      if (!c) continue;
      if (!isPlausibleBeach(c)) continue;

      const d = haversineMiles(lat, lon, c.lat, c.lon);
      if (d > radiusMiles) continue;

      candidates.push(c);
    }

    if (candidates.length === 0) {
      const empty: RecommendationsResponse = {
        mode,
        radius_miles: radiusMiles,
        depart_at: departAtISO,
        sunset_time_local: sunsetLocalISO,
        results: [],
      };
      return NextResponse.json(empty);
    }

    // 3) Score
    const recs: Recommendation[] = [];

    for (const b of candidates) {
      const distMi = haversineMiles(lat, lon, b.lat, b.lon);
      const etaMinutes = Math.max(1, Math.round(distMi * 2));

      const trafficLabel = trafficChip(etaMinutes);
      const wx = useNow ? wxAtTarget : wxAtSunset;

      const sky = skyScore({
        cloudPct: wx.cloudCoverPct,
        hazeRisk: wx.hazeRisk,
        precipMm: wx.precipMm,
        precipProb: wx.precipProb,
        weatherCode: wx.weatherCode,
      });

      const feas = feasibilityScore(sunsetLocalISO, departAtISO, etaMinutes);
      const comfort = comfortScore(wx.tempF, wx.windMph);
      const osm = osmSignalScore(b.tags);

      const total = Math.round(sky.score + feas.score + comfort.score + osm);
      const chips = cleanChips([sky.chip, feas.chip, trafficLabel, ...comfort.chips]);

      recs.push({
        name: b.name,
        lat: b.lat,
        lon: b.lon,
        score: Math.max(0, Math.min(100, total)),
        eta_minutes: etaMinutes,
        chips,
        why: buildWhy(chips),
        sunset_time_local: sunsetLocalISO,
      });
    }

    recs.sort((a, b) => b.score - a.score);

    const payload: RecommendationsResponse = {
      mode,
      radius_miles: radiusMiles,
      depart_at: departAtISO,
      sunset_time_local: sunsetLocalISO,
      results: recs.slice(0, 10),
    };

    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}