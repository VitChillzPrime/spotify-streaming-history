"use client";

import { ChevronLeft, ChevronRight, EyeOff, Search, Shuffle, SkipForward, Video, WifiOff } from "lucide-react";
import { useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { useEntitySheet } from "@/components/dashboard/sheet-context";
import { useScope } from "@/components/dashboard/use-scope";
import { IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Monogram } from "@/components/ui/monogram";
import { formatClock, formatInstant, formatNumber } from "@/lib/format";
import { PLATFORM_LABELS } from "@/lib/labels";
import { FLAG, KIND } from "@/lib/model";
import { searchHistory } from "@/lib/stats/history";
import type { EntityRef } from "@/lib/stats/top";

const PAGE_SIZE = 50;

export function HistoryView() {
  const scope = useScope();
  const open = useEntitySheet();
  const { p } = scope;
  const { ds } = p;
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(() => searchHistory(scope, deferredQuery), [scope, deferredQuery]);
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const rows = results.subarray(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const describe = (i: number): { title: string; subtitle: string; seed: string; ref: EntityRef | null } => {
    const item = ds.item[i];
    switch (ds.kind[i]) {
      case KIND.track: {
        const artist = ds.artists[ds.songs.artist[item]];
        const album = ds.album[i] >= 0 ? ds.albums.name[ds.album[i]] : null;
        return {
          title: ds.songs.name[item],
          subtitle: album ? `${artist} · ${album}` : artist,
          seed: artist,
          ref: { type: "song", id: item },
        };
      }
      case KIND.episode: {
        const show = ds.shows[ds.episodes.show[item]];
        return { title: ds.episodes.name[item], subtitle: show, seed: show, ref: { type: "episode", id: item } };
      }
      case KIND.audiobook: {
        const book = ds.books.title[ds.chapters.book[item]];
        return { title: ds.chapters.title[item], subtitle: book, seed: book, ref: { type: "book", id: ds.chapters.book[item] } };
      }
      default:
        return { title: "Unknown", subtitle: "No details in the export", seed: "?", ref: null };
    }
  };

  return (
    <>
      <PageHeader title="History" kinds />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 sm:max-w-sm">
          <span className="sr-only">Search your history</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Search songs, artists, albums, shows…"
            className="h-9 w-full rounded-xl border border-line bg-surface pr-3 pl-9 text-[13px] text-ink shadow-card placeholder:text-ink-3"
          />
        </label>
        <p className="text-[13px] text-ink-3 tabular" aria-live="polite">
          {formatNumber(results.length)} {results.length === 1 ? "play" : "plays"}
        </p>
      </div>

      {results.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface shadow-card">
          <EmptyState icon={<Search />} title="No plays found">
            {query ? "Try another search, or widen the date range." : "Nothing was played in this range."}
          </EmptyState>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <table className="w-full table-fixed border-collapse text-left">
            <thead>
              <tr className="border-b border-line text-xs text-ink-3">
                <th scope="col" className="w-[104px] py-2.5 pr-3 pl-4 font-medium sm:w-44">When</th>
                <th scope="col" className="py-2.5 pr-3 font-medium">Played</th>
                <th scope="col" className="w-16 py-2.5 pr-3 text-right font-medium sm:w-20">Length</th>
                <th scope="col" className="hidden w-32 py-2.5 pr-3 font-medium md:table-cell">Device</th>
                <th scope="col" className="hidden w-28 py-2.5 pr-4 font-medium sm:table-cell">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from(rows, (i) => {
                const info = describe(i);
                const flags = ds.flags[i];
                return (
                  <tr key={i} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="py-2 pr-3 pl-4 align-middle text-xs leading-4 text-ink-3 tabular">
                      <span className="block text-ink-2">{formatInstant(p.start[i], p.timeZone, { dateStyle: "medium" })}</span>
                      {formatInstant(p.start[i], p.timeZone, { timeStyle: "short" })}
                    </td>
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        disabled={!info.ref}
                        onClick={() => info.ref && open(info.ref)}
                        className="flex w-full min-w-0 items-center gap-3 text-left disabled:cursor-default"
                      >
                        <span className="hidden sm:block">
                          <Monogram name={info.title} seed={info.seed} size="sm" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-ink">{info.title}</span>
                          <span className="block truncate text-xs text-ink-3">{info.subtitle}</span>
                        </span>
                      </button>
                    </td>
                    <td className="py-2 pr-3 text-right text-xs text-ink-2 tabular">{formatClock(ds.ms[i])}</td>
                    <td className="hidden truncate py-2 pr-3 text-xs text-ink-3 md:table-cell" title={ds.platforms[ds.platform[i]]}>
                      {PLATFORM_LABELS[p.platformGroups[ds.platform[i]]]}
                    </td>
                    <td className="hidden py-2 pr-4 sm:table-cell">
                      <span className="flex items-center gap-1.5 text-ink-3">
                        {flags & FLAG.skipped ? <Flag label="Skipped" icon={<SkipForward />} /> : null}
                        {flags & FLAG.shuffle ? <Flag label="Shuffle" icon={<Shuffle />} /> : null}
                        {flags & FLAG.offline ? <Flag label="Offline" icon={<WifiOff />} /> : null}
                        {flags & FLAG.video ? <Flag label="Video" icon={<Video />} /> : null}
                        {flags & FLAG.incognito ? <Flag label="Private session" icon={<EyeOff />} /> : null}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-center gap-3">
          <IconButton label="Previous page" disabled={current === 0} onClick={() => setPage(current - 1)} className="disabled:opacity-40">
            <ChevronLeft />
          </IconButton>
          <span className="text-[13px] text-ink-3 tabular">
            Page {formatNumber(current + 1)} of {formatNumber(pages)}
          </span>
          <IconButton
            label="Next page"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
            className="disabled:opacity-40"
          >
            <ChevronRight />
          </IconButton>
        </nav>
      )}
    </>
  );
}

function Flag({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <span title={label} className="[&_svg]:size-3.5">
      {icon}
      <span className="sr-only">{label}</span>
    </span>
  );
}
