"use client";

import { ArrowRight, CalendarDays, Clock, Flame, Headphones, Repeat, Sunrise, Timer } from "lucide-react";
import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { WeekHourHeatmap, SequentialLegend } from "@/components/charts/heatmaps";
import { SERIES, StackedBar } from "@/components/charts/parts";
import { TimeChart } from "@/components/charts/time-chart";
import { bucketLabel } from "@/components/charts/time-axis";
import { ChartCard } from "@/components/charts/chart-card";
import { PageHeader, SectionTitle } from "@/components/dashboard/page-header";
import { RankedList } from "@/components/dashboard/ranked";
import { useEntitySheet } from "@/components/dashboard/sheet-context";
import { useScope } from "@/components/dashboard/use-scope";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Stat } from "@/components/ui/stat";
import {
  formatDay,
  formatDayRange,
  formatDays,
  formatDuration,
  formatHour,
  formatHours,
  formatNumber,
  formatPercent,
  formatWeekday,
  toMinutes,
} from "@/lib/format";
import { KIND_LABELS } from "@/lib/labels";
import { KIND } from "@/lib/model";
import { biggestDays, repeats, sessions, streaks } from "@/lib/stats/records";
import { cached } from "@/lib/stats/cache";
import { hasKind, KINDS, withKinds } from "@/lib/stats/scope";
import { summarize } from "@/lib/stats/summary";
import { hourly, timeline, weekdayHours, weekdays } from "@/lib/stats/time";
import { rank } from "@/lib/stats/top";
import { DAY_MS } from "@/lib/time";

