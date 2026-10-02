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
  /** Set when a network failure was recorded while other covers were loading fine. */
  confirmed?: boolean;
}

const DAY = 24 * 60 * 60 * 1000;
/** Removed or region-locked items: try again after a week. */
const MISSING_TTL = 7 * DAY;
/** Blocked responses (Spotify omits CORS headers on some errors): try again tomorrow. */
const FAILED_TTL = DAY;

const limit = createLimiter(4);

// Whether any cover has loaded this session. A network error only says something about
// one item if others are getting through; otherwise it's a blocker or a bad connection.
let reachable = false;

async function fetchCover(uri: string): Promise<{ url: string | null; ttl: number | null }> {
  const page = openSpotifyUrl(uri);
  if (!page) return { url: null, ttl: MISSING_TTL };
  let response: Response;
  try {
    response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(page)}`);
  } catch {
    // Spotify sends some error responses without CORS headers, which surface as network
    // errors. Remember those for a day, but only when other covers are loading: if nothing
    // gets through (offline, or a content blocker), try again next visit.
    return { url: null, ttl: reachable ? FAILED_TTL : null };
  }
  reachable = true;
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
  // Network failures saved by older versions (without `confirmed`) may have been a blocker: retry them.
  const usable = stored && (stored.ttl !== FAILED_TTL || stored.confirmed);
  if (stored && usable && (stored.url !== null || Date.now() - stored.at < (stored.ttl ?? MISSING_TTL))) {
    return stored.url;
  }
  const { url, ttl } = await limit(() => fetchCover(uri));
  if (ttl !== null) {
    const entry: StoredCover = { url, at: Date.now(), ttl, confirmed: ttl === FAILED_TTL || undefined };
    await cachePut("artwork", uri, entry).catch(() => undefined);
  }
  return url;
}, null);
