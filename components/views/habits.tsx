"use client";

import { Activity, Info } from "lucide-react";
import { useMemo, useState } from "react";
import { BarList } from "@/components/charts/bar-list";
import { ChartCard } from "@/components/charts/chart-card";
import { ColumnChart } from "@/components/charts/column-chart";
import { OTHER_COLOR, SERIES, StackedBar, type Part } from "@/components/charts/parts";
import { bucketLabel } from "@/components/charts/time-axis";
import { TimeChart } from "@/components/charts/time-chart";
import { PageHeader, SectionTitle } from "@/components/dashboard/page-header";
import { useEntitySheet } from "@/components/dashboard/sheet-context";
import { useScope } from "@/components/dashboard/use-scope";
import { EntityArt } from "@/components/ui/entity-art";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { Stat } from "@/components/ui/stat";
import {
  countryName,
  formatDay,
  formatDuration,
  formatInstant,
  formatNumber,
  formatPercent,
} from "@/lib/format";
import { endReasonLabel, PLATFORM_LABELS, startReasonLabel, type PlatformGroup } from "@/lib/labels";
import { FLAG } from "@/lib/model";
import { countries, flagRate, platforms, reasons, skipLeaders, type SkipEntry } from "@/lib/stats/habits";
import { SESSION_BUCKETS, sessions } from "@/lib/stats/records";
import { cached } from "@/lib/stats/cache";
import { KINDS, withKinds, withRange } from "@/lib/stats/scope";
import { summarize } from "@/lib/stats/summary";

type Metric = "skips" | "shuffle" | "offline";

const METRICS: Record<Metric, { label: string; flag: number; known: number; music: boolean; describe: string }> = {
  skips: { label: "Skips", flag: FLAG.skipped, known: FLAG.skippedKnown, music: true, describe: "Share of songs skipped" },
  shuffle: { label: "Shuffle", flag: FLAG.shuffle, known: FLAG.shuffleKnown, music: false, describe: "Share of plays on shuffle" },
  offline: { label: "Offline", flag: FLAG.offline, known: FLAG.offlineKnown, music: false, describe: "Share of plays offline" },
};

