import { openSpotifyUrl } from "@/lib/artwork";
import { createLimiter, createResourceCache } from "@/lib/resource-cache";
import { cacheGet, cachePut } from "@/lib/storage";

// Cover art comes from Spotify's public oEmbed endpoint: no login, no API key,
// and it allows cross-origin requests. The browser asks Spotify directly; the
// result is cached in IndexedDB so each cover is looked up once.

interface StoredCover {
  url: string | null;
  at: number;
  /** How long a missing cover is remembered before trying again. */
  ttl?: number;
}

const DAY = 24 * 60 * 60 * 1000;
/** Removed or region-locked items: try again after a week. */
const MISSING_TTL = 7 * DAY;
/** Blocked responses (Spotify omits CORS headers on some errors): try again tomorrow. */
const FAILED_TTL = DAY;

const limit = createLimiter(4);

async function fetchCover(uri: string): Promise<{ url: string | null; ttl: number | null }> {
  const page = openSpotifyUrl(uri);
  if (!page) return { url: null, ttl: MISSING_TTL };
  let response: Response;
  try {
    response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(page)}`);
  } catch {
    // Spotify sends some error responses without CORS headers, which surface as network
    // errors. Remember those for a day; genuine offline errors are retried next visit.
    return { url: null, ttl: navigator.onLine === false ? null : FAILED_TTL };
  }
  if (response.ok) {
    const body = (await response.json()) as { thumbnail_url?: unknown };
    return { url: typeof body.thumbnail_url === "string" ? body.thumbnail_url : null, ttl: MISSING_TTL };
  }
  // Missing items won't come back soon; rate limits and server errors are worth retrying next visit.
  const missing = response.status >= 400 && response.status < 500 && response.status !== 429;
  return { url: null, ttl: missing ? MISSING_TTL : null };
}

export const coverCache = createResourceCache<string | null>(async (uri) => {
  const stored = await cacheGet<StoredCover>("artwork", uri).catch(() => undefined);
  if (stored && (stored.url !== null || Date.now() - stored.at < (stored.ttl ?? MISSING_TTL))) return stored.url;
  const { url, ttl } = await limit(() => fetchCover(uri));
  if (ttl !== null) {
    await cachePut("artwork", uri, { url, at: Date.now(), ttl } satisfies StoredCover).catch(() => undefined);
  }
  return url;
}, null);
