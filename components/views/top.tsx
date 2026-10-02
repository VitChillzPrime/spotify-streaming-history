"use client";

import { Music } from "lucide-react";
import { useMemo } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { RankedTable } from "@/components/dashboard/ranked";
import { useEntitySheet } from "@/components/dashboard/sheet-context";
import { useScope } from "@/components/dashboard/use-scope";
import { GenresCard } from "@/components/spotify/genres-card";
import { SavePlaylistButton } from "@/components/spotify/save-playlist";
import { EntityArt } from "@/components/ui/entity-art";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { entityVisual } from "@/lib/artwork";
import { formatDuration, formatNumber, formatPercent } from "@/lib/format";
import { rangeLabel, rangeSpan } from "@/lib/range";
import type { Scope } from "@/lib/stats/scope";
import { cached } from "@/lib/stats/cache";
import { rank, type EntityType, type Ranked } from "@/lib/stats/top";
import { cn } from "@/lib/ui";

const MEDAL = ["text-[#b8860b] dark:text-[#e6b84d]", "text-ink-3", "text-[#a0612f] dark:text-[#d39b6a]"];

function Podium({ scope, type, entries }: { scope: Scope; type: EntityType; entries: Ranked[] }) {
  const open = useEntitySheet();
  const { ds } = scope.p;
  return (
    <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
      {entries.map((entry, i) => {
        const ref = { type, id: entry.id };
        const visual = entityVisual(ds, ref);
        return (
          <button
            key={entry.id}
            type="button"
            onClick={() => open(ref)}
            style={{ animationDelay: `${i * 60}ms` }}
            className="group relative flex animate-rise items-center gap-4 overflow-hidden rounded-2xl border border-line bg-surface p-4 text-left shadow-card transition-colors hover:bg-surface-2 sm:flex-col sm:items-start sm:p-5"
          >
            <span className={cn("absolute top-3 right-4 text-[44px] leading-none font-semibold tracking-[-0.05em] opacity-90 tabular", MEDAL[i])}>
              {i + 1}
            </span>
            <EntityArt ds={ds} entity={ref} size="lg" className="sm:size-16" />
            <span className="min-w-0 sm:mt-1">
              <span className="block truncate pr-10 text-[17px] font-semibold tracking-[-0.015em] text-ink sm:pr-0">{visual.title}</span>
              {visual.subtitle && <span className="block truncate text-[13px] text-ink-3">{visual.subtitle}</span>}
              <span className="mt-2 block text-[13px] text-ink-2 tabular">
                <span className="font-semibold text-ink">{formatDuration(entry.ms)}</span> · {formatNumber(entry.plays)} streams
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function TopView({ type, title, noun }: { type: EntityType; title: string; noun: string }) {
  const scope = useScope();
  const ranked = useMemo(() => cached(scope, `rank:${type}:time`, () => rank(scope, type, "time")), [scope, type]);
  const total = ranked.reduce((sum, entry) => sum + entry.ms, 0);
  const topTen = ranked.slice(0, 10).reduce((sum, entry) => sum + entry.ms, 0);
  const { ds } = scope.p;
  const hasLinks = useMemo(() => ds.songs.uri.some((uri) => uri.startsWith("spotify:track:")), [ds]);

  return (
    <>
      <PageHeader title={title}>
        {type === "song" && ranked.length > 0 && (
          <SavePlaylistButton
            available={hasLinks}
            label="Save top 50"
            name={`Encore · Top 50 tracks · ${rangeLabel(scope.range.spec)}`}
            description={`Your 50 most played songs, ${rangeSpan(scope.range)}. Made with Encore.`}
            uris={() =>
              rank(scope, "song", "plays")
                .slice(0, 50)
                .map((entry) => ds.songs.uri[entry.id])
            }
          />
        )}
      </PageHeader>
      {ranked.length === 0 ? (
        <Card>
          <EmptyState icon={<Music />} title={`No ${noun}s in this range`}>
            Pick a wider date range to see your top {noun}s.
          </EmptyState>
        </Card>
      ) : (
        <>
          <Podium scope={scope} type={type} entries={ranked.slice(0, 3)} />
          {type === "artist" && <GenresCard scope={scope} />}
          <p className="mt-6 mb-4 text-sm text-ink-3">
            You played <span className="font-medium text-ink-2 tabular">{formatNumber(ranked.length)}</span> different{" "}
            {noun}s
            {ranked.length > 10 && (
              <>
                , and your top 10 make up <span className="font-medium text-ink-2">{formatPercent(total ? topTen / total : 0)}</span> of
                the time
              </>
            )}
            .
          </p>
          <RankedTable scope={scope} type={type} noun={noun} />
        </>
      )}
    </>
  );
}