export function HabitsView() {
  const scope = useScope();
  const { p } = scope;
  const { features } = p.ds.meta;
  const music = useMemo(() => withKinds(scope, KINDS.music), [scope]);
  const available = (Object.keys(METRICS) as Metric[]).filter((m) => features[m]);
  const [metric, setMetric] = useState<Metric>("skips");
  const activeMetric = available.includes(metric) ? metric : available[0];

  const data = useMemo(() => cached(scope, "habits", () => {
    // Platform colours follow each device across every date range: rank them over all time.
    const allTimeOrder = platforms(withRange(scope, { type: "all" })).map((share) => share.group);
    return {
      summary: summarize(scope),
      music: summarize(music),
      sessions: sessions(scope),
      skips: skipLeaders(music),
      starts: reasons(scope, "start"),
      ends: reasons(scope, "end"),
      platforms: platforms(scope),
      platformOrder: allTimeOrder,
      countries: countries(scope),
    };
  }), [scope, music]);

  const rate = useMemo(() => {
    if (!activeMetric) return null;
    const config = METRICS[activeMetric];
    const granularity = scope.range.days > 400 ? "month" : scope.range.days > 62 ? "week" : "day";
    const target = config.music ? music : scope;
    const series = cached(target, `rate:${activeMetric}:${granularity}`, () =>
      flagRate(target, config.flag, config.known, granularity),
    );
    return {
      ...series,
      granularity,
      values: Array.from(series.known, (known, i) => (known ? series.on[i] / known : 0)),
    } as const;
  }, [activeMetric, scope, music]);

  const { summary } = data;
  const sessionLabels = SESSION_BUCKETS.map((bucket) => bucket.label);

  if (summary.count === 0) {
    return (
      <>
        <PageHeader title="Habits" kinds />
        <Card>
          <EmptyState icon={<Activity />} title="Nothing played in this range" />
        </Card>
      </>
    );
  }

  const platformParts: Part[] = (() => {
    const colorOf = new Map<PlatformGroup, string>(data.platformOrder.slice(0, 7).map((group, i) => [group, SERIES[i]]));
    const parts: Part[] = [];
    let other = 0;
    for (const share of data.platforms) {
      const color = colorOf.get(share.group);
      if (color) {
        parts.push({
          key: share.group,
          label: PLATFORM_LABELS[share.group],
          value: share.ms,
          color,
          detail: `${formatNumber(share.count)} plays`,
        });
      } else {
        other += share.ms;
      }
    }
    if (other > 0) parts.push({ key: "other", label: "Everything else", value: other, color: OTHER_COLOR });
    return parts;
  })();

  const ratio = (r: { known: number; on: number }) => (r.known ? formatPercent(r.on / r.known) : "n/a");

  return (
    <>
      <PageHeader title="Habits" kinds />

      {!features.skips && !features.platforms && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-[13px] text-ink-2 shadow-card">
          <Info className="mt-0.5 size-4 shrink-0 text-accent-ink" aria-hidden />
          <p>
            Your export is the basic &ldquo;Account data&rdquo; one, which doesn&rsquo;t record skips, shuffle or devices.
            Request the <span className="font-medium text-ink">Extended streaming history</span> from Spotify to unlock
            them.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat
          label="Skip rate"
          value={ratio(data.music.skips)}
          detail={data.music.skips.known ? `${formatNumber(data.music.skips.on)} songs skipped` : "Not in this export"}
        />
        <Stat
          label="On shuffle"
          value={ratio(summary.shuffle)}
          detail={summary.shuffle.known ? `${formatNumber(summary.shuffle.on)} plays` : "Not in this export"}
        />
        <Stat
          label="Offline"
          value={ratio(summary.offline)}
          detail={summary.offline.known ? `${formatNumber(summary.offline.on)} plays` : "Not in this export"}
        />
        <Stat
          label="Average session"
          value={formatDuration(data.sessions.count ? data.sessions.totalMs / data.sessions.count : 0)}
          detail={`${formatNumber(data.sessions.count)} sessions`}
        />
      </div>

      {rate && activeMetric && (
        <ChartCard
          className="mt-4"
          title="Over time"
          description={METRICS[activeMetric].describe}
          action={
            available.length > 1 && (
              <Segmented
                size="sm"
                label="Metric"
                value={activeMetric}
                options={available.map((value) => ({ value, label: METRICS[value].label }))}
                onChange={setMetric}
              />
            )
          }
          table={() => ({
            columns: [{ label: "Period" }, { label: "Rate", numeric: true }, { label: "Plays", numeric: true }],
            rows: rate.buckets.map((bucket, i) => [
              bucketLabel(bucket, rate.granularity),
              formatPercent(rate.values[i], true),
              formatNumber(rate.known[i]),
            ]),
          })}
        >
          <TimeChart
            values={rate.values}
            buckets={rate.buckets}
            granularity={rate.granularity}
            name={METRICS[activeMetric].describe}
            kind="percent"
            note={(i) => `${formatNumber(rate.on[i])} of ${formatNumber(rate.known[i])} plays`}
          />
        </ChartCard>
      )}

      {features.skips && (data.skips.mostSkipped.length > 0 || data.skips.neverSkipped.length > 0) && (
        <>
          <SectionTitle description="Among songs you started at least 8 times in this range">Skipping</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            <SkipCard title="Most skipped" entries={data.skips.mostSkipped} mode="skips" />
            <SkipCard title="Never skipped" entries={data.skips.neverSkipped} mode="plays" />
          </div>
        </>
      )}

      {features.reasons && (
        <>
          <SectionTitle description="Spotify records why each play started and ended">How plays start and end</SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2">
            <ReasonCard title="How plays start" shares={data.starts} label={startReasonLabel} total={summary.count} />
            <ReasonCard title="How plays end" shares={data.ends} label={endReasonLabel} total={summary.count} />
          </div>
        </>
      )}

      <SectionTitle description="Plays less than 30 minutes apart count as one session">Sessions</SectionTitle>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <ChartCard
          title="Session length"
          description={`${formatNumber(data.sessions.count)} sessions, by time played`}
          table={() => ({
            columns: [{ label: "Length" }, { label: "Sessions", numeric: true }],
            rows: sessionLabels.map((label, i) => [label, formatNumber(data.sessions.lengths[i])]),
          })}
        >
          <ColumnChart values={data.sessions.lengths} labels={sessionLabels} name="Sessions" kind="count" height={230} />
        </ChartCard>
        <Card>
          <CardHeader title="Longest sessions" />
          <CardBody>
            <ol className="space-y-3">
              {data.sessions.longest.map((session, i) => (
                <li key={session.first} className="flex items-center gap-3 text-[13px]">
                  <span className="w-4 text-right font-medium text-ink-3 tabular">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{formatDay(p.day[session.first])}</p>
                    <p className="text-xs text-ink-3">
                      {formatInstant(session.start, p.timeZone, { timeStyle: "short" })} to{" "}
                      {formatInstant(
                        session.end,
                        p.timeZone,
                        sameLocalDay(session.start, session.end, p.timeZone)
                          ? { timeStyle: "short" }
                          : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
                      )}{" "}
                      · {formatNumber(session.plays)} streams
                    </p>
                  </div>
                  <span className="font-semibold text-ink tabular">{formatDuration(session.ms)}</span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>

      {(features.platforms || features.countries) && <SectionTitle>Where you listen</SectionTitle>}
      <div className="grid gap-4 lg:grid-cols-2">
        {features.platforms && platformParts.length > 0 && (
          <Card>
            <CardHeader title="Devices" description="Share of listening time by platform" />
            <CardBody>
              <StackedBar parts={platformParts} />
              <details className="group mt-5 rounded-xl bg-surface-2 px-3 py-2 text-[13px]">
                <summary className="font-medium text-ink-2 marker:text-ink-3">
                  All {formatNumber(data.platforms.reduce((n, share) => n + share.devices.length, 0))} device names
                </summary>
                <ul className="mt-2 space-y-1.5 pb-1">
                  {data.platforms
                    .flatMap((share) => share.devices)
                    .sort((a, b) => b.ms - a.ms)
                    .slice(0, 30)
                    .map((device) => (
                      <li key={device.name} className="flex justify-between gap-3">
                        <span className="truncate font-mono text-xs text-ink-2">{device.name}</span>
                        <span className="shrink-0 text-xs text-ink-3 tabular">{formatDuration(device.ms)}</span>
                      </li>
                    ))}
                </ul>
              </details>
            </CardBody>
          </Card>
        )}
        {features.countries && data.countries.length > 0 && (
          <Card>
            <CardHeader title="Countries" description="Where your plays were streamed from" />
            <CardBody>
              <BarList
                items={data.countries.slice(0, 10).map((country) => ({
                  key: country.key,
                  label: (
                    <span className="flex items-center gap-2">
                      <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-medium text-ink-3">
                        {country.key}
                      </span>
                      {countryName(country.key)}
                    </span>
                  ),
                  value: country.ms,
                  display: formatDuration(country.ms),
                  hint: formatPercent(summary.ms ? country.ms / summary.ms : 0),
                }))}
              />
            </CardBody>
          </Card>
        )}
      </div>
    </>
  );
}

function SkipCard({ title, entries, mode }: { title: string; entries: SkipEntry[]; mode: "skips" | "plays" }) {
  const scope = useScope();
  const open = useEntitySheet();
  const { ds } = scope.p;
  return (
    <Card>
      <CardHeader title={title} description={mode === "skips" ? "Highest skip rate" : "Most played without a single skip"} />
      <CardBody className="pt-3">
        {entries.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-ink-3">Nothing qualifies in this range.</p>
        ) : (
          <ol className="-mx-2">
            {entries.map((entry) => (
              <li key={entry.song}>
                <button
                  type="button"
                  onClick={() => open({ type: "song", id: entry.song })}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-surface-2"
                >
                  <EntityArt ds={ds} entity={{ type: "song", id: entry.song }} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{ds.songs.name[entry.song]}</span>
                    <span className="block truncate text-xs text-ink-3">{ds.artists[ds.songs.artist[entry.song]]}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[13px] font-semibold text-ink tabular">
                      {mode === "skips" ? formatPercent(entry.rate) : formatNumber(entry.plays)}
                    </span>
                    <span className="block text-xs text-ink-3 tabular">
                      {mode === "skips" ? `${entry.skips} of ${entry.plays}` : "plays"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

function ReasonCard({
  title,
  shares,
  label,
  total,
}: {
  title: string;
  shares: { key: string; count: number }[];
  label: (raw: string) => string;
  total: number;
}) {
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody>
        <BarList
          items={shares.slice(0, 8).map((share) => ({
            key: share.key,
            label: label(share.key),
            value: share.count,
            display: formatNumber(share.count),
            hint: formatPercent(total ? share.count / total : 0),
          }))}
        />
      </CardBody>
    </Card>
  );
}

function sameLocalDay(a: number, b: number, timeZone: string): boolean {
  return formatInstant(a, timeZone, { dateStyle: "short" }) === formatInstant(b, timeZone, { dateStyle: "short" });
}
