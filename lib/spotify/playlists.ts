import { spotifyFetch } from "@/lib/spotify/api";

const PLAYABLE = /^spotify:(track|episode):[A-Za-z0-9]+$/;

/** Splits URIs into Spotify's 100-items-per-request batches, dropping local files and duplicates. */
export function playlistBatches(uris: string[], size = 100): string[][] {
  const playable = [...new Set(uris.filter((uri) => PLAYABLE.test(uri)))];
  const batches: string[][] = [];
  for (let i = 0; i < playable.length; i += size) batches.push(playable.slice(i, i + size));
  return batches;
}

/** Creates a private playlist in the user's library and returns its Spotify link. */
export async function savePlaylist(name: string, description: string, uris: string[]): Promise<string> {
  const batches = playlistBatches(uris);
  if (batches.length === 0) throw new Error("None of these songs can be added to a playlist.");
  const playlist = await spotifyFetch<{ id: string; external_urls?: { spotify?: string } }>("/me/playlists", {
    method: "POST",
    body: JSON.stringify({ name: name.slice(0, 100), description: description.slice(0, 300), public: false }),
  });
  for (const batch of batches) {
    await spotifyFetch(`/playlists/${encodeURIComponent(playlist.id)}/items`, {
      method: "POST",
      body: JSON.stringify({ uris: batch }),
    });
  }
  return playlist.external_urls?.spotify ?? `https://open.spotify.com/playlist/${playlist.id}`;
}
