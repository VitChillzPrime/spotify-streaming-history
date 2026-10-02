"use client";

import { useMemo } from "react";
import { usePrepared } from "@/components/data-provider";
import { KIND } from "@/lib/model";
import { isRangeValid, resolveRange, type RangeSpec } from "@/lib/range";
import { filtersStore, KIND_FILTER_MASK, settingsStore, type KindFilter } from "@/lib/settings";
import type { Scope } from "@/lib/stats/scope";

const ALL_TIME: RangeSpec = { type: "all" };

/** Content kinds present in the data, in display order. */
export function useAvailableKinds(): KindFilter[] {
  const p = usePrepared();
  return useMemo(() => {
    const kinds: KindFilter[] = [];
    if (p.kindCounts[KIND.track]) kinds.push("music");
    if (p.kindCounts[KIND.episode]) kinds.push("podcasts");
    if (p.kindCounts[KIND.audiobook]) kinds.push("audiobooks");
    return kinds;
  }, [p]);
}

/**
 * The scope every dashboard statistic is computed over: the saved date range
 * and content filter applied to the prepared data. Falls back gracefully when
 * a saved filter doesn't fit newly imported data.
 */
export function useScope(): Scope {
  const p = usePrepared();
  const [filters] = filtersStore.useValue();
  const [settings] = settingsStore.useValue();
  const available = useAvailableKinds();
  const spec = isRangeValid(p, filters.range) ? filters.range : ALL_TIME;
  const kind = filters.kind === "all" || available.includes(filters.kind) ? filters.kind : "all";
  const range = useMemo(() => resolveRange(p, spec), [p, spec]);
  return useMemo(
    () => ({ p, range, kinds: KIND_FILTER_MASK[kind], minMs: settings.minMs }),
    [p, range, kind, settings.minMs],
  );
}
