import { formatDay, formatDayRange } from "@/lib/format";
import type { Prepared } from "@/lib/prepare";
import { dayOf } from "@/lib/time";

export type RangeSpec =
  | { type: "all" }
  | { type: "year"; year: number }
  /** The last N days of the data (exports are snapshots, so "recent" is relative to the last play). */
  | { type: "recent"; days: number }
  | { type: "custom"; from: number; to: number };

export interface Range {
  spec: RangeSpec;
  /** Requested first and last day (inclusive). */
  fromDay: number;
  toDay: number;
  /** The part of the request that overlaps the data, for per-day averages. */
  dataFrom: number;
  dataTo: number;
  /** Number of days in `dataFrom..dataTo` (0 when the range has no data). */
  days: number;
  /** Stream index slice `[lo, hi)`. */
  lo: number;
  hi: number;
}

export const RECENT_PRESETS = [
  { days: 28, label: "Last 4 weeks" },
  { days: 91, label: "Last 3 months" },
  { days: 182, label: "Last 6 months" },
  { days: 365, label: "Last 12 months" },
] as const;

/** First index whose value is >= target. */
function lowerBound(values: Int32Array, target: number): number {
  let lo = 0;
  let hi = values.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (values[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function resolveRange(p: Prepared, spec: RangeSpec): Range {
  let fromDay = p.firstDay;
  let toDay = p.lastDay;
  if (spec.type === "year") {
    fromDay = dayOf(spec.year, 0, 1);
    toDay = dayOf(spec.year, 11, 31);
  } else if (spec.type === "recent") {
    toDay = p.lastDay;
    fromDay = p.lastDay - spec.days + 1;
  } else if (spec.type === "custom") {
    fromDay = Math.min(spec.from, spec.to);
    toDay = Math.max(spec.from, spec.to);
  }
  const lo = lowerBound(p.day, fromDay);
  const hi = lowerBound(p.day, toDay + 1);
  const dataFrom = Math.max(fromDay, p.firstDay);
  const dataTo = Math.min(toDay, p.lastDay);
  return {
    spec,
    fromDay,
    toDay,
    dataFrom,
    dataTo,
    days: Math.max(0, dataTo - dataFrom + 1),
    lo,
    hi,
  };
}

/** Whether a spec still makes sense for this data (e.g. a saved year that isn't in a new upload). */
export function isRangeValid(p: Prepared, spec: RangeSpec): boolean {
  if (spec.type === "year") return p.years.includes(spec.year);
  if (spec.type === "custom") return Number.isFinite(spec.from) && Number.isFinite(spec.to);
  if (spec.type === "recent") return spec.days > 0;
  return true;
}

export function rangeLabel(spec: RangeSpec): string {
  switch (spec.type) {
    case "all":
      return "All time";
    case "year":
      return String(spec.year);
    case "recent":
      return RECENT_PRESETS.find((preset) => preset.days === spec.days)?.label ?? `Last ${spec.days} days`;
    case "custom":
      return formatDayRange(Math.min(spec.from, spec.to), Math.max(spec.from, spec.to));
  }
}

/** "Mar 28, 2023 – Sep 30, 2026" for the part of the range that has data. */
export function rangeSpan(range: Range): string {
  if (range.days === 0) return `${formatDay(range.fromDay)} – ${formatDay(range.toDay)}`;
  return formatDayRange(range.dataFrom, range.dataTo);
}
