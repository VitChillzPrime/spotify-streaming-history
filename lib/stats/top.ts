import { KIND, type Kind } from "@/lib/model";
import type { Scope, Totals } from "@/lib/stats/scope";
import { makeBuckets, type Bucket, type Granularity } from "@/lib/stats/time";

export type RankBy = "time" | "plays";

export interface Ranked extends Totals {
  id: number;
}

export type EntityType = "artist" | "song" | "album" | "show" | "episode" | "book";

export interface EntityRef {
  type: EntityType;
  id: number;
}

/**
 * How a stream maps to an entity of a type: streams of `kind`, keyed by the
 * `item` (or `album`) column, optionally through a lookup table — e.g. an
 * artist is `songs.artist[item]`. Chosen once per call so hot loops avoid closures.
 */
export function entityKey(scope: Scope, type: EntityType) {
  const { ds } = scope.p;
  const plan = (kind: Kind, size: number, column: Int32Array, lookup: Int32Array | null) => ({ kind, size, column, lookup });
  switch (type) {
    case "song":
      return plan(KIND.track, ds.songs.name.length, ds.item, null);
    case "artist":
      return plan(KIND.track, ds.artists.length, ds.item, ds.songs.artist);
    case "album":
      return plan(KIND.track, ds.albums.name.length, ds.album, null);
    case "episode":
      return plan(KIND.episode, ds.episodes.name.length, ds.item, null);
    case "show":
      return plan(KIND.episode, ds.shows.length, ds.item, ds.episodes.show);
    case "book":
      return plan(KIND.audiobook, ds.books.title.length, ds.item, ds.chapters.book);
  }
}

/** Totals for every entity of a type within the scope's range (or a subset of its streams). */
export function accumulate(scope: Scope, type: EntityType, subset?: Int32Array) {
  const { p, range, minMs } = scope;
  const { kind, size, column, lookup } = entityKey(scope, type);
  const ms = new Float64Array(size);
  const plays = new Uint32Array(size);
  const count = new Uint32Array(size);
  const kindCol = p.ds.kind;
  const msCol = p.ds.ms;
  const n = subset ? subset.length : range.hi - range.lo;
  for (let k = 0; k < n; k++) {
    const i = subset ? subset[k] : range.lo + k;
    if (kindCol[i] !== kind) continue;
    let id = column[i];
    if (id < 0) continue;
    if (lookup) id = lookup[id];
    const played = msCol[i];
    ms[id] += played;
    count[id]++;
    if (played >= minMs) plays[id]++;
  }
  return { ms, plays, count };
}

/** Listening over time for a handful of entities at once (e.g. trend sparklines in a table). */
export function seriesFor(scope: Scope, type: EntityType, ids: number[], granularity: Granularity) {
  const { p, range } = scope;
  if (range.days === 0 || ids.length === 0) return { buckets: [] as Bucket[], series: ids.map(() => new Float64Array(0)) };
  const { kind, size, column, lookup } = entityKey(scope, type);
  const { buckets, indexOf } = makeBuckets(range.dataFrom, range.dataTo, granularity);
  const slot = new Int32Array(size).fill(-1);
  ids.forEach((id, k) => (slot[id] = k));
  const series = ids.map(() => new Float64Array(buckets.length));
  const kindCol = p.ds.kind;
  const msCol = p.ds.ms;
  const dayCol = p.day;
  let cachedDay = NaN;
  let bucket = 0;
  for (let i = range.lo; i < range.hi; i++) {
    if (kindCol[i] !== kind) continue;
    let id = column[i];
    if (id < 0) continue;
    if (lookup) id = lookup[id];
    const k = slot[id];
    if (k < 0) continue;
    if (dayCol[i] !== cachedDay) {
      cachedDay = dayCol[i];
      bucket = indexOf(cachedDay);
    }
    series[k][bucket] += msCol[i];
  }
  return { buckets, series };
}

/**
 * Entities ranked by time or streams. Only entities with at least one stream
 * are ranked, so counts agree with the summary ("1,360 artists") everywhere.
 */
export function rank(scope: Scope, type: EntityType, by: RankBy, subset?: Int32Array): Ranked[] {
  const { ms, plays, count } = accumulate(scope, type, subset);
  const ranked: Ranked[] = [];
  for (let id = 0; id < ms.length; id++) {
    if (plays[id] === 0) continue;
    ranked.push({ id, ms: ms[id], plays: plays[id], count: count[id] });
  }
  ranked.sort(by === "plays" ? (a, b) => b.plays - a.plays || b.ms - a.ms : (a, b) => b.ms - a.ms || b.plays - a.plays);
  return ranked;
}
