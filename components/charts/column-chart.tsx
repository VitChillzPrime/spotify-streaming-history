"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { axisFor, columnPath, formatValue, maxOf, type ValueKind } from "@/components/charts/scale";
import { placeTicks, type Tick } from "@/components/charts/time-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { useWidth } from "@/components/charts/use-width";

/**
 * Vertical bars for one series over ordered categories (hours, weekdays,
 * months…). Bars are capped at 24px with a 4px rounded data end; each band is
 * the hover target. `highlight` direct-labels a single bar.
 */
export function ColumnChart({
  values,
  labels,
  ticks,
  name,
  kind = "duration",
  height = 220,
  color = "var(--series-1)",
  highlight = "max",
  note,
  dim,
}: {
  values: ArrayLike<number>;
  /** Full label of each bar, for tooltips. */
  labels: string[];
  /** Axis labels; defaults to every label, thinned to fit. */
  ticks?: Tick[];
  name: string;
  kind?: ValueKind;
  height?: number;
  color?: string;
  /** Bar to direct-label: an index, "max", or null for none. */
  highlight?: number | "max" | null;
  note?: (index: number) => string | null;
  /** Bars drawn faded (e.g. partial periods). */
  dim?: (index: number) => boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const n = values.length;
  const max = useMemo(() => maxOf(values), [values]);
  const axis = useMemo(() => axisFor(kind, max), [kind, max]);
  const yMax = axis.ticks[axis.ticks.length - 1] || 1;
  const labelWidth = Math.max(...axis.ticks.map((t) => axis.format(t).length)) * 6.5 + 12;
  const margin = { top: highlight === null ? 12 : 24, right: 8, bottom: 28, left: labelWidth };
  const plotW = Math.max(0, width - margin.left - margin.right);
  const plotH = height - margin.top - margin.bottom;
  const band = n ? plotW / n : 0;
  const barW = Math.max(1, Math.min(24, band - 2));
  const y = (v: number) => margin.top + plotH - (Math.max(0, v) / yMax) * plotH;
  const center = (i: number) => margin.left + band * i + band / 2;

  let labelled: number | null = null;
  if (highlight === "max") {
    for (let i = 0; i < n; i++) if (values[i] > 0 && (labelled === null || values[i] > values[labelled])) labelled = i;
  } else if (highlight !== null && highlight < n) {
    labelled = highlight;
  }

  const axisTicks = useMemo(() => {
    if (ticks) return ticks;
    const all = labels.map((label, index) => ({ index, label }));
    const fit = Math.max(2, Math.floor(plotW / 48));
    const stride = [1, 2, 3, 4, 6, 8, 12, 24].find((s) => Math.ceil(all.length / s) <= fit) ?? Math.ceil(all.length / fit);
    return all.filter((_, i) => i % stride === 0);
  }, [ticks, labels, plotW]);

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, Home: -n, End: n }[event.key];
    if (step === undefined) {
      if (event.key === "Escape") setActive(null);
      return;
    }
    event.preventDefault();
    setActive((current) => Math.max(0, Math.min(n - 1, (current ?? (step > 0 ? -1 : n)) + step)));
  };

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && n > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${name}. Use arrow keys to read values.`}
          tabIndex={0}
          className="block outline-none focus-visible:outline-2 focus-visible:outline-accent"
          onKeyDown={onKeyDown}
          onPointerLeave={() => setActive(null)}
          onBlur={() => setActive(null)}
        >
          {axis.ticks.map((tick) => (
            <g key={tick}>
              {tick > 0 && (
                <line x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} stroke="var(--grid)" strokeWidth={1} />
              )}
              <text x={margin.left - 10} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-ink-3 text-[11px] tabular">
                {axis.format(tick)}
              </text>
            </g>
          ))}
          {Array.from({ length: n }, (_, i) => {
            const v = values[i];
            const top = y(v);
            const isActive = active === i;
            return (
              <g key={i}>
                <path
                  d={columnPath(center(i) - barW / 2, top, barW, margin.top + plotH - top)}
                  fill={color}
                  fillOpacity={dim?.(i) ? 0.35 : active === null || isActive ? 1 : 0.55}
                  className="transition-[fill-opacity] duration-150"
                />
                <rect
                  x={margin.left + band * i}
                  y={margin.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={() => setActive(i)}
                />
              </g>
            );
          })}
          <line
            x1={margin.left}
            x2={width - margin.right}
            y1={margin.top + plotH}
            y2={margin.top + plotH}
            stroke="var(--axis)"
            strokeWidth={1}
          />
          {placeTicks(axisTicks, center, 2, width - 2).map((tick) => (
            <text key={tick.index} x={tick.x} y={height - 8} textAnchor={tick.anchor} className="fill-ink-3 text-[11px] tabular">
              {tick.label}
            </text>
          ))}
          {labelled !== null && active === null && (
            <text
              x={center(labelled)}
              y={y(values[labelled]) - 8}
              textAnchor={center(labelled) - margin.left < 40 ? "start" : width - center(labelled) < 40 ? "end" : "middle"}
              className="pointer-events-none fill-ink-2 text-[11px] font-medium tabular"
            >
              {formatValue(kind, values[labelled])}
            </text>
          )}
        </svg>
      )}
      {active !== null && (
        <ChartTooltip
          x={center(active)}
          y={Math.max(36, Math.min(height - 40, y(values[active])))}
          containerWidth={width}
          title={labels[active]}
          rows={[{ color, value: formatValue(kind, values[active]), label: name }]}
          note={note?.(active)}
        />
      )}
      <p className="sr-only" aria-live="polite">
        {active !== null ? `${labels[active]}: ${formatValue(kind, values[active])}` : ""}
      </p>
    </div>
  );
}
