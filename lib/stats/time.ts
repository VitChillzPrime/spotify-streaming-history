import type { Scope } from "@/lib/stats/scope";
import { dayOf, dayParts, monthIndex, monthIndexToStartDay, weekStart, weekdayOf } from "@/lib/time";

// Hot loops below read columns into locals first: module constants and object properties are
// not reliably hoisted by the JIT, and these loops run over every stream in the range.

export type Granularity = "day" | "week" | "month" | "year";

/** A span of calendar days, inclusive. */
export interface Bucket {
  start: number;
  end: number;
}

/**
 * Stream indices to aggregate: either a scope's whole range, or a precomputed
 * subset (sorted indices within the range, e.g. one artist's streams).
 */
function count(scope: Scope, subset?: Int32Array) {
  return subset ? subset.length : scope.range.hi - scope.range.lo;
}

/** Picks a readable number of points for a span of days. */
export function autoGranularity(days: number): Granularity {
  if (days <= 62) return "day";
  if (days <= 400) return "week";
  return "month";
}

export function makeBuckets(from: number, to: number, granularity: Granularity) {
  const buckets: Bucket[] = [];
  let indexOf: (day: number) => number;
  switch (granularity) {
    case "day": {
      for (let d = from; d <= to; d++) buckets.push({ start: d, end: d });
      indexOf = (day) => day - from;
      break;
    }
    case "week": {
      const first = weekStart(from);
      for (let d = first; d <= to; d += 7) buckets.push({ start: d, end: d + 6 });
      indexOf = (day) => Math.floor((day - first) / 7);
      break;
    }
    case "month": {
      const first = monthIndex(from);
      const last = monthIndex(to);
      for (let m = first; m <= last; m++) {
        buckets.push({ start: monthIndexToStartDay(m), end: monthIndexToStartDay(m + 1) - 1 });
      }
      indexOf = (day) => monthIndex(day) - first;
      break;
    }
    case "year": {
      const first = dayParts(from).year;
      const last = dayParts(to).year;
      for (let y = first; y <= last; y++) buckets.push({ start: dayOf(y, 0, 1), end: dayOf(y, 11, 31) });
      indexOf = (day) => dayParts(day).year - first;
      break;
    }
  }
  return { buckets, indexOf };
}

export interface Timeline {
  granularity: Granularity;
  buckets: Bucket[];
  ms: Float64Array;
  plays: Uint32Array;
}

/** Listening per day / week / month / year across the scope's range. */
export function timeline(scope: Scope, granularity?: Granularity, subset?: Int32Array): Timeline {
  const { p, range, kinds, minMs } = scope;
  const g = granularity ?? autoGranularity(range.days);
  if (range.days === 0) return { granularity: g, buckets: [], ms: new Float64Array(0), plays: new Uint32Array(0) };
  const { buckets, indexOf } = makeBuckets(range.dataFrom, range.dataTo, g);
  const ms = new Float64Array(buckets.length);
  const plays = new Uint32Array(buckets.length);
  const kindCol = p.ds.kind;
  const msCol = p.ds.ms;
  const dayCol = p.day;
  const n = count(scope, subset);
  // Month and year lookups are cached per day: streams are sorted, so the day rarely changes.
  let cachedDay = NaN;
  let bucket = 0;
  for (let k = 0; k < n; k++) {
    const i = subset ? subset[k] : range.lo + k;
    if (!((kinds >> kindCol[i]) & 1)) continue;
    const day = dayCol[i];
    if (day !== cachedDay) {
      cachedDay = day;
      bucket = indexOf(day);
    }
    const played = msCol[i];
    ms[bucket] += played;
    if (played >= minMs) plays[bucket]++;
  }
  return { granularity: g, buckets, ms, plays };
}

/** Milliseconds listened on each day of `from..to` (defaults to the range's data span). */
export function daily(scope: Scope, from = scope.range.dataFrom, to = scope.range.dataTo): Float64Array {
  const { p, range, kinds } = scope;
  const out = new Float64Array(Math.max(0, to - from + 1));
  const kindCol = p.ds.kind;
  const msCol = p.ds.ms;
  const dayCol = p.day;
  for (let i = range.lo; i < range.hi; i++) {
    const day = dayCol[i];
    if (day < from || day > to || !((kinds >> kindCol[i]) & 1)) continue;
    out[day - from] += msCol[i];
  }
  return out;
}

