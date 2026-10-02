import { formatDay, formatDayLong, formatMonthLong, formatMonthShort } from "@/lib/format";
import type { Bucket, Granularity } from "@/lib/stats/time";
import { dayParts } from "@/lib/time";

export interface Tick {
  index: number;
  label: string;
}

export interface PlacedTick extends Tick {
  x: number;
  anchor: "start" | "middle" | "end";
}

/**
 * Positions axis labels and drops any that would overlap a neighbour
 * (estimating ~6.4px per character at 11px). Year labels win over month labels.
 */
export function placeTicks(ticks: Tick[], x: (index: number) => number, left: number, right: number): PlacedTick[] {
  const CHAR = 6.4;
  const PAD = 10;
  const extent = (tick: PlacedTick) => {
    const width = tick.label.length * CHAR;
    if (tick.anchor === "start") return [tick.x, tick.x + width];
    if (tick.anchor === "end") return [tick.x - width, tick.x];
    return [tick.x - width / 2, tick.x + width / 2];
  };
  const isYear = (tick: Tick) => /^\d{4}$/.test(tick.label);
  const kept: PlacedTick[] = [];
  for (const tick of ticks) {
    const px = x(tick.index);
    const half = (tick.label.length * CHAR) / 2;
    const anchor = px - half < left ? "start" : px + half > right ? "end" : "middle";
    const placed: PlacedTick = { ...tick, x: px, anchor };
    const previous = kept[kept.length - 1];
    if (!previous || extent(previous)[1] + PAD <= extent(placed)[0]) {
      kept.push(placed);
    } else if (isYear(placed) && !isYear(previous)) {
      kept.pop();
      const before = kept[kept.length - 1];
      if (!before || extent(before)[1] + PAD <= extent(placed)[0]) kept.push(placed);
    }
  }
  return kept;
}

/** The full name of a time bucket, for tooltips and tables. */
export function bucketLabel(bucket: Bucket, granularity: Granularity): string {
  switch (granularity) {
    case "day":
      return formatDayLong(bucket.start);
    case "week":
      return `Week of ${formatDay(bucket.start)}`;
    case "month":
      return formatMonthLong(bucket.start);
    case "year":
      return String(dayParts(bucket.start).year);
  }
}

const shortDay = (day: number) => formatDay(day, { month: "short", day: "numeric" });

function everyNth(count: number, maxTicks: number, steps: number[]): number {
  return steps.find((step) => Math.ceil(count / step) <= maxTicks) ?? Math.ceil(count / Math.max(1, maxTicks));
}

/**
 * Axis labels at regular intervals that fit `maxTicks`: every 1, 2, 3, 6 or 12
 * months for monthly and weekly data (years label January), every 1, 2, 7 or
 * 14 days for daily data.
 */
export function timeTicks(buckets: Bucket[], granularity: Granularity, maxTicks: number): Tick[] {
  const n = buckets.length;
  if (n === 0) return [];

  if (granularity === "year") {
    const step = everyNth(n, maxTicks, [1, 2, 5, 10]);
    return buckets.flatMap((bucket, index) =>
      index % step === 0 ? [{ index, label: String(dayParts(bucket.start).year) }] : [],
    );
  }

  if (granularity === "day") {
    const step = everyNth(n, maxTicks, [1, 2, 7, 14, 28]);
    return buckets.flatMap((bucket, index) => (index % step === 0 ? [{ index, label: shortDay(bucket.start) }] : []));
  }

  // Weeks and months: one candidate per calendar month, at its first bucket.
  const months: { index: number; year: number; month: number }[] = [];
  for (let index = 0; index < n; index++) {
    // A week belongs to the month its Thursday falls in, so labels don't sit on the previous month.
    const anchor = granularity === "week" ? buckets[index].start + 3 : buckets[index].start;
    const { year, month } = dayParts(anchor);
    const last = months[months.length - 1];
    if (!last || last.year !== year || last.month !== month) months.push({ index, year, month });
  }
  const label = (m: { year: number; month: number; index: number }, first: boolean) => {
    const name = formatMonthShort(buckets[m.index].start + (granularity === "week" ? 3 : 0));
    if (m.month === 0) return String(m.year);
    return first ? `${name} ${m.year}` : name;
  };

  for (const step of [1, 2, 3, 6, 12]) {
    const picked = months.filter((m) => m.month % step === 0);
    if (picked.length > 0 && picked.length <= maxTicks) {
      return picked.map((m, i) => ({ index: m.index, label: label(m, i === 0) }));
    }
  }
  // Many years: label every k-th January.
  const januaries = months.filter((m) => m.month === 0);
  const stride = Math.ceil(januaries.length / Math.max(1, maxTicks));
  return januaries.filter((_, i) => i % stride === 0).map((m) => ({ index: m.index, label: String(m.year) }));
}
