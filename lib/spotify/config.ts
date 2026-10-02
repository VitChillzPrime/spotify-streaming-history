import { createLocalStore } from "@/lib/local-store";

/** Only what the features need: creating private playlists. Reading catalog data needs no scope. */
export const SCOPES = ["playlist-modify-private"];

/**
 * A Client ID typed into Settings, for people using their own Spotify app.
 * It overrides the deployment's NEXT_PUBLIC_SPOTIFY_CLIENT_ID.
 */
export const customClientIdStore = createLocalStore<string>("encore-spotify-client-id", "", {
  serialize: (value) => value,
  deserialize: (raw) => raw,
});

export function resolveClientId(custom: string): string | null {
  return custom.trim() || process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID?.trim() || null;
}

export function redirectUri(origin = window.location.origin): string {
  return `${origin}/callback`;
}

/**
 * Why Spotify would reject a login from this address, if it would. Spotify
 * refuses "localhost" redirect URIs and needs HTTPS except on loopback IPs.
 */
export function loginBlocker(location: Pick<Location, "hostname" | "protocol" | "port"> = window.location): string | null {
  const loopback = location.hostname === "127.0.0.1" || location.hostname === "[::1]";
  if (location.hostname === "localhost") {
    const port = location.port ? `:${location.port}` : "";
    return `Spotify doesn't accept "localhost" for logins. Open http://127.0.0.1${port} instead. Your imported data is stored per address, so you'll need to import it again there.`;
  }
  if (location.protocol !== "https:" && !loopback) return "Spotify logins need HTTPS. Open this site over https://.";
  return null;
}
