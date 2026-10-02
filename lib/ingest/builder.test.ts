import { describe, expect, it } from "vitest";
import { DatasetBuilder, parseTimestamp } from "@/lib/ingest/builder";
import { FLAG, KIND } from "@/lib/model";
import { basicMusicRow, basicPodcastRow, extendedRow } from "@/lib/test-fixtures";

const build = (fill: (builder: DatasetBuilder) => void) => {
  const builder = new DatasetBuilder();
  fill(builder);
  return builder.finalize({ files: [], importedAt: 0 });
};

describe("parseTimestamp", () => {
  it("reads every Spotify timestamp shape as UTC", () => {
    expect(parseTimestamp("2023-03-28T16:40:34Z")).toBe(Date.UTC(2023, 2, 28, 16, 40, 34));
    expect(parseTimestamp("2023-03-28 16:40:34")).toBe(Date.UTC(2023, 2, 28, 16, 40, 34));
    expect(parseTimestamp("2023-03-28 16:40")).toBe(Date.UTC(2023, 2, 28, 16, 40));
    expect(parseTimestamp("2023-03-28T16:40:34.250Z")).toBe(Date.UTC(2023, 2, 28, 16, 40, 34, 250));
    expect(parseTimestamp("2023-03-28T18:40:34+02:00")).toBe(Date.UTC(2023, 2, 28, 16, 40, 34));
    expect(parseTimestamp("not a date")).toBeNaN();
    expect(parseTimestamp(null)).toBeNaN();
  });
});

