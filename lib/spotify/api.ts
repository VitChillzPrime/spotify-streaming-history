import { createLimiter } from "@/lib/resource-cache";
import { accessToken } from "@/lib/spotify/auth";

const API = "https://api.spotify.com/v1";

export class SpotifyApiError extends Error {
  name = "SpotifyApiError";
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

// Development Mode apps get a small rate limit, so requests go out two at a time.
const limit = createLimiter(2);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Calls the Web API as the signed-in user. Refreshes the token once on 401 and
 * waits out 429s using Spotify's Retry-After header. Retries stay inside the
 * same queue slot, so they can't deadlock the queue.
 */
export function spotifyFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return limit(async () => {
    for (let attempt = 0; ; attempt++) {
      const token = await accessToken();
      if (!token) throw new SpotifyApiError(401, "Connect Spotify in Settings first.");
      const response = await fetch(`${API}${path}`, {
        ...init,
        headers: {
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.status === 401 && attempt === 0) {
        await accessToken(true);
        continue;
      }
      if (response.status === 429 && attempt < 4) {
        const header = response.headers.get("Retry-After");
        const seconds = header !== null && Number.isFinite(Number(header)) ? Number(header) : 2 ** attempt;
        await sleep(Math.min(seconds, 30) * 1000);
        continue;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new SpotifyApiError(response.status, body?.error?.message ?? `Spotify returned ${response.status}.`);
      }
      return (response.status === 204 ? undefined : await response.json()) as T;
    }
  });
}

export interface SpotifyImage {
  url: string;
  width: number | null;
  height: number | null;
}

export interface SimpleArtist {
  id: string;
  name: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  images?: SpotifyImage[];
}

export interface Track {
  id: string;
  artists: SimpleArtist[];
  album: { artists: SimpleArtist[]; images: SpotifyImage[] };
}

export interface Artist {
  id: string;
  name: string;
  images: SpotifyImage[];
  /** Deprecated by Spotify and empty for many artists, but still returned. */
  genres?: string[];
}

export const getProfile = () => spotifyFetch<Profile>("/me");
export const getTrack = (id: string) => spotifyFetch<Track>(`/tracks/${encodeURIComponent(id)}`);
export const getArtist = (id: string) => spotifyFetch<Artist>(`/artists/${encodeURIComponent(id)}`);

/** The smallest image at least `min` pixels wide (images come largest first). */
export function pickImage(images: SpotifyImage[] | undefined, min = 160): string | null {
  if (!images?.length) return null;
  const fitting = images.filter((image) => (image.width ?? 0) >= min);
  return (fitting[fitting.length - 1] ?? images[0]).url;
}
