"use client";

import { useMemo, useState } from "react";
import { binOf, quantileThresholds, sequentialColor, SEQUENTIAL_STEPS } from "@/components/charts/scale";
import { ChartTooltip } from "@/components/charts/tooltip";
import { useWidth } from "@/components/charts/use-width";
import { formatDayLong, formatDuration, formatHour, formatMonthShort, formatWeekday } from "@/lib/format";
import { dayOf, weekStart, weekdayOf } from "@/lib/time";
import { cn } from "@/lib/ui";

export function SequentialLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5 text-[11px] text-ink-3", className)} aria-hidden>
      <span>Less</span>
      {Array.from({ length: SEQUENTIAL_STEPS }, (_, i) => (
        <span key={i} className="size-2.5 rounded-[3px]" style={{ background: sequentialColor(i) }} />
      ))}
      <span>More</span>
    </div>
  );
}

/** Listening by weekday (rows) and hour (columns). */
export function WeekHourHeatmap({ grid, occurrences }: { grid: Float64Array; occurrences: Uint32Array }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const thresholds = useMemo(() => quantileThresholds(grid, SEQUENTIAL_STEPS), [grid]);
  const labelW = 40;
  const gap = 2;
  const cell = width ? (width - labelW) / 24 : 0;
  const cellH = Math.max(14, Math.min(30, cell * 0.92));
  const height = 7 * cellH + 24;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Listening by weekday and hour" onPointerLeave={() => setActive(null)}>
          {Array.from({ length: 7 }, (_, w) => (
            <text key={w} x={0} y={w * cellH + cellH / 2} dy="0.32em" className="fill-ink-3 text-[11px]">
              {formatWeekday(w)}
            </text>
          ))}
          {Array.from({ length: 168 }, (_, index) => {
            const w = Math.floor(index / 24);
            const h = index % 24;
            return (
              <rect
                key={index}
                x={labelW + h * cell}
                y={w * cellH}
                width={Math.max(1, cell - gap)}
                height={cellH - gap}
                rx={3}
                fill={sequentialColor(binOf(grid[index], thresholds))}
                stroke={active === index ? "var(--ink)" : "none"}
                strokeWidth={1.5}
                onPointerEnter={() => setActive(index)}
                onPointerDown={() => setActive(index)}
              />
            );
          })}
          {(cell * 3 >= 44 ? [0, 3, 6, 9, 12, 15, 18, 21] : [0, 6, 12, 18]).map((h) => (
            <text key={h} x={labelW + h * cell} y={height - 6} className="fill-ink-3 text-[11px] tabular">
              {formatHour(h)}
            </text>
          ))}
        </svg>
      )}
      {active !== null && (
        <ChartTooltip
          x={labelW + (active % 24) * cell + cell / 2}
          y={Math.floor(active / 24) * cellH + cellH / 2}
          containerWidth={width}
          title={`${formatWeekday(Math.floor(active / 24), "long")}s · ${formatHour(active % 24)}`}
          rows={[{ value: formatDuration(grid[active]), label: "in total" }]}
          note={
            occurrences[Math.floor(active / 24)]
              ? `≈ ${formatDuration(grid[active] / occurrences[Math.floor(active / 24)])} on an average ${formatWeekday(Math.floor(active / 24), "long")}`
              : null
          }
        />
      )}
    </div>
  );
}

/**
 * One year of days as a week-by-weekday grid. `daily[k]` is the listening on
 * day `from + k`; `thresholds` are shared across years so colours compare.
 */
