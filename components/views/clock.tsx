"use client";

import { Clock } from "lucide-react";
import { useMemo, useState } from "react";
import { BarList } from "@/components/charts/bar-list";
import { ChartCard } from "@/components/charts/chart-card";
import { ColumnChart } from "@/components/charts/column-chart";
import { CalendarHeatmap, MonthYearGrid, SequentialLegend, WeekHourHeatmap } from "@/components/charts/heatmaps";
import { quantileThresholds, SEQUENTIAL_STEPS } from "@/components/charts/scale";
import { bucketLabel } from "@/components/charts/time-axis";
import { TimeChart } from "@/components/charts/time-chart";
import { PageHeader } from "@/components/dashboard/page-header";
import { useScope } from "@/components/dashboard/use-scope";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Segmented } from "@/components/ui/segmented";
import { formatDayLong, formatDuration, formatHour, formatMonthLong, formatMonthShort, formatNumber, formatWeekday } from "@/lib/format";
import { biggestDays } from "@/lib/stats/records";
import { cached } from "@/lib/stats/cache";
import { autoGranularity, daily, hourly, monthsByYear, timeline, weekdayHours, weekdays, type Granularity } from "@/lib/stats/time";
import { dayOf, dayParts } from "@/lib/time";

const GRANULARITY_LABELS: Record<Granularity, string> = { day: "Days", week: "Weeks", month: "Months", year: "Years" };

