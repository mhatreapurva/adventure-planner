// app/api/geocode/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Tiny in-memory cache (P0)
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    if (!q) {
      return NextResponse.json({ error: "Missing query param: q" }, { status: 400 });
    }

    const cacheKey = `geocode:${q.toLowerCase()}`;
    const cached = cacheGet<any>(cacheKey);
    if (cached) return NextResponse.json(cached);

    // Nominatim (OpenStreetMap) geocoding
    // Important: provide a User-Agent + accept-language helps.
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "1");

    const resp = await fetch(url.toString(), {
      headers: {
        "Accept": "application/json",
        // Put something stable here. If you prefer, use your domain once deployed.
        "User-Agent": "adventure-planner/0.1 (local dev)",
        "Accept-Language": "en",
      },
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return NextResponse.json(
        { error: `Geocode failed: HTTP ${resp.status}`, details: text.slice(0, 200) },
        { status: 502 }
      );
    }

    const results = (await resp.json()) as any[];
    const first = Array.isArray(results) ? results[0] : null;

    if (!first) {
      return NextResponse.json({ error: "No results found for that address/city." }, { status: 404 });
    }

    const payload = {
      lat: Number(first.lat),
      lon: Number(first.lon),
      display_name: String(first.display_name || q),
    };

    cacheSet(cacheKey, payload, 24 * 60 * 60 * 1000); // 1 day
    return NextResponse.json(payload);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}