export function CalendarHeatmap({
  year,
  daily,
  from,
  thresholds,
  dataFrom,
  dataTo,
}: {
  year: number;
  daily: Float64Array;
  from: number;
  thresholds: number[];
  dataFrom: number;
  dataTo: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const [ref, available] = useWidth<HTMLDivElement>();
  const first = dayOf(year, 0, 1);
  const last = dayOf(year, 11, 31);
  const gridStart = weekStart(first);
  const weeks = Math.ceil((last - gridStart + 1) / 7);
  const left = 30;
  const top = 18;
  // Fill the card: 10 to 20px per week column; narrower screens scroll sideways.
  const step = Math.max(10, Math.min(20, Math.floor((available - left) / weeks) || 15));
  const gap = step >= 16 ? 4 : 3;
  const size = step - gap;
  const width = left + weeks * step;
  const height = top + 7 * step;

  const months = Array.from({ length: 12 }, (_, m) => {
    const start = dayOf(year, m, 1);
    return { start, x: left + Math.floor((start - gridStart) / 7) * step };
  });

  const value = (day: number) => (day >= from && day < from + daily.length ? daily[day - from] : 0);
  const position = (day: number) => ({
    x: left + Math.floor((day - gridStart) / 7) * step,
    y: top + weekdayOf(day) * step,
  });

  return (
    <div ref={ref} className="w-full">
      <div className="relative w-max" onPointerLeave={() => setActive(null)}>
        <svg width={width} height={height} role="img" aria-label={`Daily listening in ${year}`}>
          {months.map(({ start, x }) => (
            <text key={start} x={x} y={11} className="fill-ink-3 text-[11px]">
              {formatMonthShort(start)}
            </text>
          ))}
          {[0, 2, 4].map((w) => (
            <text key={w} x={0} y={top + w * step + size / 2} dy="0.32em" className="fill-ink-3 text-[10px]">
              {formatWeekday(w)}
            </text>
          ))}
          {Array.from({ length: last - first + 1 }, (_, k) => {
            const day = first + k;
            const { x, y } = position(day);
            const inData = day >= dataFrom && day <= dataTo;
            return (
              <rect
                key={day}
                x={x}
                y={y}
                width={size}
                height={size}
                rx={3}
                fill={sequentialColor(inData ? binOf(value(day), thresholds) : -1)}
                fillOpacity={inData ? 1 : 0.45}
                stroke={active === day ? "var(--ink)" : "none"}
                strokeWidth={1.5}
                onPointerEnter={() => setActive(day)}
                onPointerDown={() => setActive(day)}
              />
            );
          })}
        </svg>
        {active !== null && (
          <ChartTooltip
            x={position(active).x + size / 2}
            y={position(active).y + size / 2}
            containerWidth={width}
            title={formatDayLong(active)}
            rows={[
              {
                value: active < dataFrom || active > dataTo ? "No data" : value(active) ? formatDuration(value(active)) : "No listening",
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}

/** Rows of years, columns of months: compare the same month across years. */
export function MonthYearGrid({
  rows,
}: {
  rows: { year: number; ms: Float64Array; outside: boolean[] }[];
}) {
  const [active, setActive] = useState<{ row: number; month: number; x: number; y: number } | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>();
  const thresholds = useMemo(
    () =>
      quantileThresholds(
        rows.flatMap((row) => Array.from(row.ms).filter((_, m) => !row.outside[m])),
        SEQUENTIAL_STEPS,
      ),
    [rows],
  );

  return (
    <div ref={ref} className="relative" onPointerLeave={() => setActive(null)}>
      <div className="grid grid-cols-[44px_repeat(12,minmax(0,1fr))_64px] gap-[3px] text-[11px]">
        <span />
        {Array.from({ length: 12 }, (_, m) => {
          const name = formatMonthShort(dayOf(2024, m, 1));
          return (
            <span key={m} className="pb-1 text-center text-ink-3">
              <span className="sm:hidden" aria-hidden>
                {name.slice(0, 1)}
              </span>
              <span className="sr-only sm:not-sr-only">{name}</span>
            </span>
          );
        })}
        <span className="pb-1 text-right text-ink-3">Total</span>
        {rows.map((row, r) => (
          <div key={row.year} className="contents">
            <span className="flex items-center font-medium text-ink-2 tabular">{row.year}</span>
            {Array.from(row.ms).map((ms, m) => (
              <span
                key={m}
                className={cn(
                  "h-7 rounded-md transition-shadow sm:h-8",
                  active?.row === r && active.month === m && "ring-[1.5px] ring-ink",
                )}
                style={{
                  background: sequentialColor(row.outside[m] ? -1 : binOf(ms, thresholds)),
                  opacity: row.outside[m] ? 0.45 : 1,
                }}
                onPointerEnter={(event) => {
                  const target = event.currentTarget;
                  setActive({ row: r, month: m, x: target.offsetLeft + target.offsetWidth / 2, y: target.offsetTop + target.offsetHeight / 2 });
                }}
              />
            ))}
            <span className="flex items-center justify-end font-medium text-ink-2 tabular">
              {formatDuration(row.ms.reduce((a, b) => a + b, 0))}
            </span>
          </div>
        ))}
      </div>
      {active && (
        <ChartTooltip
          x={active.x}
          y={active.y}
          containerWidth={width}
          title={`${formatMonthShort(dayOf(2024, active.month, 1))} ${rows[active.row].year}`}
          rows={[
            {
              value: rows[active.row].outside[active.month]
                ? "No data"
                : formatDuration(rows[active.row].ms[active.month]),
            },
          ]}
        />
      )}
    </div>
  );
}
