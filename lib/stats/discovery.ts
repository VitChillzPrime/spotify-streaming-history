import { KIND } from "@/lib/model";
import type { Prepared } from "@/lib/prepare";
import type { Scope } from "@/lib/stats/scope";
import { makeBuckets, type Bucket, type Granularity } from "@/lib/stats/time";
import { monthIndex, monthIndexToStartDay } from "@/lib/time";

export interface FirstPlays {
  /** Stream index of each song's first stream in the whole history, or -1. */
  song: Int32Array;
  artist: Int32Array;
  album: Int32Array;
}

const firstPlaysCache = new WeakMap<Prepared, Map<number, FirstPlays>>();

/** When each song, artist and album was first streamed, across the entire history. */
export function firstPlays(p: Prepared, minMs: number): FirstPlays {
  const TRACK = KIND.track;
  let byThreshold = firstPlaysCache.get(p);
  if (!byThreshold) {
    byThreshold = new Map();
    firstPlaysCache.set(p, byThreshold);
  }
  const cached = byThreshold.get(minMs);
  if (cached) return cached;

  const { ds } = p;
  const result: FirstPlays = {
    song: new Int32Array(ds.songs.name.length).fill(-1),
    artist: new Int32Array(ds.artists.length).fill(-1),
    album: new Int32Array(ds.albums.name.length).fill(-1),
  };
  for (let i = 0; i < ds.size; i++) {
    if (ds.kind[i] !== TRACK || ds.ms[i] < minMs) continue;
    const song = ds.item[i];
    if (song < 0) continue;
    if (result.song[song] < 0) result.song[song] = i;
    const artist = ds.songs.artist[song];
    if (result.artist[artist] < 0) result.artist[artist] = i;
    const album = ds.album[i];
    if (album >= 0 && result.album[album] < 0) result.album[album] = i;
  }
  byThreshold.set(minMs, result);
  return result;
}

export interface DiscoveryTimeline {
  granularity: Granularity;
  buckets: Bucket[];
  /** Artists heard for the first time ever, per bucket. */
  newArtists: Uint32Array;
  newSongs: Uint32Array;
  /** Distinct artists streamed per bucket — how varied your listening was. */
  artists: Uint32Array;
  songs: Uint32Array;
}

export function discoveryTimeline(scope: Scope): DiscoveryTimeline {
  const { p, range, minMs } = scope;
  const songArtist = p.ds.songs.artist;
  const kindCol = p.ds.kind;
  const msCol = p.ds.ms;
  const itemCol = p.ds.item;
  const dayCol = p.day;
  const TRACK = KIND.track;
  const granularity: Granularity = range.days <= 120 ? "week" : "month";
  if (range.days === 0) {
    const empty = new Uint32Array(0);
    return { granularity, buckets: [], newArtists: empty, newSongs: empty, artists: empty, songs: empty };
  }
  const { buckets, indexOf } = makeBuckets(range.dataFrom, range.dataTo, granularity);
  const first = firstPlays(p, minMs);
  const newArtists = new Uint32Array(buckets.length);
  const newSongs = new Uint32Array(buckets.length);
  const artists = new Uint32Array(buckets.length);
  const songs = new Uint32Array(buckets.length);
  // "Last bucket this was seen in" makes distinct counts a single pass.
  const artistSeen = new Int32Array(p.ds.artists.length).fill(-1);
  const songSeen = new Int32Array(p.ds.songs.name.length).fill(-1);

  let cachedDay = NaN;
  let bucket = 0;
  for (let i = range.lo; i < range.hi; i++) {
    if (kindCol[i] !== TRACK || msCol[i] < minMs) continue;
    const song = itemCol[i];
    if (song < 0) continue;
    if (dayCol[i] !== cachedDay) {
      cachedDay = dayCol[i];
      bucket = indexOf(cachedDay);
    }
    const artist = songArtist[song];
    if (first.song[song] === i) newSongs[bucket]++;
    if (first.artist[artist] === i) newArtists[bucket]++;
    if (songSeen[song] !== bucket) {
      songSeen[song] = bucket;
      songs[bucket]++;
    }
    if (artistSeen[artist] !== bucket) {
      artistSeen[artist] = bucket;
      artists[bucket]++;
    }
  }
  return { granularity, buckets, newArtists, newSongs, artists, songs };
}

export interface Discovery {
  id: number;
  /** Stream index of the first ever stream. */
  first: number;
  ms: number;
  plays: number;
}

/** Artists or songs first heard within the range, ranked by how much you listened to them afterwards (within range). */
export function discoveries(scope: Scope, type: "artist" | "song", limit = 20): Discovery[] {
  const { p, range, minMs } = scope;
  const songArtist = p.ds.songs.artist;
  const kindCol = p.ds.kind;
  const msCol = p.ds.ms;
  const itemCol = p.ds.item;
  const TRACK = KIND.track;
  const first = firstPlays(p, minMs)[type];
  const ms = new Float64Array(first.length);
  const plays = new Uint32Array(first.length);
  for (let i = range.lo; i < range.hi; i++) {
    if (kindCol[i] !== TRACK) continue;
    const song = itemCol[i];
    if (song < 0) continue;
    const id = type === "song" ? song : songArtist[song];
    const firstIndex = first[id];
    if (firstIndex < range.lo || firstIndex >= range.hi || i < firstIndex) continue;
    ms[id] += msCol[i];
    if (msCol[i] >= minMs) plays[id]++;
  }
  const result: Discovery[] = [];
  for (let id = 0; id < first.length; id++) {
    if (plays[id] > 0) result.push({ id, first: first[id], ms: ms[id], plays: plays[id] });
  }
  return result.sort((a, b) => b.ms - a.ms).slice(0, limit);
}

