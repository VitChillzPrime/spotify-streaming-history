import { platformGroup, type PlatformGroup } from "@/lib/labels";
import type { Dataset } from "@/lib/model";
import { DAY_MS, HOUR_MS, dayParts, offsetResolver } from "@/lib/time";

/** A dataset plus columns derived for one time zone. Recomputed when the zone changes. */
export interface Prepared {
  ds: Dataset;
  timeZone: string;
  /** Epoch ms when each stream started (`end` minus time played). */
  start: Float64Array;
  /** Local day number of each start. Non-decreasing, so date ranges are index ranges. */
  day: Int32Array;
  /** Local hour (0 to 23) of each start. */
  hour: Uint8Array;
  firstDay: number;
  lastDay: number;
  /** Calendar years with any listening, ascending. */
  years: number[];
  /** Number of streams per `KIND`. */
  kindCounts: number[];
  /** Platform group of each entry in `ds.platforms`. */
  platformGroups: PlatformGroup[];
}

export function prepare(ds: Dataset, timeZone: string): Prepared {
  const n = ds.size;
  const start = new Float64Array(n);
  const day = new Int32Array(n);
  const hour = new Uint8Array(n);
  const offset = offsetResolver(timeZone);
  const kindCounts = [0, 0, 0, 0];
  const years = new Set<number>();

  const endCol = ds.end;
  const msCol = ds.ms;
  const kindCol = ds.kind;
  let previousDay = -Infinity;
  for (let i = 0; i < n; i++) {
    const t = endCol[i] - msCol[i];
    start[i] = t;
    const local = t + offset(t);
    const localDay = Math.floor(local / DAY_MS);
    // Zones that fall back at midnight can step a day backwards for an hour; keep days ordered.
    const d = localDay < previousDay ? previousDay : localDay;
    previousDay = d;
    day[i] = d;
    hour[i] = Math.floor((local - localDay * DAY_MS) / HOUR_MS);
    kindCounts[kindCol[i]]++;
  }

  const firstDay = n ? day[0] : 0;
  const lastDay = n ? day[n - 1] : 0;
  if (n) {
    for (let y = dayParts(firstDay).year; y <= dayParts(lastDay).year; y++) years.add(y);
  }

  return {
    ds,
    timeZone,
    start,
    day,
    hour,
    firstDay,
    lastDay,
    years: [...years],
    kindCounts,
    platformGroups: ds.platforms.map(platformGroup),
  };
}