export function OverviewView() {
  const scope = useScope();
  const { ds } = scope.p;
  const music = useMemo(() => withKinds(scope, KINDS.music), [scope]);

  const data = useMemo(() => cached(scope, "overview", () => {
    const summary = summarize(scope);
    const hours = hourly(scope).ms;
    const week = weekdays(scope);
    let peakHour = 0;
    for (let h = 1; h < 24; h++) if (hours[h] > hours[peakHour]) peakHour = h;
    let topWeekday = 0;
    const perWeekday = Array.from(week.ms, (ms, w) => (week.occurrences[w] ? ms / week.occurrences[w] : 0));
    for (let w = 1; w < 7; w++) if (perWeekday[w] > perWeekday[topWeekday]) topWeekday = w;
    return {
      summary,
      allKinds: scope.kinds === KINDS.all ? summary : summarize(withKinds(scope, KINDS.all)),
      timeline: timeline(scope),
      grid: weekdayHours(scope),
      occurrences: week.occurrences,
      peakHour,
      peakHourShare: summary.ms ? hours[peakHour] / summary.ms : 0,
      topWeekday,
      topWeekdayAvg: perWeekday[topWeekday],
      streak: streaks(scope).longest,
      biggest: biggestDays(scope, 1)[0] ?? null,
      session: sessions(scope, undefined, 1).longest[0] ?? null,
    };
  }), [scope]);

  const top = useMemo(
    () => cached(music, "overview-top", () => ({
      artists: rank(music, "artist", "time").slice(0, 5),
      songs: rank(music, "song", "plays").slice(0, 5),
      albums: rank(music, "album", "time").slice(0, 5),
      repeat: repeats(music, 1)[0] ?? null,
      musicSummary: summarize(music),
    })),
    [music],
  );

  const { summary, allKinds } = data;
  const kindsPresent = [KIND.track, KIND.episode, KIND.audiobook].filter((k) => scope.p.kindCounts[k] > 0);
  const inScope = (kind: number) => scope.p.kindCounts[kind] > 0 && hasKind(scope.kinds, kind);
  const showMusic = inScope(KIND.track);
  const hasAlbums = scope.p.ds.meta.features.albums;
  const musicSkips = top.musicSummary.skips;

  // Three tiles after "Streams", chosen from what the current content filter covers.
  const tiles: { label: string; value: string; detail?: string }[] = [];
  if (showMusic) {
    tiles.push({
      label: "Songs",
      value: formatNumber(top.musicSummary.songs),
      detail: hasAlbums
        ? `on ${formatNumber(top.musicSummary.albums)} albums`
        : `by ${formatNumber(top.musicSummary.artists)} artists`,
    });
    tiles.push({
      label: "Artists",
      value: formatNumber(top.musicSummary.artists),
      detail: top.artists[0] ? `Most played: ${ds.artists[top.artists[0].id]}` : undefined,
    });
    tiles.push({
      label: "Skip rate",
      value: musicSkips.known ? formatPercent(musicSkips.on / musicSkips.known) : "n/a",
      detail: musicSkips.known ? `${formatNumber(musicSkips.on)} songs skipped` : "Not in this export",
    });
  } else {
    if (inScope(KIND.episode)) {
      tiles.push({ label: "Shows", value: formatNumber(summary.shows) });
      tiles.push({ label: "Episodes", value: formatNumber(summary.episodes) });
    }
    if (inScope(KIND.audiobook)) tiles.push({ label: "Audiobooks", value: formatNumber(summary.books) });
    tiles.push({ label: "Average play", value: formatDuration(summary.ms / Math.max(1, summary.count)) });
    tiles.push({ label: "Streams per day", value: formatNumber(summary.plays / Math.max(1, summary.activeDays)), detail: "on days you listened" });
  }
  tiles.splice(3);

  if (summary.count === 0) {
    return (
      <>
        <PageHeader title="Overview" kinds />
        <Card>
          <EmptyState icon={<Headphones />} title="Nothing played in this range">
            Pick a different date range or content type.
          </EmptyState>
        </Card>
      </>
    );
  }

  const daysOfListening = summary.ms / DAY_MS;

  return (
    <>
      <PageHeader title="Overview" kinds />

      <Card className="animate-rise overflow-hidden">
        <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)] xl:gap-10">
          <div className="flex flex-col">
            <p className="text-[13px] font-medium text-ink-3">Listening time</p>
            <p className="mt-2 flex items-baseline gap-2.5">
              <span className="text-[56px] leading-none font-semibold tracking-[-0.045em] text-ink sm:text-[72px]">
                {formatHours(summary.ms)}
              </span>
              <span className="text-xl font-medium tracking-[-0.01em] text-ink-3">hours</span>
            </p>
            <p className="mt-3 text-[15px] leading-6 text-ink-2">
              {daysOfListening >= 1 ? (
                <>
                  That&rsquo;s <span className="font-semibold text-ink">{formatDays(summary.ms)} days</span> of nonstop
                  audio, or <span className="tabular">{formatNumber(toMinutes(summary.ms))}</span> minutes.
                </>
              ) : (
                <>
                  <span className="tabular">{formatNumber(toMinutes(summary.ms))}</span> minutes of audio.
                </>
              )}
            </p>
            <dl className="mt-auto grid grid-cols-2 gap-4 pt-6">
              <div>
                <dt className="text-xs text-ink-3">Per listening day</dt>
                <dd className="mt-0.5 text-lg font-semibold tracking-[-0.02em] text-ink">
                  {formatDuration(summary.ms / Math.max(1, summary.activeDays))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-3">Days you listened</dt>
                <dd className="mt-0.5 text-lg font-semibold tracking-[-0.02em] text-ink">
                  {formatNumber(summary.activeDays)}
                  <span className="text-sm font-medium text-ink-3"> / {formatNumber(scope.range.days)}</span>
                </dd>
              </div>
            </dl>
          </div>
          <div className="min-w-0">
            <TimeChart
              values={data.timeline.ms}
              buckets={data.timeline.buckets}
              granularity={data.timeline.granularity}
              name="Listening time"
              height={260}
              note={(i) => `${formatNumber(data.timeline.plays[i])} streams`}
            />
          </div>
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          className="animate-rise [animation-delay:60ms]"
          label="Streams"
          value={formatNumber(summary.plays)}
          detail={`${formatNumber(summary.count)} plays incl. skips`}
        />
        {tiles.map((tile, i) => (
          <Stat
            key={tile.label}
            className="animate-rise"
            style={{ animationDelay: `${100 + i * 40}ms` }}
            label={tile.label}
            value={tile.value}
            detail={tile.detail}
          />
        ))}
      </div>

      {showMusic && (
        <>
          <SectionTitle>Your top music</SectionTitle>
          <div className={hasAlbums ? "grid gap-4 lg:grid-cols-3" : "grid gap-4 lg:grid-cols-2"}>
            <TopCard title="Artists" href="/dashboard/artists" description="By listening time">
              <RankedList ds={ds} type="artist" entries={top.artists} by="time" />
            </TopCard>
            <TopCard title="Tracks" href="/dashboard/tracks" description="By streams">
              <RankedList ds={ds} type="song" entries={top.songs} by="plays" />
            </TopCard>
            {hasAlbums && (
              <TopCard title="Albums" href="/dashboard/albums" description="By listening time">
                <RankedList ds={ds} type="album" entries={top.albums} by="time" />
              </TopCard>
            )}
          </div>
        </>
      )}

      <SectionTitle>Highlights</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        {data.biggest && (
          <Highlight
            icon={<CalendarDays />}
            label="Biggest day"
            value={formatDay(data.biggest.day)}
            detail={`${formatDuration(data.biggest.ms)} of listening`}
          />
        )}
        {data.streak && (
          <Highlight
            icon={<Flame />}
            label="Longest streak"
            value={`${formatNumber(data.streak.days)} days in a row`}
            detail={formatDayRange(data.streak.from, data.streak.to)}
          />
        )}
        {data.session && (
          <Highlight
            icon={<Timer />}
            label="Longest session"
            value={formatDuration(data.session.ms)}
            detail={`${formatNumber(data.session.plays)} streams on ${formatDay(scope.p.day[data.session.first])}`}
          />
        )}
        <Highlight
          icon={<Clock />}
          label="Peak hour"
          value={formatHour(data.peakHour)}
          detail={`${formatPercent(data.peakHourShare)} of your listening starts in this hour`}
        />
        <Highlight
          icon={<Sunrise />}
          label="Favourite day"
          value={`${formatWeekday(data.topWeekday, "long")}s`}
          detail={`${formatDuration(data.topWeekdayAvg)} on an average ${formatWeekday(data.topWeekday, "long")}`}
        />
        {showMusic && top.repeat && <RepeatHighlight repeat={top.repeat} />}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <ChartCard
          title="Listening clock"
          description="When your listening starts, by weekday and hour"
          action={
            <Link href="/dashboard/clock" className="text-[13px] font-medium text-accent-ink hover:underline">
              Explore
            </Link>
          }
          table={() => ({
            columns: [{ label: "Day" }, ...Array.from({ length: 24 }, (_, h) => ({ label: formatHour(h), numeric: true }))],
            rows: Array.from({ length: 7 }, (_, w) => [
              formatWeekday(w),
              ...Array.from({ length: 24 }, (_, h) => formatDuration(data.grid[w * 24 + h])),
            ]),
          })}
        >
          <WeekHourHeatmap grid={data.grid} occurrences={data.occurrences} />
          <SequentialLegend className="mt-3 justify-end" />
        </ChartCard>

        <Card>
          <CardHeader
            title="By the numbers"
            description={kindsPresent.length > 1 ? "What you listen to, by share of time" : undefined}
          />
          <CardBody>
            {kindsPresent.length > 1 && (
              <StackedBar
                className="mb-5"
                parts={kindsPresent.map((kind, i) => ({
                  key: String(kind),
                  label: KIND_LABELS[kind],
                  value: allKinds.byKind[kind].ms,
                  color: SERIES[i],
                  detail: `${formatNumber(allKinds.byKind[kind].plays)} streams`,
                }))}
              />
            )}
            <dl className="space-y-3 text-[13px]">
              <Row label="Average play" value={formatDuration(summary.ms / Math.max(1, summary.count))} />
              <Row label="Streams per listening day" value={formatNumber(summary.plays / Math.max(1, summary.activeDays))} />
              {summary.shuffle.known > 0 && (
                <Row label="Played on shuffle" value={formatPercent(summary.shuffle.on / summary.shuffle.known)} />
              )}
              {summary.offline.known > 0 && (
                <Row label="Played offline" value={formatPercent(summary.offline.on / summary.offline.known)} />
              )}
              {summary.video.count > 0 && (
                <Row label="Video plays" value={`${formatNumber(summary.video.count)} · ${formatDuration(summary.video.ms)}`} />
              )}
              <Row label="Busiest period" value={busiestBucket(data.timeline)} />
            </dl>
          </CardBody>
        </Card>
      </div>
    </>
  );
}

