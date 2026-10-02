import { DAY_MS, HOUR_MS, MINUTE_MS, dayToDate } from "@/lib/time";

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const decimalFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
const compactFormat = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const percentFormat = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 0 });
const precisePercentFormat = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 });

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatDecimal(value: number): string {
  return decimalFormat.format(value);
}

/** 1,284 · 12.9K · 4.2M */
export function formatCompact(value: number): string {
  return value < 10_000 ? numberFormat.format(value) : compactFormat.format(value);
}

export function formatPercent(ratio: number, precise = false): string {
  if (!Number.isFinite(ratio)) return "n/a";
  if (!precise && ratio > 0 && ratio < 0.01) return "<1%";
  return (precise ? precisePercentFormat : percentFormat).format(ratio);
}

export function toHours(ms: number): number {
  return ms / HOUR_MS;
}

export function toMinutes(ms: number): number {
  return ms / MINUTE_MS;
}

/** Hours as a figure: 7,403 · 12.5 · 0.4 */
export function formatHours(ms: number): string {
  const hours = ms / HOUR_MS;
  return hours >= 100 ? numberFormat.format(hours) : decimalFormat.format(hours);
}

/** A human duration: 45s · 12m · 3h 25m · 1,204h */
export function formatDuration(ms: number): string {
  if (ms < MINUTE_MS) return `${Math.round(ms / 1000)}s`;
  if (ms < HOUR_MS) return `${Math.round(ms / MINUTE_MS)}m`;
  const hours = Math.floor(ms / HOUR_MS);
  if (hours >= 100) return `${numberFormat.format(Math.round(ms / HOUR_MS))}h`;
  const minutes = Math.round((ms - hours * HOUR_MS) / MINUTE_MS);
  if (minutes === 60) return `${hours + 1}h`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

/** Track-style length: 3:07 · 1:02:44 */
export function formatClock(ms: number): string {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function formatDays(ms: number): string {
  return decimalFormat.format(ms / DAY_MS);
}

// Dates. Day numbers are calendar days, so they are always formatted in UTC.

const dayFormats = new Map<string, Intl.DateTimeFormat>();
function dayFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let format = dayFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" });
    dayFormats.set(key, format);
  }
  return format;
}

/** Mar 28, 2023 */
export function formatDay(day: number, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }): string {
  return dayFormat(options).format(dayToDate(day));
}

/** Tue, Mar 28, 2023 */
export function formatDayLong(day: number): string {
  return dayFormat({ weekday: "short", year: "numeric", month: "short", day: "numeric" }).format(dayToDate(day));
}

/** Mar 2023 */
export function formatMonth(day: number): string {
  return dayFormat({ month: "short", year: "numeric" }).format(dayToDate(day));
}

/** March 2023 */
export function formatMonthLong(day: number): string {
  return dayFormat({ month: "long", year: "numeric" }).format(dayToDate(day));
}

/** Mar */
export function formatMonthShort(day: number): string {
  return dayFormat({ month: "short" }).format(dayToDate(day));
}

/**
 * "Mar 4 to Sep 30, 2026" or "Mar 28, 2023 to Sep 30, 2026". Written out by hand
 * because Intl's formatRange joins the two dates with an en dash.
 */
export function formatDayRange(from: number, to: number): string {
  if (from === to) return formatDay(from);
  const sameYear = dayToDate(from).getUTCFullYear() === dayToDate(to).getUTCFullYear();
  const start = sameYear ? formatDay(from, { month: "short", day: "numeric" }) : formatDay(from);
  return `${start} to ${formatDay(to)}`;
}

/** "9 PM" / "21" depending on the viewer's locale. */
export function formatHour(hour: number): string {
  return dayFormat({ hour: "numeric" }).format(new Date(Date.UTC(2000, 0, 1, hour)));
}

/** Weekday name with 0 = Monday. */
export function formatWeekday(weekday: number, style: "short" | "long" | "narrow" = "short"): string {
  // 2024-01-01 was a Monday.
  return dayFormat({ weekday: style }).format(new Date(Date.UTC(2024, 0, 1 + weekday)));
}

const instantFormats = new Map<string, Intl.DateTimeFormat>();
/** Formats an instant in the chosen time zone: "Mar 28, 2023, 4:40 PM". */
export function formatInstant(
  t: number,
  timeZone: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  let format = instantFormats.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(undefined, { ...options, timeZone });
    instantFormats.set(key, format);
  }
  return format.format(new Date(t));
}

let regionNames: Intl.DisplayNames | null | undefined;
export function countryName(code: string): string {
  if (code === "ZZ") return "Unknown";
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(undefined, { type: "region" });
    } catch {
      regionNames = null;
    }
  }
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${formatNumber(count)} ${count === 1 ? one : many}`;
}
