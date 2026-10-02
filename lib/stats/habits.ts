import type { PlatformGroup } from "@/lib/labels";
import { FLAG, KIND } from "@/lib/model";
import type { Scope } from "@/lib/stats/scope";
import { makeBuckets, type Bucket, type Granularity } from "@/lib/stats/time";

export interface RateSeries {
  buckets: Bucket[];
  /** Plays with the field recorded, per bucket. */
  known: Uint32Array;
  /** Plays where the flag was set, per bucket. */
  on: Uint32Array;
}

/** How often a flag (skipped, shuffle, offline…) was on, per month or week. */
export function flagRate(scope: Scope, flag: number, knownFlag: number, granularity: Granularity): RateSeries {
  const { p, range, kinds } = scope;
  const kindCol = p.ds.kind;
  const flagsCol = p.ds.flags;
  const dayCol = p.day;
  if (range.days === 0) return { buckets: [], known: new Uint32Array(0), on: new Uint32Array(0) };
  const { buckets, indexOf } = makeBuckets(range.dataFrom, range.dataTo, granularity);
  const known = new Uint32Array(buckets.length);
  const on = new Uint32Array(buckets.length);
  let cachedDay = NaN;
  let bucket = 0;
  for (let i = range.lo; i < range.hi; i++) {
    const flags = flagsCol[i];
    if (!(flags & knownFlag) || !((kinds >> kindCol[i]) & 1)) continue;
    if (dayCol[i] !== cachedDay) {
      cachedDay = dayCol[i];
      bucket = indexOf(cachedDay);
    }
    known[bucket]++;
    if (flags & flag) on[bucket]++;
  }
  return { buckets, known, on };
}

export interface SkipEntry {
  song: number;
  /** All plays of the song where skipping was recorded. */
  plays: number;
  skips: number;
  rate: number;
}

/** Songs you skip the most and the least, among songs you've started often enough to judge. */
export function skipLeaders(scope: Scope, minStarts = 8, limit = 10) {
  const { p, range } = scope;
  const kindCol = p.ds.kind;
  const itemCol = p.ds.item;
  const flagsCol = p.ds.flags;
  const TRACK = KIND.track;
  const size = p.ds.songs.name.length;
  const starts = new Uint32Array(size);
  const skips = new Uint32Array(size);
  for (let i = range.lo; i < range.hi; i++) {
    if (kindCol[i] !== TRACK) continue;
    const flags = flagsCol[i];
    if (!(flags & FLAG.skippedKnown)) continue;
    const song = itemCol[i];
    if (song < 0) continue;
    starts[song]++;
    if (flags & FLAG.skipped) skips[song]++;
  }
  const entries: SkipEntry[] = [];
  for (let song = 0; song < size; song++) {
    if (starts[song] < minStarts) continue;
    entries.push({ song, plays: starts[song], skips: skips[song], rate: skips[song] / starts[song] });
  }
  const mostSkipped = [...entries]
    .filter((e) => e.skips > 0)
    .sort((a, b) => b.rate - a.rate || b.skips - a.skips)
    .slice(0, limit);
  const neverSkipped = entries
    .filter((e) => e.skips === 0)
    .sort((a, b) => b.plays - a.plays)
    .slice(0, limit);
  return { mostSkipped, neverSkipped };
}

export interface Share {
  key: string;
  label: string;
  ms: number;
  count: number;
}

/** How plays started and ended (`reason_start` / `reason_end`). */
export function reasons(scope: Scope, which: "start" | "end"): Share[] {
  const { p, range, kinds } = scope;
  const kindCol = p.ds.kind;
  const msCol = p.ds.ms;
  const column = which === "start" ? p.ds.reasonStart : p.ds.reasonEnd;
  const ms = new Float64Array(p.ds.reasons.length);
  const count = new Uint32Array(p.ds.reasons.length);
  for (let i = range.lo; i < range.hi; i++) {
    if (!((kinds >> kindCol[i]) & 1)) continue;
    ms[column[i]] += msCol[i];
    count[column[i]]++;
  }
  return p.ds.reasons
    .map((key, id) => ({ key, label: key, ms: ms[id], count: count[id] }))
    .filter((share) => share.count > 0)
    .sort((a, b) => b.count - a.count);
}

