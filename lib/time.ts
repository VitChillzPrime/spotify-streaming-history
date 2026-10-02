export const MINUTE_MS = 60_000;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/** The viewer's own IANA time zone, e.g. `Europe/London`. */
export function systemTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a function giving the UTC offset (in ms) of `timeZone` at an instant.
 * Offsets are cached per 6-hour block; blocks that contain a DST change fall
 * back to 15-minute resolution so half-hour transitions stay exact.
 */
export function offsetResolver(timeZone: string): (t: number) => number {
  if (timeZone === "UTC" || timeZone === "Etc/UTC") return () => 0;
  const offsetAt = timeZone === systemTimeZone() ? systemOffset : intlOffset(timeZone);

  const BLOCK = 6 * HOUR_MS;
  const FINE = 15 * MINUTE_MS;
  const blocks = new Map<number, number | null>();
  const fine = new Map<number, number>();
  return (t) => {
    const block = Math.floor(t / BLOCK);
    let offset = blocks.get(block);
    if (offset === undefined) {
      const first = offsetAt(block * BLOCK);
      offset = first === offsetAt((block + 1) * BLOCK - 1000) ? first : null;
      blocks.set(block, offset);
    }
    if (offset !== null) return offset;
    const slot = Math.floor(t / FINE);
    let exact = fine.get(slot);
    if (exact === undefined) {
      exact = offsetAt(slot * FINE);
      fine.set(slot, exact);
    }
    return exact;
  };
}

function systemOffset(t: number): number {
  return -new Date(t).getTimezoneOffset() * MINUTE_MS;
}

function intlOffset(timeZone: string): (t: number) => number {
  const format = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
  return (instant) => {
    const at = Math.floor(instant / 1000) * 1000;
    const f: Record<string, number> = {};
    for (const part of format.formatToParts(at)) f[part.type] = Number(part.value);
    return Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second) - at;
  };
}

// "Day numbers" count local calendar days since 1970-01-01. They make date
// arithmetic trivial and are converted back to dates via UTC.

export function dayOf(year: number, month: number, date: number): number {
  return Math.round(Date.UTC(year, month, date) / DAY_MS);
}

export function dayToDate(day: number): Date {
  return new Date(day * DAY_MS);
}

export function dayParts(day: number): { year: number; month: number; date: number } {
  const d = dayToDate(day);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), date: d.getUTCDate() };
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayOf(day: number): number {
  return (((day + 3) % 7) + 7) % 7;
}

/** Day number of the Monday starting the week that contains `day`. */
export function weekStart(day: number): number {
  return day - weekdayOf(day);
}

/** Months since January 1970, handy as a month bucket key. */
export function monthIndex(day: number): number {
  const { year, month } = dayParts(day);
  return year * 12 + month - 1970 * 12;
}

export function monthIndexToStartDay(index: number): number {
  const total = index + 1970 * 12;
  return dayOf(Math.floor(total / 12), total % 12, 1);
}

/** Today's day number in a time zone. */
export function today(timeZone: string): number {
  const now = Date.now();
  return Math.floor((now + offsetResolver(timeZone)(now)) / DAY_MS);
}
