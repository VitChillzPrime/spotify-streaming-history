import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { collectSources, detectFormat, isHistoryFile, isVideoFile } from "@/lib/ingest/sources";
import { basicMusicRow, extendedRow } from "@/lib/test-fixtures";

const json = (value: unknown) => strToU8(JSON.stringify(value));

describe("file recognition", () => {
  it("recognises every known streaming-history file name", () => {
    for (const name of [
      "Spotify Extended Streaming History/Streaming_History_Audio_2023.json",
      "Spotify Extended Streaming History/Streaming_History_Video_2024.json",
      "MyData/endsong_0.json",
      "Spotify Account Data/StreamingHistory_music_0.json",
      "Spotify Account Data/StreamingHistory_podcast_0.json",
      "MyData/StreamingHistory0.json",
    ]) {
      expect(isHistoryFile(name), name).toBe(true);
    }
    expect(isHistoryFile("Spotify Account Data/Playlist1.json")).toBe(false);
    expect(isHistoryFile("ReadMeFirst_ExtendedStreamingHistory.pdf")).toBe(false);
    expect(isVideoFile("x/Streaming_History_Video_2024.json")).toBe(true);
    expect(isVideoFile("x/Streaming_History_Audio_2024.json")).toBe(false);
  });

  it("detects the export format from the rows", () => {
    expect(detectFormat([extendedRow({ ts: "2024-01-01T00:00:00Z", track: "S", artist: "A" })])).toBe("extended");
    expect(detectFormat([basicMusicRow("2024-01-01 00:00", "A", "S")])).toBe("basic");
    expect(detectFormat([{ name: "My playlist" }])).toBeNull();
    expect(detectFormat({ ts: 1 })).toBeNull();
  });
});

describe("collectSources", () => {
  it("finds history files in a zip and skips macOS junk and other data", async () => {
    const zip = zipSync({
      "Spotify Extended Streaming History/Streaming_History_Audio_2024.json": json([
        extendedRow({ ts: "2024-01-01T00:00:00Z", track: "S", artist: "A" }),
      ]),
      "Spotify Extended Streaming History/Streaming_History_Video_2024.json": json([]),
      "Spotify Extended Streaming History/ReadMeFirst_ExtendedStreamingHistory.pdf": strToU8("%PDF"),
      "__MACOSX/Spotify Extended Streaming History/._Streaming_History_Audio_2024.json": strToU8("junk"),
      "Spotify Account Data/Playlist1.json": json({ playlists: [] }),
    });
    const sources = await collectSources([new File([zip], "my_spotify_data.zip")]);
    expect(sources.map((s) => s.name)).toEqual([
      "Streaming_History_Audio_2024.json",
      "Streaming_History_Video_2024.json",
    ]);
    expect(sources[1].video).toBe(true);
    const text = new TextDecoder().decode(await sources[0].read());
    expect(JSON.parse(text)).toHaveLength(1);
  });

  it("accepts loose JSON files, and renamed files when nothing else matches", async () => {
    const loose = new File([json([basicMusicRow("2024-01-01 00:00", "A", "S")])], "StreamingHistory_music_0.json");
    expect((await collectSources([loose])).map((s) => s.name)).toEqual(["StreamingHistory_music_0.json"]);

    const renamed = new File([json([basicMusicRow("2024-01-01 00:00", "A", "S")])], "history (1).json");
    expect((await collectSources([renamed])).map((s) => s.name)).toEqual(["history (1).json"]);
  });

  it("ignores files that are neither zips nor JSON", async () => {
    expect(await collectSources([new File(["hello"], "notes.txt")])).toEqual([]);
  });
});
