"use client";

import { BookOpen, Podcast } from "lucide-react";
import { useMemo, useState } from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { TimeChart } from "@/components/charts/time-chart";
import { bucketLabel } from "@/components/charts/time-axis";
import { PageHeader, SectionTitle } from "@/components/dashboard/page-header";
import { RankedTable } from "@/components/dashboard/ranked";
import { useScope } from "@/components/dashboard/use-scope";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { Stat } from "@/components/ui/stat";
import { formatDuration, formatHour, formatNumber } from "@/lib/format";
import { KINDS, withKinds } from "@/lib/stats/scope";
import { cached } from "@/lib/stats/cache";
import { summarize } from "@/lib/stats/summary";
import { hourly, timeline } from "@/lib/stats/time";

const CONFIG = {
  podcasts: {
    title: "Podcasts",
    mask: KINDS.podcasts,
    icon: Podcast,
    empty: "No podcast episodes in this range",
  },
  audiobooks: {
    title: "Audiobooks",
    mask: KINDS.audiobooks,
    icon: BookOpen,
    empty: "No audiobooks in this range",
  },
} as const;

/** Podcasts and audiobooks: spoken-word listening. */
export function SpokenView({ kind }: { kind: keyof typeof CONFIG }) {
  const config = CONFIG[kind];
  const base = useScope();
  const scope = useMemo(() => withKinds(base, config.mask), [base, config.mask]);
  const data = useMemo(() => cached(scope, "spoken", () => {
    const hours = hourly(scope).ms;
    let peak = 0;
    for (let h = 1; h < 24; h++) if (hours[h] > hours[peak]) peak = h;
    return { summary: summarize(scope), timeline: timeline(scope), peak };
  }), [scope]);
  const [tab, setTab] = useState<"show" | "episode">("show");
  const { summary } = data;
  const Icon = config.icon;

  return (
    <>
      <PageHeader title={config.title} />
      {summary.count === 0 ? (
        <Card>
          <EmptyState icon={<Icon />} title={config.empty}>
            Pick a wider date range.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Stat label="Listening time" value={formatDuration(summary.ms)} detail={`${formatNumber(summary.activeDays)} days`} />
            {kind === "podcasts" ? (
              <>
                <Stat label="Shows" value={formatNumber(summary.shows)} />
                <Stat label="Episodes" value={formatNumber(summary.episodes)} />
              </>
            ) : (
              <>
                <Stat label="Audiobooks" value={formatNumber(summary.books)} />
                <Stat label="Streams" value={formatNumber(summary.plays)} detail={`${formatNumber(summary.count)} plays in total`} />
              </>
            )}
            <Stat label="Usual time" value={formatHour(data.peak)} detail="Your most common hour" />
          </div>

          <ChartCard
            className="mt-4"
            title="Over time"
            description={`${config.title} listening per ${data.timeline.granularity}`}
            table={() => ({
              columns: [{ label: "Period" }, { label: "Time", numeric: true }],
              rows: data.timeline.buckets.map((bucket, i) => [
                bucketLabel(bucket, data.timeline.granularity),
                formatDuration(data.timeline.ms[i]),
              ]),
            })}
          >
            <TimeChart
              values={data.timeline.ms}
              buckets={data.timeline.buckets}
              granularity={data.timeline.granularity}
              name="Listening time"
              color="var(--series-1)"
            />
          </ChartCard>

          {kind === "podcasts" ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-x-3">
                <SectionTitle>Top {tab === "show" ? "shows" : "episodes"}</SectionTitle>
                <Segmented
                  label="Show"
                  value={tab}
                  options={[
                    { value: "show", label: "Shows" },
                    { value: "episode", label: "Episodes" },
                  ]}
                  onChange={setTab}
                  className="mb-4"
                />
              </div>
              <RankedTable key={tab} scope={scope} type={tab} noun={tab === "show" ? "show" : "episode"} />
            </>
          ) : (
            <>
              <SectionTitle>Top audiobooks</SectionTitle>
              <RankedTable scope={scope} type="book" noun="audiobook" />
            </>
          )}
        </>
      )}
    </>
  );
}
