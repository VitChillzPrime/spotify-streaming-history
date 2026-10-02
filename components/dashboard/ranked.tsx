"use client";

import { Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Meter, Sparkline } from "@/components/charts/parts";
import { useEntitySheet } from "@/components/dashboard/sheet-context";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Monogram } from "@/components/ui/monogram";
import { Segmented } from "@/components/ui/segmented";
import { formatDay, formatDuration, formatNumber, formatPercent } from "@/lib/format";
import type { Dataset } from "@/lib/model";
import { firstPlays } from "@/lib/stats/discovery";
import { cached } from "@/lib/stats/cache";
import { entityLabel } from "@/lib/stats/entity";
import { normalizeText } from "@/lib/stats/history";
import type { Scope } from "@/lib/stats/scope";
import { autoGranularity } from "@/lib/stats/time";
import { rank, seriesFor, type EntityRef, type EntityType, type RankBy, type Ranked } from "@/lib/stats/top";
import { cn } from "@/lib/ui";

export const RANK_OPTIONS = [
  { value: "time", label: "Time" },
  { value: "plays", label: "Streams" },
] as const satisfies readonly { value: RankBy; label: string }[];

/** Name, tint seed and shape of an entity's monogram. */
export function entityVisual(ds: Dataset, ref: EntityRef) {
  const label = entityLabel(ds, ref);
  return {
    ...label,
    seed: ref.type === "song" || ref.type === "album" ? label.subtitle : ref.type === "episode" ? label.subtitle : label.title,
    round: ref.type === "artist",
  };
}