export function ClockView() {
  const scope = useScope();
  const { range } = scope;
  const options = useMemo(() => {
    const available: Granularity[] = [];
    if (range.days <= 400) available.push("day");
    if (range.days >= 14) available.push("week");
    if (range.days >= 60) available.push("month");
    if (dayParts(range.dataTo).year - dayParts(range.dataFrom).year >= 1) available.push("year");
    return available.map((value) => ({ value, label: GRANULARITY_LABELS[value] }));
  }, [range]);
  const [chosen, setChosen] = useState<Granularity | null>(null);
  const granularity = chosen && options.some((o) => o.value === chosen) ? chosen : autoGranularity(range.days);

  const data = useMemo(() => cached(scope, "clock", () => {
    const hours = hourly(scope);
    const week = weekdays(scope);
    const days = daily(scope);
    return {
      hours: Array.from(hours.ms, (ms) => (range.days ? ms / range.days : 0)),
      weekdays: Array.from(week.ms, (ms, w) => (week.occurrences[w] ? ms / week.occurrences[w] : 0)),
      occurrences: week.occurrences,
      grid: weekdayHours(scope),
      days,
      thresholds: quantileThresholds(days, SEQUENTIAL_STEPS),
      years: monthsByYear(scope),
      biggest: biggestDays(scope, 10),
    };
  }), [scope, range.days]);
  const series = useMemo(() => cached(scope, `timeline:${granularity}`, () => timeline(scope, granularity)), [scope, granularity]);

  const hourLabels = useMemo(() => Array.from({ length: 24 }, (_, h) => formatHour(h)), []);
  const weekdayLabels = useMemo(() => Array.from({ length: 7 }, (_, w) => formatWeekday(w, "long")), []);
  const weekdayTicks = useMemo(() => Array.from({ length: 7 }, (_, w) => ({ index: w, label: formatWeekday(w) })), []);
  const calendarYears = data.years.map((row) => row.year).reverse();

  if (range.days === 0 || series.ms.every((v) => v === 0)) {
    return (
      <>
        <PageHeader title="Listening clock" kinds />
        <Card>
          <EmptyState icon={<Clock />} title="Nothing played in this range" />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Listening clock" kinds />

      <ChartCard
        title="Listening over time"
        description={`Time listened per ${granularity}`}
        action={options.length > 1 && <Segmented size="sm" label="Group by" value={granularity} options={options} onChange={setChosen} />}
        table={() => ({
          columns: [{ label: "Period" }, { label: "Time", numeric: true }, { label: "Streams", numeric: true }],
          rows: series.buckets.map((bucket, i) => [
            bucketLabel(bucket, granularity),
            formatDuration(series.ms[i]),
            formatNumber(series.plays[i]),
          ]),
        })}
      >
        <TimeChart
          values={series.ms}
          buckets={series.buckets}
          granularity={granularity}
          name="Listening time"
          height={280}
          note={(i) => `${formatNumber(series.plays[i])} streams`}
        />
      </ChartCard>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ChartCard
          title="Time of day"
          description="Average listening per day, by the hour plays start"
          table={() => ({
            columns: [{ label: "Hour" }, { label: "Average per day", numeric: true }],
            rows: data.hours.map((ms, h) => [hourLabels[h], formatDuration(ms)]),
          })}
        >
          <ColumnChart values={data.hours} labels={hourLabels} name="Average per day" height={230} />
        </ChartCard>
        <ChartCard
          title="Day of week"
          description="Average listening on each weekday"
          table={() => ({
            columns: [{ label: "Weekday" }, { label: "Average", numeric: true }],
            rows: data.weekdays.map((ms, w) => [weekdayLabels[w], formatDuration(ms)]),
          })}
        >
          <ColumnChart
            values={data.weekdays}
            labels={weekdayLabels}
            ticks={weekdayTicks}
            name="Average per day"
            height={230}
          />
        </ChartCard>
      </div>

      <ChartCard
        className="mt-4"
        title="Weekday × hour"
        description="Total listening for every hour of the week"
        action={<SequentialLegend className="hidden sm:flex" />}
        table={() => ({
          columns: [{ label: "Day" }, ...hourLabels.map((label) => ({ label, numeric: true }))],
          rows: weekdayLabels.map((label, w) => [label, ...hourLabels.map((_, h) => formatDuration(data.grid[w * 24 + h]))]),
        })}
      >
        <WeekHourHeatmap grid={data.grid} occurrences={data.occurrences} />
      </ChartCard>

      <ChartCard
        className="mt-4"
        title="Calendar"
        description="Every day you listened. Colours compare across years."
        action={<SequentialLegend className="hidden sm:flex" />}
        table={() => ({
          columns: [{ label: "Day" }, { label: "Time", numeric: true }],
          rows: Array.from(data.days)
            .map((ms, k) => [formatDayLong(range.dataFrom + k), formatDuration(ms)] as [string, string])
            .reverse(),
        })}
      >
        <div className="space-y-6 overflow-x-auto pb-1">
          {calendarYears.map((year) => {
            const row = data.years.find((y) => y.year === year);
            const total = row ? row.ms.reduce((a, b) => a + b, 0) : 0;
            return (
              <div key={year}>
                <p className="mb-2 text-[13px] font-semibold text-ink">
                  {year}
                  <span className="ml-2 font-normal text-ink-3 tabular">{formatDuration(total)}</span>
                </p>
                <CalendarHeatmap
                  year={year}
                  daily={data.days}
                  from={range.dataFrom}
                  thresholds={data.thresholds}
                  dataFrom={range.dataFrom}
                  dataTo={range.dataTo}
                />
              </div>
            );
          })}
        </div>
      </ChartCard>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {data.years.length > 1 ? (
          <ChartCard
            title="Months compared"
            description="The same month across years"
            table={() => ({
              columns: [{ label: "Year" }, ...Array.from({ length: 12 }, (_, m) => ({ label: String(m + 1), numeric: true }))],
              rows: data.years.map((row) => [String(row.year), ...Array.from(row.ms, (ms) => formatDuration(ms))]),
            })}
          >
            <MonthYearGrid rows={data.years} />
            <SequentialLegend className="mt-4 justify-end" />
          </ChartCard>
        ) : (
          <ChartCard title="Months" description="Listening per month">
            <ColumnChart
              values={data.years[0]?.ms ?? []}
              labels={Array.from({ length: 12 }, (_, m) => formatMonthLong(dayOf(data.years[0]?.year ?? 2024, m, 1)))}
              ticks={Array.from({ length: 12 }, (_, m) => ({ index: m, label: formatMonthShort(dayOf(2024, m, 1)) }))}
              name="Listening time"
              dim={(m) => data.years[0]?.outside[m] ?? false}
            />
          </ChartCard>
        )}
        <ChartCard title="Biggest days" description="Your longest days of listening">
          <BarList
            items={data.biggest.map((day) => ({
              key: String(day.day),
              label: formatDayLong(day.day),
              value: day.ms,
              display: formatDuration(day.ms),
              hint: `${formatNumber(day.plays)} streams`,
            }))}
          />
        </ChartCard>
      </div>
    </>
  );
}