export interface PlatformShare {
  group: PlatformGroup;
  ms: number;
  count: number;
  /** The raw platform strings in this group, most used first. */
  devices: { name: string; ms: number; count: number }[];
}

export function platforms(scope: Scope): PlatformShare[] {
  const { p, range, kinds } = scope;
  const kindCol = p.ds.kind;
  const msCol = p.ds.ms;
  const platformCol = p.ds.platform;
  const ms = new Float64Array(p.ds.platforms.length);
  const count = new Uint32Array(p.ds.platforms.length);
  for (let i = range.lo; i < range.hi; i++) {
    if (!((kinds >> kindCol[i]) & 1)) continue;
    ms[platformCol[i]] += msCol[i];
    count[platformCol[i]]++;
  }
  const groups = new Map<PlatformGroup, PlatformShare>();
  p.ds.platforms.forEach((name, id) => {
    if (!count[id]) return;
    const group = p.platformGroups[id];
    let share = groups.get(group);
    if (!share) {
      share = { group, ms: 0, count: 0, devices: [] };
      groups.set(group, share);
    }
    share.ms += ms[id];
    share.count += count[id];
    share.devices.push({ name, ms: ms[id], count: count[id] });
  });
  const result = [...groups.values()].sort((a, b) => b.ms - a.ms);
  for (const share of result) share.devices.sort((a, b) => b.ms - a.ms);
  return result;
}

/** Listening per platform group per year: how your devices changed over time. */
export function platformsByYear(scope: Scope, granularity: Granularity = "year") {
  const { p, range, kinds } = scope;
  const kindCol = p.ds.kind;
  const msCol = p.ds.ms;
  const platformCol = p.ds.platform;
  const dayCol = p.day;
  if (range.days === 0) return { buckets: [] as Bucket[], groups: [] as { group: PlatformGroup; ms: Float64Array }[] };
  const { buckets, indexOf } = makeBuckets(range.dataFrom, range.dataTo, granularity);
  const byGroup = new Map<PlatformGroup, Float64Array>();
  let cachedDay = NaN;
  let bucket = 0;
  for (let i = range.lo; i < range.hi; i++) {
    if (!((kinds >> kindCol[i]) & 1)) continue;
    if (dayCol[i] !== cachedDay) {
      cachedDay = dayCol[i];
      bucket = indexOf(cachedDay);
    }
    const group = p.platformGroups[platformCol[i]];
    let series = byGroup.get(group);
    if (!series) {
      series = new Float64Array(buckets.length);
      byGroup.set(group, series);
    }
    series[bucket] += msCol[i];
  }
  const groups = [...byGroup.entries()]
    .map(([group, ms]) => ({ group, ms, total: ms.reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.total - a.total)
    .map(({ group, ms }) => ({ group, ms }));
  return { buckets, groups };
}

export function countries(scope: Scope): Share[] {
  const { p, range, kinds } = scope;
  const kindCol = p.ds.kind;
  const msCol = p.ds.ms;
  const countryCol = p.ds.country;
  const ms = new Float64Array(p.ds.countries.length);
  const count = new Uint32Array(p.ds.countries.length);
  for (let i = range.lo; i < range.hi; i++) {
    if (!((kinds >> kindCol[i]) & 1)) continue;
    ms[countryCol[i]] += msCol[i];
    count[countryCol[i]]++;
  }
  return p.ds.countries
    .map((key, id) => ({ key, label: key, ms: ms[id], count: count[id] }))
    .filter((share) => share.count > 0)
    .sort((a, b) => b.ms - a.ms);
}