/** Listening by hour of day (local time). */
export function hourly(scope: Scope, subset?: Int32Array) {
  const { p, range, kinds, minMs } = scope;
  const ms = new Float64Array(24);
  const plays = new Uint32Array(24);
  const kindCol = p.ds.kind;
  const msCol = p.ds.ms;
  const hourCol = p.hour;
  const n = count(scope, subset);
  for (let k = 0; k < n; k++) {
    const i = subset ? subset[k] : range.lo + k;
    if (!((kinds >> kindCol[i]) & 1)) continue;
    const h = hourCol[i];
    const played = msCol[i];
    ms[h] += played;
    if (played >= minMs) plays[h]++;
  }
  return { ms, plays };
}

/** Listening by weekday (0 = Monday), plus how many of each weekday the range spans for averages. */
export function weekdays(scope: Scope, subset?: Int32Array) {
  const { p, range, kinds, minMs } = scope;
  const ms = new Float64Array(7);
  const plays = new Uint32Array(7);
  const occurrences = new Uint32Array(7);
  for (let d = range.dataFrom; d <= range.dataTo; d++) occurrences[weekdayOf(d)]++;
  const kindCol = p.ds.kind;
  const msCol = p.ds.ms;
  const dayCol = p.day;
  const n = count(scope, subset);
  for (let k = 0; k < n; k++) {
    const i = subset ? subset[k] : range.lo + k;
    if (!((kinds >> kindCol[i]) & 1)) continue;
    const w = (((dayCol[i] + 3) % 7) + 7) % 7;
    const played = msCol[i];
    ms[w] += played;
    if (played >= minMs) plays[w]++;
  }
  return { ms, plays, occurrences };
}

/** A 7 × 24 grid of listening time: index `weekday * 24 + hour`. */
export function weekdayHours(scope: Scope): Float64Array {
  const { p, range, kinds } = scope;
  const grid = new Float64Array(7 * 24);
  const kindCol = p.ds.kind;
  const msCol = p.ds.ms;
  const dayCol = p.day;
  const hourCol = p.hour;
  for (let i = range.lo; i < range.hi; i++) {
    if (!((kinds >> kindCol[i]) & 1)) continue;
    grid[((((dayCol[i] + 3) % 7) + 7) % 7) * 24 + hourCol[i]] += msCol[i];
  }
  return grid;
}

export interface YearMonths {
  year: number;
  /** Listening per month, January first. */
  ms: Float64Array;
  /** Months that fall outside the data (before the first play or after the last). */
  outside: boolean[];
}

/** Listening per month for each year in range, for comparing years side by side. */
export function monthsByYear(scope: Scope): YearMonths[] {
  const { p, range, kinds } = scope;
  if (range.days === 0) return [];
  const firstYear = dayParts(range.dataFrom).year;
  const lastYear = dayParts(range.dataTo).year;
  const firstMonth = monthIndex(range.dataFrom);
  const lastMonth = monthIndex(range.dataTo);
  const rows: YearMonths[] = [];
  for (let y = firstYear; y <= lastYear; y++) {
    const outside = Array.from({ length: 12 }, (_, m) => {
      const index = (y - 1970) * 12 + m;
      return index < firstMonth || index > lastMonth;
    });
    rows.push({ year: y, ms: new Float64Array(12), outside });
  }
  const kindCol = p.ds.kind;
  const msCol = p.ds.ms;
  const dayCol = p.day;
  let cachedDay = NaN;
  let target = rows[0].ms;
  let month = 0;
  for (let i = range.lo; i < range.hi; i++) {
    if (!((kinds >> kindCol[i]) & 1)) continue;
    const day = dayCol[i];
    if (day !== cachedDay) {
      cachedDay = day;
      const parts = dayParts(day);
      target = rows[parts.year - firstYear].ms;
      month = parts.month;
    }
    target[month] += msCol[i];
  }
  return rows;
}