/** A compact top-N list with relative bars, e.g. on the overview. */
export function RankedList({
  ds,
  type,
  entries,
  by,
  start = 1,
  className,
}: {
  ds: Dataset;
  type: EntityType;
  entries: Ranked[];
  by: RankBy;
  start?: number;
  className?: string;
}) {
  const open = useEntitySheet();
  const max = Math.max(1, ...entries.map((entry) => (by === "time" ? entry.ms : entry.plays)));
  return (
    <ol className={cn("-mx-2", className)}>
      {entries.map((entry, i) => {
        const ref = { type, id: entry.id };
        const visual = entityVisual(ds, ref);
        const primary = by === "time" ? formatDuration(entry.ms) : formatNumber(entry.plays);
        const secondary = by === "time" ? `${formatNumber(entry.plays)} streams` : formatDuration(entry.ms);
        return (
          <li key={entry.id}>
            <button
              type="button"
              onClick={() => open(ref)}
              className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-2"
            >
              <span className="w-5 shrink-0 text-right text-[13px] font-medium text-ink-3 tabular">{start + i}</span>
              <Monogram name={visual.title} seed={visual.seed} round={visual.round} />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium text-ink">{visual.title}</span>
                  <span className="shrink-0 text-[13px] font-semibold text-ink tabular">{primary}</span>
                </span>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-xs text-ink-3">{visual.subtitle ?? " "}</span>
                  <span className="shrink-0 text-xs text-ink-3 tabular">{secondary}</span>
                </span>
                <Meter value={(by === "time" ? entry.ms : entry.plays) / max} className="mt-1.5 h-1" />
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

const PAGE = 50;

/** The full ranking for a page: search, time/streams toggle, share, trend and first listen. */
export function RankedTable({ scope, type, noun }: { scope: Scope; type: EntityType; noun: string }) {
  const open = useEntitySheet();
  const { ds } = scope.p;
  const [by, setBy] = useState<RankBy>("time");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const deferredQuery = useDeferredValue(query);

  const ranked = useMemo(() => cached(scope, `rank:${type}:${by}`, () => rank(scope, type, by)), [scope, type, by]);
  const total = useMemo(() => ranked.reduce((sum, entry) => sum + (by === "time" ? entry.ms : entry.plays), 0), [ranked, by]);
  const filtered = useMemo(() => {
    const q = normalizeText(deferredQuery.trim());
    if (!q) return ranked.map((entry, index) => ({ entry, position: index + 1 }));
    return ranked
      .map((entry, index) => ({ entry, position: index + 1 }))
      .filter(({ entry }) => {
        const label = entityLabel(ds, { type, id: entry.id });
        return normalizeText(`${label.title} ${label.subtitle ?? ""}`).includes(q);
      });
  }, [ranked, deferredQuery, ds, type]);
  const visible = filtered.slice(0, limit);

  const ids = useMemo(() => visible.map(({ entry }) => entry.id), [visible]);
  const trends = useMemo(() => {
    const granularity = autoGranularity(scope.range.days) === "day" ? "day" : scope.range.days > 400 ? "month" : "week";
    return seriesFor(scope, type, ids, granularity).series;
  }, [scope, type, ids]);
  const firsts = useMemo(
    () => (type === "song" || type === "artist" || type === "album" ? firstPlays(scope.p, scope.minMs)[type] : null),
    [scope.p, scope.minMs, type],
  );
  const metric = (entry: Ranked) => (by === "time" ? entry.ms : entry.plays);
  const top = ranked[0] ? metric(ranked[0]) : 1;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Search {noun}s</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(PAGE);
            }}
            placeholder={`Search ${formatNumber(ranked.length)} ${noun}s`}
            className="h-9 w-full rounded-xl border border-line bg-surface pr-3 pl-9 text-[13px] text-ink shadow-card placeholder:text-ink-3"
          />
        </label>
        <Segmented label="Rank by" value={by} options={RANK_OPTIONS} onChange={setBy} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Search />} title={query ? "No matches" : `No ${noun}s in this range`}>
          {query ? "Try a different spelling, or widen the date range." : "Pick a wider date range to see more."}
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <table className="w-full table-fixed border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-xs text-ink-3">
                <th scope="col" className="w-12 py-2.5 pr-2 pl-4 text-right font-medium">#</th>
                <th scope="col" className="py-2.5 pr-3 pl-3 font-medium capitalize">{noun}</th>
                <th scope="col" className="hidden w-28 py-2.5 pr-3 text-right font-medium sm:table-cell">Streams</th>
                <th scope="col" className="w-24 py-2.5 pr-3 text-right font-medium sm:w-28">Time</th>
                <th scope="col" className="hidden w-36 py-2.5 pr-3 font-medium lg:table-cell">Share</th>
                <th scope="col" className="hidden w-32 py-2.5 pr-3 font-medium md:table-cell">Trend</th>
                {firsts && <th scope="col" className="hidden w-32 py-2.5 pr-4 font-medium xl:table-cell">First streamed</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map(({ entry, position }, row) => {
                const ref = { type, id: entry.id };
                const visual = entityVisual(ds, ref);
                const share = total ? metric(entry) / total : 0;
                const first = firsts?.[entry.id] ?? -1;
                return (
                  <tr
                    key={entry.id}
                    className="group cursor-pointer border-b border-line transition-colors last:border-0 hover:bg-surface-2"
                    onClick={() => open(ref)}
                  >
                    <td className="py-2.5 pr-2 pl-4 text-right text-[13px] font-medium text-ink-3 tabular">{position}</td>
                    <td className="py-2.5 pr-3 pl-3">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          open(ref);
                        }}
                        className="flex w-full min-w-0 items-center gap-3 text-left"
                      >
                        <Monogram name={visual.title} seed={visual.seed} round={visual.round} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-ink group-hover:underline group-hover:decoration-line-strong group-hover:underline-offset-2">
                            {visual.title}
                          </span>
                          {visual.subtitle && <span className="block truncate text-xs text-ink-3">{visual.subtitle}</span>}
                          <span className="block text-xs text-ink-3 tabular sm:hidden">{formatNumber(entry.plays)} streams</span>
                        </span>
                      </button>
                    </td>
                    <td className="hidden py-2.5 pr-3 text-right text-[13px] text-ink-2 tabular sm:table-cell">
                      {formatNumber(entry.plays)}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-[13px] font-medium text-ink tabular">{formatDuration(entry.ms)}</td>
                    <td className="hidden py-2.5 pr-3 lg:table-cell">
                      <div className="flex items-center gap-2">
                        <Meter value={metric(entry) / top} className="h-1" />
                        <span className="w-10 shrink-0 text-right text-xs text-ink-3 tabular">{formatPercent(share)}</span>
                      </div>
                    </td>
                    <td className="hidden py-2.5 pr-3 md:table-cell">
                      <Sparkline values={trends[row] ?? []} width={104} height={26} />
                    </td>
                    {firsts && (
                      <td className="hidden py-2.5 pr-4 text-xs text-ink-3 tabular xl:table-cell">
                        {first >= 0 ? formatDay(scope.p.day[first]) : "n/a"}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filtered.length > limit && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <Button onClick={() => setLimit((value) => value + PAGE)}>Show {Math.min(PAGE, filtered.length - limit)} more</Button>
          <span className="text-xs text-ink-3 tabular">
            {formatNumber(limit)} of {formatNumber(filtered.length)}
          </span>
        </div>
      )}
    </div>
  );
}
