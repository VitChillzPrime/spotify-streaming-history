import { jsonStore } from "@/lib/local-store";
import type { RangeSpec } from "@/lib/range";
import { DEFAULT_MIN_MS, KINDS } from "@/lib/stats/scope";
import { isValidTimeZone, systemTimeZone } from "@/lib/time";

export interface Settings {
  /** "auto" follows the browser; otherwise an IANA zone such as "Europe/London". */
  timeZone: string;
  /** Minimum play length that counts as a stream. */
  minMs: number;
}

export const DEFAULT_SETTINGS: Settings = { timeZone: "auto", minMs: DEFAULT_MIN_MS };

export const settingsStore = jsonStore<Settings>("encore-settings", DEFAULT_SETTINGS, (value) => {
  if (typeof value !== "object" || value === null) return null;
  const { timeZone, minMs } = value as Partial<Settings>;
  return {
    timeZone: typeof timeZone === "string" ? timeZone : DEFAULT_SETTINGS.timeZone,
    minMs: typeof minMs === "number" && minMs >= 0 ? minMs : DEFAULT_SETTINGS.minMs,
  };
});

export function effectiveTimeZone(settings: Settings): string {
  if (settings.timeZone !== "auto" && isValidTimeZone(settings.timeZone)) return settings.timeZone;
  return systemTimeZone();
}

export type KindFilter = "all" | "music" | "podcasts" | "audiobooks";

export const KIND_FILTER_MASK: Record<KindFilter, number> = {
  all: KINDS.all,
  music: KINDS.music,
  podcasts: KINDS.podcasts,
  audiobooks: KINDS.audiobooks,
};

export interface Filters {
  range: RangeSpec;
  kind: KindFilter;
}

export const DEFAULT_FILTERS: Filters = { range: { type: "all" }, kind: "all" };

function parseRange(value: unknown): RangeSpec | null {
  if (typeof value !== "object" || value === null) return null;
  const spec = value as Record<string, unknown>;
  switch (spec.type) {
    case "all":
      return { type: "all" };
    case "year":
      return typeof spec.year === "number" ? { type: "year", year: spec.year } : null;
    case "recent":
      return typeof spec.days === "number" ? { type: "recent", days: spec.days } : null;
    case "custom":
      return typeof spec.from === "number" && typeof spec.to === "number"
        ? { type: "custom", from: spec.from, to: spec.to }
        : null;
    default:
      return null;
  }
}

export const filtersStore = jsonStore<Filters>("encore-filters", DEFAULT_FILTERS, (value) => {
  if (typeof value !== "object" || value === null) return null;
  const { range, kind } = value as Record<string, unknown>;
  return {
    range: parseRange(range) ?? DEFAULT_FILTERS.range,
    kind: kind === "music" || kind === "podcasts" || kind === "audiobooks" ? kind : "all",
  };
});
