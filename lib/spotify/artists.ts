import { normalizeText } from "@/lib/stats/history";
import { createResourceCache } from "@/lib/resource-cache";
import { getArtist, getTrack, pickImage } from "@/lib/spotify/api";
import { cacheGet, cachePut } from "@/lib/storage";

export interface ArtistInfo {
  id: string;
  name: string;
  image: string | null;
  genres: string[];
}

const TTL = 30 * 24 * 60 * 60 * 1000;

/** Reads through the IndexedDB cache, so each track and artist is fetched once a month at most. */
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const stored = await cacheGet<{ value: T; at: number }>("spotify", key).catch(() => undefined);
  if (stored && Date.now() - stored.at < TTL) return stored.value;
  const value = await load();
  await cachePut("spotify", key, { value, at: Date.now() }).catch(() => undefined);
  return value;
}

/**
 * Finds an artist on Spotify through one of their tracks (the export has no
 * artist IDs): the track's artists are matched by name, preferring the album artist.
 */
export async function lookupArtist(name: string, trackUri: string): Promise<ArtistInfo | null> {
  const trackId = /^spotify:track:([A-Za-z0-9]+)$/.exec(trackUri)?.[1];
  if (!trackId) return null;
  const candidates = await cached(`track-artists:${trackId}`, async () => {
    const track = await getTrack(trackId);
    return [...track.album.artists, ...track.artists].map(({ id, name }) => ({ id, name }));
  });
  const wanted = normalizeText(name.trim());
  const match = candidates.find((artist) => normalizeText(artist.name.trim()) === wanted) ?? candidates[0];
  if (!match) return null;
  return cached(`artist:${match.id}`, async () => {
    const artist = await getArtist(match.id);
    return { id: artist.id, name: artist.name, image: pickImage(artist.images), genres: artist.genres ?? [] };
  });
}

/** Artist details for React, keyed by `artistKey(name, trackUri)`. */
export const artistCache = createResourceCache<ArtistInfo | null>((key) => {
  const [name, uri] = key.split("\u0001");
  return lookupArtist(name, uri);
}, null);

export function artistKey(name: string, trackUri: string): string {
  return `${name}\u0001${trackUri}`;
}

export interface GenreShare {
  genre: string;
  /** Listening time of the artists tagged with this genre. */
  ms: number;
  artists: string[];
}

/**
 * Top genres from artists' listening time. An artist's time counts toward each
 * of its genres, so shares can add up to more than 100%.
 */
export function aggregateGenres(
  artists: { name: string; ms: number; genres: string[] }[],
  limit = 12,
): { genres: GenreShare[]; unclassified: number } {
  const byGenre = new Map<string, GenreShare>();
  let unclassified = 0;
  for (const artist of artists) {
    if (artist.genres.length === 0) {
      unclassified++;
      continue;
    }
    for (const genre of new Set(artist.genres.map((g) => g.trim().toLowerCase()).filter(Boolean))) {
      const share = byGenre.get(genre) ?? { genre, ms: 0, artists: [] };
      share.ms += artist.ms;
      share.artists.push(artist.name);
      byGenre.set(genre, share);
    }
  }
  const genres = [...byGenre.values()].sort((a, b) => b.ms - a.ms || b.artists.length - a.artists.length).slice(0, limit);
  return { genres, unclassified };
}
