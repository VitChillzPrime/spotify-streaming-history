import { describe, expect, it } from "vitest";
import { artworkUri, openSpotifyUrl } from "@/lib/artwork";
import { DatasetBuilder } from "@/lib/ingest/builder";
import { extendedRow } from "@/lib/test-fixtures";

function fixture() {
  const builder = new DatasetBuilder();
  const at = (day: number) => `2024-01-${String(day).padStart(2, "0")}T12:00:00Z`;
  builder.addExtended([
    // "Hit" was released as a single and on the LP; the LP version is played more.
    extendedRow({ ts: at(1), track: "Hit", artist: "A", album: "Single", uri: "spotify:track:single1" }),
    extendedRow({ ts: at(2), track: "Hit", artist: "A", album: "LP", uri: "spotify:track:lp1" }),
    extendedRow({ ts: at(3), track: "Hit", artist: "A", album: "LP", uri: "spotify:track:lp1" }),
    extendedRow({ ts: at(4), track: "Hit", artist: "A", album: "LP", uri: "spotify:track:lp1" }),
    extendedRow({ ts: at(5), track: "Deep cut", artist: "A", album: "LP", uri: "spotify:track:lp2" }),
    extendedRow({ ts: at(6), track: "Local", artist: "B", album: "Demo", uri: "spotify:local:B:Demo:Local:200" }),
    extendedRow({ ts: at(7), episode: "Ep 1", show: "Pod", episodeUri: "spotify:episode:ep1" }),
    extendedRow({ ts: at(8), episode: "Ep 1", show: "Pod", episodeUri: "spotify:episode:ep1" }),
    extendedRow({ ts: at(9), episode: "Ep 2", show: "Pod", episodeUri: "spotify:episode:ep2" }),
    extendedRow({ ts: at(10), book: "Novel", bookUri: "spotify:audiobook:novel", chapter: "One", chapterUri: "spotify:chapter:one" }),
  ]);
  return builder.finalize({ files: [], importedAt: 0 });
}

describe("openSpotifyUrl", () => {
  it("turns Spotify URIs into open.spotify.com links", () => {
    expect(openSpotifyUrl("spotify:track:abc123")).toBe("https://open.spotify.com/track/abc123");
    expect(openSpotifyUrl("spotify:episode:xyz")).toBe("https://open.spotify.com/episode/xyz");
    expect(openSpotifyUrl("spotify:audiobook:q1")).toBe("https://open.spotify.com/audiobook/q1");
    expect(openSpotifyUrl("spotify:local:Artist:Album:Song:200")).toBeNull();
    expect(openSpotifyUrl("https://example.com")).toBeNull();
    expect(openSpotifyUrl(null)).toBeNull();
  });
});

describe("artworkUri", () => {
  it("picks a representative item for every kind of entity", () => {
    const ds = fixture();
    const song = (name: string) => ds.songs.name.indexOf(name);
    const album = (name: string) => ds.albums.name.indexOf(name);

    expect(artworkUri(ds, { type: "song", id: song("Hit") })).toBe("spotify:track:lp1");
    expect(artworkUri(ds, { type: "album", id: album("Single") })).toBe("spotify:track:single1");
    expect(artworkUri(ds, { type: "album", id: album("LP") })).toBe("spotify:track:lp1");
    expect(artworkUri(ds, { type: "artist", id: ds.artists.indexOf("A") })).toBe("spotify:track:lp1");
    expect(artworkUri(ds, { type: "show", id: ds.shows.indexOf("Pod") })).toBe("spotify:episode:ep1");
    expect(artworkUri(ds, { type: "episode", id: ds.episodes.name.indexOf("Ep 2") })).toBe("spotify:episode:ep2");
    expect(artworkUri(ds, { type: "book", id: 0 })).toBe("spotify:audiobook:novel");
    // Local files have no artwork online.
    expect(artworkUri(ds, { type: "artist", id: ds.artists.indexOf("B") })).toBeNull();
  });

  it("falls back for data imported before albums had URIs", () => {
    const ds = fixture();
    delete ds.albums.uri;
    expect(artworkUri(ds, { type: "album", id: ds.albums.name.indexOf("LP") })).toBe("spotify:track:lp1");
  });
});
