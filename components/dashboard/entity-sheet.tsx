"use client";

import { ArrowLeft, ExternalLink, X } from "lucide-react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ColumnChart } from "@/components/charts/column-chart";
import { TimeChart } from "@/components/charts/time-chart";
import { RankedList } from "@/components/dashboard/ranked";
import { SheetContext, useEntitySheet } from "@/components/dashboard/sheet-context";
import { useScope } from "@/components/dashboard/use-scope";
import { EntityArt } from "@/components/ui/entity-art";
import { Button, buttonClass, IconButton } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDay, formatDuration, formatHour, formatNumber, formatPercent } from "@/lib/format";
import { entityVisual } from "@/lib/artwork";
import { rangeLabel, rangeSpan } from "@/lib/range";
import { cached } from "@/lib/stats/cache";
import { ENTITY_NOUN, entityDetail, spotifyUrl } from "@/lib/stats/entity";
import type { EntityRef } from "@/lib/stats/top";

const PEER_NOUN: Record<EntityRef["type"], string> = {
  artist: "artists",
  song: "songs",
  album: "albums",
  show: "shows",
  episode: "episodes",
  book: "audiobooks",
};

const SHARE_OF: Record<EntityRef["type"], string> = {
  artist: "of your music",
  song: "of your music",
  album: "of your music",
  show: "of your podcasts",
  episode: "of your podcasts",
  book: "of your audiobooks",
};

const same = (a: EntityRef, b: EntityRef) => a.type === b.type && a.id === b.id;

export function EntitySheetProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<EntityRef[]>([]);
  const open = useCallback(
    (ref: EntityRef) => setStack((current) => (current.length && same(current[current.length - 1], ref) ? current : [...current, ref])),
    [],
  );
  const close = useCallback(() => setStack([]), []);
  const back = useCallback(() => setStack((current) => current.slice(0, -1)), []);
  const current = stack[stack.length - 1];

  return (
    <SheetContext value={open}>
      {children}
      <Dialog open={current !== undefined} onClose={close} variant="sheet" label="Details">
        {current && (
          <EntityPanel
            key={`${current.type}:${current.id}:${stack.length}`}
            entity={current}
            onBack={stack.length > 1 ? back : undefined}
            onClose={close}
          />
        )}
      </Dialog>
    </SheetContext>
  );
}

function Fact({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface-2 px-4 py-3">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-1 truncate text-lg leading-tight font-semibold tracking-[-0.02em] text-ink">{value}</dd>
      {detail && <dd className="mt-0.5 truncate text-xs text-ink-3">{detail}</dd>}
    </div>
  );
}

