import { describe, expect, it } from "vitest";
import { DatasetBuilder } from "@/lib/ingest/builder";
import { prepare } from "@/lib/prepare";
import { resolveRange } from "@/lib/range";
import { discoveries, discoveryTimeline, eras, firstPlays, forgottenFavorites } from "@/lib/stats/discovery";
import { entityDetail } from "@/lib/stats/entity";
import { platforms, reasons, skipLeaders } from "@/lib/stats/habits";
import { searchHistory } from "@/lib/stats/history";
import { biggestDays, repeats, sessions, streaks } from "@/lib/stats/records";
import { DEFAULT_MIN_MS, KINDS, type Scope } from "@/lib/stats/scope";
import { summarize } from "@/lib/stats/summary";
import { hourly, monthsByYear, timeline, weekdays } from "@/lib/stats/time";
import { rank } from "@/lib/stats/top";
import { yearReviews } from "@/lib/stats/years";
import { extendedRow, type ExtendedRowInput } from "@/lib/test-fixtures";
import { dayOf } from "@/lib/time";

/** A play that starts at `start` (UTC) and lasts `seconds`. */
function play(start: string, seconds: number, rest: Omit<ExtendedRowInput, "ts" | "ms">) {
  const ms = seconds * 1000;
  return extendedRow({ ...rest, ts: new Date(Date.parse(start) + ms).toISOString(), ms });
}

const A = { track: "Song A", artist: "Alpha", album: "Alpha LP", uri: "spotify:track:a" };
const B = { track: "Song B", artist: "Beta", album: "Beta EP", uri: "spotify:track:b" };
const C = { track: "Song C", artist: "Alpha", album: "Alpha LP", uri: "spotify:track:c" };

function fixture(): Scope {
  const builder = new DatasetBuilder();
  builder.addExtended([
    // Monday 2024-01-01
    play("2024-01-01T10:00:00Z", 200, { ...A, shuffle: true }),
    play("2024-01-01T10:04:00Z", 200, A),
    play("2024-01-01T10:08:00Z", 20, { ...B, skipped: true, reasonEnd: "fwdbtn", platform: "windows" }),
    play("2024-01-01T10:09:00Z", 200, A),
    play("2024-01-01T21:00:00Z", 1800, { episode: "Ep 1", show: "Pod", episodeUri: "spotify:episode:e1" }),
    // Tuesday
    play("2024-01-02T09:00:00Z", 240, B),
    // Wednesday
    play("2024-01-03T09:00:00Z", 100, C),
    // Friday: the streak breaks on Thursday
    play("2024-01-05T08:00:00Z", 200, A),
    play("2024-01-05T20:00:00Z", 3600, { book: "Book", bookUri: "spotify:show:bk", chapter: "Ch 1" }),
  ]);
  const ds = builder.finalize({ files: [], importedAt: 0 });
  const p = prepare(ds, "UTC");
  return { p, range: resolveRange(p, { type: "all" }), kinds: KINDS.all, minMs: DEFAULT_MIN_MS };
}

const songId = (scope: Scope, name: string) => scope.p.ds.songs.name.indexOf(name);
const artistId = (scope: Scope, name: string) => scope.p.ds.artists.indexOf(name);

describe("summary", () => {
  it("totals time, streams and distinct items", () => {
    const summary = summarize(fixture());
    expect(summary.ms).toBe(6560 * 1000);
    expect(summary.count).toBe(9);
    expect(summary.plays).toBe(8); // the 20-second play doesn't count as a stream
    expect(summary.songs).toBe(3);
    expect(summary.artists).toBe(2);
    expect(summary.albums).toBe(2);
    expect(summary.shows).toBe(1);
    expect(summary.episodes).toBe(1);
    expect(summary.books).toBe(1);
    expect(summary.activeDays).toBe(4);
    expect(summary.skips).toEqual({ known: 9, on: 1 });
    expect(summary.shuffle).toEqual({ known: 9, on: 1 });
    expect(summary.byKind[0].ms).toBe(1160 * 1000);
  });

  it("respects the content filter", () => {
    const summary = summarize({ ...fixture(), kinds: KINDS.podcasts });
    expect(summary.ms).toBe(1800 * 1000);
    expect(summary.songs).toBe(0);
  });
});

describe("rankings", () => {
  it("ranks artists by time and songs by streams", () => {
    const scope = fixture();
    const artists = rank(scope, "artist", "time");
    expect(artists.map((a) => scope.p.ds.artists[a.id])).toEqual(["Alpha", "Beta"]);
    expect(artists[0].ms).toBe(900 * 1000);
    expect(artists[0].plays).toBe(5);

    const songs = rank(scope, "song", "plays");
    expect(songs.map((s) => scope.p.ds.songs.name[s.id])).toEqual(["Song A", "Song B", "Song C"]);
    expect(songs[0].plays).toBe(4);
  });
});