function busiestBucket(t: ReturnType<typeof timeline>): string {
  let best = -1;
  for (let i = 0; i < t.ms.length; i++) if (best < 0 || t.ms[i] > t.ms[best]) best = i;
  return best < 0 ? "n/a" : `${bucketLabel(t.buckets[best], t.granularity)} · ${formatDuration(t.ms[best])}`;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3 last:border-0 last:pb-0">
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-right font-medium text-ink tabular">{value}</dd>
    </div>
  );
}

function TopCard({ title, description, href, children }: { title: string; description: string; href: string; children: ReactNode }) {
  return (
    <Card className="animate-rise">
      <CardHeader
        title={title}
        description={description}
        action={
          <Link
            href={href}
            className="inline-flex items-center gap-1 rounded-lg text-[13px] font-medium text-accent-ink hover:underline"
          >
            See all <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        }
      />
      <CardBody className="pt-3">{children}</CardBody>
    </Card>
  );
}

function Highlight({ icon, label, value, detail }: { icon: ReactNode; label: string; value: ReactNode; detail: ReactNode }) {
  return (
    <div className="flex animate-rise items-start gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-wash text-accent-ink [&_svg]:size-5">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[13px] text-ink-3">{label}</p>
        <p className="mt-0.5 truncate text-[17px] font-semibold tracking-[-0.015em] text-ink">{value}</p>
        <p className="mt-0.5 text-[13px] leading-5 text-ink-3">{detail}</p>
      </div>
    </div>
  );
}

function RepeatHighlight({ repeat }: { repeat: { song: number; day: number; plays: number } }) {
  const scope = useScope();
  const open = useEntitySheet();
  const { ds } = scope.p;
  return (
    <button type="button" onClick={() => open({ type: "song", id: repeat.song })} className="text-left">
      <Highlight
        icon={<Repeat />}
        label="On repeat"
        value={`“${ds.songs.name[repeat.song]}” × ${formatNumber(repeat.plays)}`}
        detail={`${ds.artists[ds.songs.artist[repeat.song]]}, all on ${formatDay(repeat.day)}`}
      />
    </button>
  );
}