function EntityPanel({ entity, onBack, onClose }: { entity: EntityRef; onBack?: () => void; onClose: () => void }) {
  const scope = useScope();
  const open = useEntitySheet();
  const { ds } = scope.p;
  const detail = useMemo(
    () => cached(scope, `entity:${entity.type}:${entity.id}`, () => entityDetail(scope, entity)),
    [scope, entity],
  );
  const visual = entityVisual(ds, entity);
  const hourLabels = useMemo(() => Array.from({ length: 24 }, (_, h) => formatHour(h)), []);
  const { totals, skips } = detail;
  const firstDay = detail.first >= 0 ? scope.p.day[detail.first] : null;
  const lastDay = detail.last >= 0 ? scope.p.day[detail.last] : null;
  const firstSong = entity.type === "artist" && detail.first >= 0 ? ds.songs.name[ds.item[detail.first]] : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-4 sm:px-5">
        {onBack ? (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft /> Back
          </Button>
        ) : (
          <span />
        )}
        <IconButton label="Close" onClick={onClose}>
          <X />
        </IconButton>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-10 sm:px-7">
        <header className="flex items-center gap-4 pt-2">
          <EntityArt ds={ds} entity={entity} size="xl" />
          <div className="min-w-0">
            <Eyebrow>{ENTITY_NOUN[entity.type]}</Eyebrow>
            <h2 className="mt-1 text-2xl leading-tight font-semibold tracking-[-0.025em] text-ink [overflow-wrap:anywhere]">
              {visual.title}
            </h2>
            {visual.subtitle && visual.parent && (
              <button
                type="button"
                onClick={() => open(visual.parent!)}
                className="mt-0.5 text-sm font-medium text-accent-ink hover:underline"
              >
                {visual.subtitle}
              </button>
            )}
          </div>
        </header>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <a
            href={spotifyUrl(ds, entity)}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClass("secondary", "sm")}
          >
            <ExternalLink /> Open in Spotify
          </a>
          <span className="text-xs text-ink-3">
            {rangeLabel(scope.range.spec)} · {rangeSpan(scope.range)}
          </span>
        </div>

        {totals.count === 0 ? (
          <EmptyState title="Not played in this date range" className="mt-6 rounded-2xl bg-surface-2">
            {firstDay !== null && lastDay !== null
              ? `You streamed it between ${formatDay(firstDay)} and ${formatDay(lastDay)}. Widen the range to see it here.`
              : "Widen the date range to see it here."}
          </EmptyState>
        ) : (
          <>
            <dl className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Fact label="Listening time" value={formatDuration(totals.ms)} />
              <Fact label="Streams" value={formatNumber(totals.plays)} detail={`${formatNumber(totals.count)} plays in total`} />
              <Fact
                label="Rank"
                value={detail.rank ? `#${formatNumber(detail.rank)}` : "n/a"}
                detail={`of ${formatNumber(detail.peers)} ${PEER_NOUN[entity.type]}`}
              />
              <Fact label="Share" value={formatPercent(detail.share, true)} detail={SHARE_OF[entity.type]} />
              <Fact label="Days listened" value={formatNumber(detail.activeDays)} />
              {skips.known > 0 ? (
                <Fact label="Skip rate" value={formatPercent(skips.on / skips.known)} detail={`${formatNumber(skips.on)} skips`} />
              ) : (
                <Fact
                  label="Per listening day"
                  value={formatDuration(totals.ms / Math.max(1, detail.activeDays))}
                  detail="on days you played it"
                />
              )}
            </dl>

            <dl className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
              {firstDay !== null && (
                <Fact label="First streamed" value={formatDay(firstDay)} detail={firstSong ? `with “${firstSong}”` : "across your whole history"} />
              )}
              {detail.biggestDay && (
                <Fact
                  label="Biggest day"
                  value={formatDay(detail.biggestDay.day)}
                  detail={`${formatDuration(detail.biggestDay.ms)} that day`}
                />
              )}
            </dl>

            <section className="mt-8">
              <h3 className="mb-2 text-sm font-semibold text-ink">Listening over time</h3>
              <TimeChart
                values={detail.timeline.ms}
                buckets={detail.timeline.buckets}
                granularity={detail.timeline.granularity}
                name="Listening time"
                height={190}
              />
            </section>

            <section className="mt-6">
              <h3 className="mb-2 text-sm font-semibold text-ink">Time of day</h3>
              <ColumnChart values={detail.hourly} labels={hourLabels} name="Listening time" height={150} />
            </section>

            {detail.songs.length > 0 && (
              <section className="mt-8">
                <h3 className="mb-2 text-sm font-semibold text-ink">
                  {entity.type === "album" ? "Songs" : "Top songs"}
                  <span className="ml-2 font-normal text-ink-3">{formatNumber(detail.songs.length)}</span>
                </h3>
                <RankedList ds={ds} type="song" entries={detail.songs.slice(0, 12)} by="time" />
              </section>
            )}
            {detail.albums.length > 0 && (
              <section className="mt-8">
                <h3 className="mb-2 text-sm font-semibold text-ink">
                  Albums<span className="ml-2 font-normal text-ink-3">{formatNumber(detail.albums.length)}</span>
                </h3>
                <RankedList ds={ds} type="album" entries={detail.albums.slice(0, 8)} by="time" />
              </section>
            )}
            {detail.episodes.length > 0 && (
              <section className="mt-8">
                <h3 className="mb-2 text-sm font-semibold text-ink">
                  Episodes<span className="ml-2 font-normal text-ink-3">{formatNumber(detail.episodes.length)}</span>
                </h3>
                <RankedList ds={ds} type="episode" entries={detail.episodes.slice(0, 12)} by="time" />
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