describe("time", () => {
  it("buckets by day, hour and weekday in the chosen time zone", () => {
    const scope = fixture();
    const days = timeline(scope, "day");
    expect(days.buckets).toHaveLength(5);
    expect(days.ms[3]).toBe(0); // Thursday
    expect(days.ms[0]).toBe((620 + 1800) * 1000);

    const hours = hourly(scope).ms;
    expect(hours[10]).toBe(620 * 1000);
    expect(hours[9]).toBe(340 * 1000);
    expect(hours[20]).toBe(3600 * 1000);

    const week = weekdays(scope);
    expect(week.ms[0]).toBe((620 + 1800) * 1000); // Monday
    expect([...week.occurrences]).toEqual([1, 1, 1, 1, 1, 0, 0]);

    expect(monthsByYear(scope)[0].ms[0]).toBe(6560 * 1000);
  });

  it("shifts hours and days with the time zone", () => {
    const scope = fixture();
    const p = prepare(scope.p.ds, "Pacific/Auckland"); // UTC+13 in January
    const shifted: Scope = { ...scope, p, range: resolveRange(p, { type: "all" }) };
    expect(hourly(shifted).ms[23]).toBe(620 * 1000); // 10:00 UTC is 23:00 in Auckland
    expect(p.firstDay).toBe(dayOf(2024, 0, 1));
    expect(p.lastDay).toBe(dayOf(2024, 0, 6)); // 20:00 UTC on the 5th is the 6th there
  });
});

describe("records", () => {
  it("finds streaks, big days, sessions and repeats", () => {
    const scope = fixture();
    const { longest, current } = streaks(scope);
    expect(longest).toMatchObject({ days: 3, from: dayOf(2024, 0, 1), to: dayOf(2024, 0, 3) });
    expect(current).toMatchObject({ days: 1, from: dayOf(2024, 0, 5) });

    expect(biggestDays(scope, 1)[0]).toMatchObject({ day: dayOf(2024, 0, 5), ms: 3800 * 1000 });

    const s = sessions(scope);
    expect(s.count).toBe(6);
    expect(s.longest[0].ms).toBe(3600 * 1000);
    expect(s.totalMs).toBe(6560 * 1000);

    expect(repeats(scope)).toEqual([{ song: songId(scope, "Song A"), day: dayOf(2024, 0, 1), plays: 3, ms: 600 * 1000 }]);
  });
});

describe("habits", () => {
  it("summarises skips, end reasons and platforms", () => {
    const scope = fixture();
    const { mostSkipped } = skipLeaders(scope, 1);
    expect(mostSkipped.map((e) => scope.p.ds.songs.name[e.song])).toEqual(["Song B"]);
    expect(reasons(scope, "end").find((r) => r.key === "fwdbtn")?.count).toBe(1);
    const groups = platforms(scope);
    expect(groups.map((g) => g.group)).toEqual(["android", "windows"]);
  });
});

describe("discovery", () => {
  it("dates first listens across the whole history", () => {
    const scope = fixture();
    const first = firstPlays(scope.p, scope.minMs);
    // Song B's first *stream* is Tuesday: Monday's 20-second play doesn't count.
    expect(scope.p.day[first.song[songId(scope, "Song B")]]).toBe(dayOf(2024, 0, 2));

    const tuesdayOnward: Scope = { ...scope, range: resolveRange(scope.p, { type: "custom", from: dayOf(2024, 0, 2), to: dayOf(2024, 0, 5) }) };
    expect(discoveries(tuesdayOnward, "artist").map((d) => scope.p.ds.artists[d.id])).toEqual(["Beta"]);
    expect(discoveries(tuesdayOnward, "song").map((d) => scope.p.ds.songs.name[d.id])).toEqual(["Song B", "Song C"]);

    const timelineData = discoveryTimeline(scope);
    expect(timelineData.newArtists.reduce((a, b) => a + b, 0)).toBe(2);

    const [january] = eras(scope);
    expect(january.artist).toBe(artistId(scope, "Alpha"));
    expect(january.song).toBe(songId(scope, "Song A"));

    expect(forgottenFavorites(scope, 1, 10, 2).map((f) => scope.p.ds.songs.name[f.song])).toEqual([]);
  });
});

describe("entity detail", () => {
  it("describes an artist", () => {
    const scope = fixture();
    const detail = entityDetail(scope, { type: "artist", id: artistId(scope, "Alpha") });
    expect(detail.totals.ms).toBe(900 * 1000);
    expect(detail.rank).toBe(1);
    expect(detail.activeDays).toBe(3);
    expect(detail.songs.map((s) => scope.p.ds.songs.name[s.id])).toEqual(["Song A", "Song C"]);
    expect(detail.share).toBeCloseTo(900 / 1160);
  });
});

describe("history search", () => {
  it("matches titles, artists and shows, newest first", () => {
    const scope = fixture();
    const alpha = searchHistory(scope, "alpha");
    expect(alpha).toHaveLength(5);
    expect(alpha[0]).toBeGreaterThan(alpha[alpha.length - 1]);
    expect(searchHistory(scope, "pod")).toHaveLength(1);
    expect(searchHistory(scope, "")).toHaveLength(9);
  });
});

describe("year in review", () => {
  it("builds one review per year", () => {
    const [review] = yearReviews(fixture());
    expect(review.year).toBe(2024);
    expect(review.newArtists).toBe(2);
    expect(review.previous).toBeNull();
    expect(review.months[0]).toBe(6560 * 1000);
  });
});
