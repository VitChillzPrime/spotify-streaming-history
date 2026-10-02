import { openSpotifyUrl } from "@/lib/artwork";
import { createLimiter, createResourceCache } from "@/lib/resource-cache";
import { cacheGet, cachePut } from "@/lib/storage";

// Cover art comes from Spotify's public oEmbed endpoint: no login, no API key,
// and it allows cross-origin requests. The browser asks Spotify directly; the
// result is cached in IndexedDB so each cover is looked up once.

interface StoredCover {
  url: string | null;
  at: number;
}

/** Retry lookups that found no cover (removed or region-locked items) after a week. */
const MISSING_TTL = 7 * 24 * 60 * 60 * 1000;

const limit = createLimiter(4);

async function fetchCover(uri: string): Promise<{ url: string | null; keep: boolean }> {
  const page = openSpotifyUrl(uri);
  if (!page) return { url: null, keep: true };
  const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(page)}`);
  if (response.ok) {
    const body = (await response.json()) as { thumbnail_url?: unknown };
    return { url: typeof body.thumbnail_url === "string" ? body.thumbnail_url : null, keep: true };
  }
  // Missing items won't come back soon; rate limits and server errors are worth retrying next visit.
  return { url: null, keep: response.status >= 400 && response.status < 500 && response.status !== 429 };
}

export const coverCache = createResourceCache<string | null>(async (uri) => {
  const stored = await cacheGet<StoredCover>("artwork", uri).catch(() => undefined);
  if (stored && (stored.url !== null || Date.now() - stored.at < MISSING_TTL)) return stored.url;
  const { url, keep } = await limit(() => fetchCover(uri));
  if (keep) await cachePut("artwork", uri, { url, at: Date.now() } satisfies StoredCover).catch(() => undefined);
  return url;
}, null);
