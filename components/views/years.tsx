"use client";

import { CalendarDays, Clock, Sparkles, TrendingUp } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { ColumnChart } from "@/components/charts/column-chart";
import { PageHeader } from "@/components/dashboard/page-header";
import { RankedList } from "@/components/dashboard/ranked";
import { useEntitySheet } from "@/components/dashboard/sheet-context";
import { useScope } from "@/components/dashboard/use-scope";
import { Card } from "@/components/ui/card";
import { Monogram } from "@/components/ui/monogram";
import { Delta } from "@/components/ui/stat";
import {
  formatDay,
  formatDayRange,
  formatDuration,
  formatHour,
  formatHours,
  formatMonthLong,
  formatMonthShort,
  formatNumber,
} from "@/lib/format";
import { withRange } from "@/lib/stats/scope";
import { cached } from "@/lib/stats/cache";
import { yearReviews, type YearReview } from "@/lib/stats/years";
import { dayOf } from "@/lib/time";

export function YearsView() {
  const scope = useScope();
  // Reviews always cover whole calendar years, whatever range is selected elsewhere.
  const reviews = useMemo(() => {
    const all = withRange(scope, { type: "all" });
    return cached(all, "years", () => yearReviews(all));
  }, [scope]);
  return (
    <>
      <PageHeader
        title="Year in review"
        description={`${reviews.length} ${reviews.length === 1 ? "year" : "years"} of listening, newest first`}
        filters={false}
      />
      <div className="space-y-6">
        {reviews.map((review, i) => (
          <YearCard key={review.year} review={review} index={i} />
        ))}
      </div>
    </>
  );
}

function YearCard({ review, index }: { review: YearReview; index: number }) {
  const open = useEntitySheet();
  const { scope, summary, previous, year } = review;
  const { ds } = scope.p;
  const range = scope.range;
  const partial = range.dataFrom > range.fromDay || range.dataTo < range.toDay;
  const perDay = range.days ? summary.ms / range.days : 0;
  const previousPerDay = useMemo(() => {
    if (!previous) return null;
    const previousRange = withRange(scope, { type: "year", year: year - 1 }).range;
    return previousRange.days ? previous.ms / previousRange.days : null;
  }, [previous, scope, year]);
  const topArtist = review.artists[0];
  const monthLabels = useMemo(() => Array.from({ length: 12 }, (_, m) => formatMonthLong(dayOf(year, m, 1))), [year]);
  const monthTicks = useMemo(
    () => Array.from({ length: 12 }, (_, m) => ({ index: m, label: formatMonthShort(dayOf(year, m, 1)).slice(0, 1) })),
    [year],
  );
  const outside = (m: number) => dayOf(year, m + 1, 0) < range.dataFrom || dayOf(year, m, 1) > range.dataTo;

  return (
    <Card className="animate-rise overflow-hidden" style={{ animationDelay: `${Math.min(index, 4) * 70}ms` }}>
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-5 pt-6 pb-5 sm:px-7">
        <div>
          <h2 className="text-[44px] leading-none font-semibold tracking-[-0.05em] text-ink sm:text-[56px]">{year}</h2>
          {partial && <p className="mt-2 text-[13px] text-ink-3">Data from {formatDayRange(range.dataFrom, range.dataTo)}</p>}
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          <Figure label="Hours" value={formatHours(summary.ms)} />
          <Figure label="Streams" value={formatNumber(summary.plays)} />
          <Figure label="New artists" value={formatNumber(review.newArtists)} />
          <Figure
            label="Per day"
            value={formatDuration(perDay)}
            detail={previousPerDay ? <Delta ratio={perDay / previousPerDay - 1} period={String(year - 1)} /> : undefined}
          />
        </dl>
      </div>

      <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-3 lg:gap-8">
        <div>
          {topArtist && (
            <button
              type="button"
              onClick={() => open({ type: "artist", id: topArtist.id })}
              className="flex w-full items-center gap-4 rounded-2xl bg-accent-wash p-4 text-left transition-colors hover:bg-accent-wash-strong"
            >
              <Monogram name={ds.artists[topArtist.id]} round size="lg" />
              <span className="min-w-0">
                <span className="block text-xs font-medium text-accent-ink">Artist of the year</span>
                <span className="block truncate text-lg font-semibold tracking-[-0.015em] text-ink">
                  {ds.artists[topArtist.id]}
                </span>
                <span className="block text-[13px] text-ink-2 tabular">
                  {formatDuration(topArtist.ms)} · {formatNumber(topArtist.plays)} streams
                </span>
              </span>
            </button>
          )}
          {review.artists.length > 1 && (
            <>
              <h3 className="mt-5 mb-1 text-[13px] font-semibold text-ink">Top artists</h3>
              <RankedList ds={ds} type="artist" entries={review.artists.slice(1)} by="time" start={2} />
            </>
          )}
        </div>

        <div>
          <h3 className="mb-1 text-[13px] font-semibold text-ink">Top songs</h3>
          <RankedList ds={ds} type="song" entries={review.songs} by="plays" />
          {review.shows.length > 0 && (
            <>
              <h3 className="mt-5 mb-1 text-[13px] font-semibold text-ink">Top podcasts</h3>
              <RankedList ds={ds} type="show" entries={review.shows.slice(0, 3)} by="time" />
            </>
          )}
        </div>

        <div className="flex flex-col">
          <h3 className="mb-2 text-[13px] font-semibold text-ink">Month by month</h3>
          <ColumnChart
            values={review.months}
            labels={monthLabels}
            ticks={monthTicks}
            name="Listening time"
            height={170}
            dim={outside}
          />
          <ul className="mt-4 space-y-2.5 text-[13px]">
            {review.albums[0] && (
              <Fact icon={<Sparkles />} label="Top album">
                <button
                  type="button"
                  onClick={() => open({ type: "album", id: review.albums[0].id })}
                  className="truncate text-left font-medium text-ink hover:underline"
                >
                  {ds.albums.name[review.albums[0].id]}
                </button>
              </Fact>
            )}
            {review.topMonth && (
              <Fact icon={<TrendingUp />} label="Biggest month">
                {formatMonthLong(review.topMonth.start)} · {formatDuration(review.topMonth.ms)}
              </Fact>
            )}
            {review.biggestDay && (
              <Fact icon={<CalendarDays />} label="Biggest day">
                {formatDay(review.biggestDay.day)} · {formatDuration(review.biggestDay.ms)}
              </Fact>
            )}
            {review.peakHour !== null && (
              <Fact icon={<Clock />} label="Peak hour">
                {formatHour(review.peakHour)}
              </Fact>
            )}
          </ul>
        </div>
      </div>
    </Card>
  );
}

function Figure({ label, value, detail }: { label: string; value: string; detail?: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-2xl font-semibold tracking-[-0.03em] text-ink">{value}</dd>
      {detail && <dd className="mt-0.5">{detail}</dd>}
    </div>
  );
}

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-3 [&_svg]:size-3.5">
        {icon}
      </span>
      <span className="w-24 shrink-0 text-ink-3">{label}</span>
      <span className="min-w-0 flex-1 truncate text-right font-medium text-ink">{children}</span>
    </li>
  );
}