describe("DatasetBuilder — extended history", () => {
  it("classifies tracks, podcast episodes, audiobooks and unknown rows", () => {
    const ds = build((b) =>
      b.addExtended([
        extendedRow({ ts: "2024-01-01T10:00:00Z", track: "Song", artist: "Artist", album: "Album", uri: "spotify:track:a" }),
        extendedRow({ ts: "2024-01-01T11:00:00Z", episode: "Ep 1", show: "Show ", episodeUri: "spotify:episode:e1" }),
        extendedRow({
          ts: "2024-01-01T12:00:00Z",
          book: "A Book",
          bookUri: "spotify:show:b1",
          chapter: "Chapter 1",
          chapterUri: "spotify:episode:c1",
        }),
        extendedRow({ ts: "2024-01-01T13:00:00Z" }),
      ]),
    );
    expect(ds.size).toBe(4);
    expect([...ds.kind]).toEqual([KIND.track, KIND.episode, KIND.audiobook, KIND.unknown]);
    expect(ds.songs.name).toEqual(["Song"]);
    expect(ds.artists).toEqual(["Artist"]);
    expect(ds.albums.name).toEqual(["Album"]);
    expect(ds.shows).toEqual(["Show"]); // trimmed
    expect(ds.episodes.name).toEqual(["Ep 1"]);
    expect(ds.books.title).toEqual(["A Book"]);
    expect(ds.chapters.title).toEqual(["Chapter 1"]);
    expect(ds.item[3]).toBe(-1);
  });

  it("never keeps personal fields like IP addresses", () => {
    const ds = build((b) => b.addExtended([extendedRow({ ts: "2024-01-01T10:00:00Z", track: "S", artist: "A" })]));
    expect(JSON.stringify(ds.meta)).not.toContain("203.0.113.7");
    expect(Object.keys(ds)).not.toContain("ip_addr");
  });

  it("merges releases of the same song and links the most-played URI", () => {
    const ds = build((b) =>
      b.addExtended([
        extendedRow({ ts: "2024-01-01T10:00:00Z", track: "Hit", artist: "A", album: "Single", uri: "spotify:track:single" }),
        extendedRow({ ts: "2024-01-02T10:00:00Z", track: "Hit", artist: "A", album: "LP", uri: "spotify:track:lp" }),
        extendedRow({ ts: "2024-01-03T10:00:00Z", track: "hit", artist: "A", album: "LP", uri: "spotify:track:lp" }),
        extendedRow({ ts: "2024-01-04T10:00:00Z", track: "Hit", artist: "B", album: "Cover", uri: "spotify:track:cover" }),
      ]),
    );
    expect(ds.songs.name).toEqual(["Hit", "Hit"]);
    expect([...ds.item]).toEqual([0, 0, 0, 1]);
    expect(ds.songs.uri).toEqual(["spotify:track:lp", "spotify:track:cover"]);
    expect(ds.albums.name).toEqual(["Single", "LP", "Cover"]);
  });

  it("packs flags and marks which fields the export recorded", () => {
    const ds = build((b) => {
      b.addExtended([
        extendedRow({ ts: "2024-01-01T10:00:00Z", track: "S", artist: "A", shuffle: true, skipped: true, offline: true }),
        extendedRow({ ts: "2024-01-01T11:00:00Z", track: "S", artist: "A", shuffle: null, skipped: null, reasonEnd: "fwdbtn" }),
        extendedRow({ ts: "2024-01-01T12:00:00Z", track: "S", artist: "A", skipped: null, reasonEnd: "trackdone" }),
      ]);
      b.addExtended([extendedRow({ ts: "2024-01-01T13:00:00Z", track: "Clip", artist: "A" })], { video: true });
    });
    const [first, second, third, fourth] = ds.flags;
    expect(first & FLAG.shuffle && first & FLAG.skipped && first & FLAG.offline).toBeTruthy();
    expect(second & FLAG.shuffleKnown).toBe(0);
    // `skipped` is null in older exports; it is derived from the end reason instead.
    expect(second & FLAG.skippedKnown && second & FLAG.skipped).toBeTruthy();
    expect(third & FLAG.skippedKnown).toBeTruthy();
    expect(third & FLAG.skipped).toBe(0);
    expect(fourth & FLAG.video).toBeTruthy();
    expect(ds.meta.features.video).toBe(true);
    expect(ds.meta.features.skips).toBe(true);
  });

  it("sorts by start time and removes exact duplicates only", () => {
    const row = extendedRow({ ts: "2024-01-01T10:05:00Z", ms: 300_000, track: "S", artist: "A" });
    const ds = build((b) => {
      b.addExtended([
        extendedRow({ ts: "2024-01-01T10:10:00Z", ms: 60_000, track: "Late", artist: "A" }),
        row,
        { ...row },
        { ...row, platform: "windows" },
      ]);
      b.addExtended([{ ...row }]);
    });
    expect(ds.meta.duplicates).toBe(2);
    expect(ds.size).toBe(3);
    const starts = [...ds.end].map((end, i) => end - ds.ms[i]);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
  });

  it("counts unreadable rows instead of failing", () => {
    const ds = build((b) =>
      b.addExtended([null, "x", { ts: "garbage", ms_played: 1 }, { ts: "1970-01-01T00:00:00Z", ms_played: 1 }]),
    );
    expect(ds.size).toBe(0);
    expect(ds.meta.invalid).toBe(4);
    expect(ds.meta.totalRecords).toBe(4);
  });
});

describe("DatasetBuilder — basic account data", () => {
  it("reads music and podcast rows", () => {
    const ds = build((b) =>
      b.addBasic([
        basicMusicRow("2024-02-01 10:00", "Artist", "Song"),
        basicPodcastRow("2024-02-01 11:00", "Show", "Episode"),
      ]),
    );
    expect([...ds.kind]).toEqual([KIND.track, KIND.episode]);
    expect(ds.meta.features.platforms).toBe(false);
    expect(ds.meta.features.skips).toBe(false);
  });

  it("drops basic rows already covered by extended history, keeps the rest", () => {
    const ds = build((b) => {
      b.addExtended([
        extendedRow({ ts: "2024-01-01T10:00:00Z", track: "S", artist: "A" }),
        extendedRow({ ts: "2024-03-01T10:00:00Z", track: "S", artist: "A" }),
      ]);
      b.addBasic([
        basicMusicRow("2024-02-01 10:00", "A", "S"), // inside the extended span
        basicMusicRow("2024-06-01 10:00", "A", "S"), // newer than the extended export
      ]);
    });
    expect(ds.meta.supersededBasic).toBe(1);
    expect(ds.size).toBe(3);
  });
});