export interface Era {
  /** First day of the month. */
  start: number;
  totalMs: number;
  artist: number;
  artistMs: number;
  song: number;
  songMs: number;
}

/** Your top artist and song of every month in the range. */
export function eras(scope: Scope): Era[] {
  const { p, range } = scope;
  const songArtist = p.ds.songs.artist;
  const kindCol = p.ds.kind;
  const msCol = p.ds.ms;
  const itemCol = p.ds.item;
  const dayCol = p.day;
  const TRACK = KIND.track;
  const result: Era[] = [];
  let month = NaN;
  let artistMs = new Map<number, number>();
  let songMs = new Map<number, number>();
  let total = 0;

  const flush = () => {
    if (Number.isNaN(month) || total === 0) return;
    let artist = -1;
    let bestArtist = -1;
    for (const [id, ms] of artistMs) if (ms > bestArtist) [artist, bestArtist] = [id, ms];
    let song = -1;
    let bestSong = -1;
    for (const [id, ms] of songMs) if (ms > bestSong) [song, bestSong] = [id, ms];
    result.push({ start: monthIndexToStartDay(month), totalMs: total, artist, artistMs: bestArtist, song, songMs: bestSong });
  };

  let cachedDay = NaN;
  for (let i = range.lo; i < range.hi; i++) {
    if (kindCol[i] !== TRACK) continue;
    const song = itemCol[i];
    if (song < 0) continue;
    if (dayCol[i] !== cachedDay) {
      cachedDay = dayCol[i];
      const m = monthIndex(cachedDay);
      if (m !== month) {
        flush();
        month = m;
        artistMs = new Map();
        songMs = new Map();
        total = 0;
      }
    }
    const ms = msCol[i];
    const artist = songArtist[song];
    total += ms;
    artistMs.set(artist, (artistMs.get(artist) ?? 0) + ms);
    songMs.set(song, (songMs.get(song) ?? 0) + ms);
  }
  flush();
  return result;
}

export interface Forgotten {
  song: number;
  plays: number;
  ms: number;
  /** Day of the most recent stream. */
  lastDay: number;
}

/** Songs you streamed a lot before the end of the range but haven't played for a while since. */
export function forgottenFavorites(scope: Scope, idleDays = 180, limit = 12, minPlays = 10): Forgotten[] {
  const { p, range, minMs } = scope;
  const kindCol = p.ds.kind;
  const msCol = p.ds.ms;
  const itemCol = p.ds.item;
  const dayCol = p.day;
  const TRACK = KIND.track;
  const size = p.ds.songs.name.length;
  const plays = new Uint32Array(size);
  const ms = new Float64Array(size);
  const lastDay = new Int32Array(size);
  for (let i = 0; i < range.hi; i++) {
    if (kindCol[i] !== TRACK || msCol[i] < minMs) continue;
    const song = itemCol[i];
    if (song < 0) continue;
    plays[song]++;
    ms[song] += msCol[i];
    lastDay[song] = dayCol[i];
  }
  const cutoff = range.dataTo - idleDays;
  const result: Forgotten[] = [];
  for (let song = 0; song < size; song++) {
    if (plays[song] >= minPlays && lastDay[song] <= cutoff) {
      result.push({ song, plays: plays[song], ms: ms[song], lastDay: lastDay[song] });
    }
  }
  return result.sort((a, b) => b.plays - a.plays).slice(0, limit);
}

export interface Loyalty {
  artist: number;
  /** Months (or weeks) in which the artist was streamed. */
  periods: number;
  ms: number;
}

/** Artists you kept coming back to: streamed in the most distinct months of the range. */
export function loyalty(scope: Scope, limit = 10): { periods: number; artists: Loyalty[] } {
  const { p, range, minMs } = scope;
  const songArtist = p.ds.songs.artist;
  const kindCol = p.ds.kind;
  const msCol = p.ds.ms;
  const itemCol = p.ds.item;
  const dayCol = p.day;
  const TRACK = KIND.track;
  if (range.days === 0) return { periods: 0, artists: [] };
  const { buckets, indexOf } = makeBuckets(range.dataFrom, range.dataTo, "month");
  const size = p.ds.artists.length;
  const lastBucket = new Int32Array(size).fill(-1);
  const periods = new Uint32Array(size);
  const ms = new Float64Array(size);
  let cachedDay = NaN;
  let bucket = 0;
  for (let i = range.lo; i < range.hi; i++) {
    if (kindCol[i] !== TRACK || msCol[i] < minMs) continue;
    const song = itemCol[i];
    if (song < 0) continue;
    if (dayCol[i] !== cachedDay) {
      cachedDay = dayCol[i];
      bucket = indexOf(cachedDay);
    }
    const artist = songArtist[song];
    ms[artist] += msCol[i];
    if (lastBucket[artist] !== bucket) {
      lastBucket[artist] = bucket;
      periods[artist]++;
    }
  }
  const artists: Loyalty[] = [];
  for (let artist = 0; artist < size; artist++) {
    if (periods[artist] > 0) artists.push({ artist, periods: periods[artist], ms: ms[artist] });
  }
  artists.sort((a, b) => b.periods - a.periods || b.ms - a.ms);
  return { periods: buckets.length, artists: artists.slice(0, limit) };
}
