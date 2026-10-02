"use client";

import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { axisFor, formatValue, maxOf, monotonePath, type ValueKind } from "@/components/charts/scale";
import { bucketLabel, placeTicks, timeTicks } from "@/components/charts/time-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { useWidth } from "@/components/charts/use-width";
import type { Bucket, Granularity } from "@/lib/stats/time";

/**
 * A single-series trend over time: a 2px line over a 10% wash, with a
 * crosshair that snaps to the nearest bucket. Arrow keys move it too.
 */
export function TimeChart({
  values,
  buckets,
  granularity,
  name,
  kind = "duration",
  height = 240,
  color = "var(--series-1)",
  showPeak = true,
  note,
}: {
  values: ArrayLike<number>;
  buckets: Bucket[];
  granularity: Granularity;
  /** What the series is, e.g. "Listening time". */
  name: string;
  kind?: ValueKind;
  height?: number;
  color?: string;
  showPeak?: boolean;
  /** Extra tooltip line for a bucket. */
  note?: (index: number) => string | null;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const n = values.length;

  const max = useMemo(() => maxOf(values), [values]);
  const axis = useMemo(() => axisFor(kind, max), [kind, max]);
  const yMax = axis.ticks[axis.ticks.length - 1] || 1;
  const labelWidth = Math.max(...axis.ticks.map((t) => axis.format(t).length)) * 6.5 + 12;
  const margin = { top: showPeak ? 26 : 12, right: 14, bottom: 28, left: labelWidth };
  const plotW = Math.max(0, width - margin.left - margin.right);
  const plotH = height - margin.top - margin.bottom;
  const x = (i: number) => margin.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v: number) => margin.top + plotH - (Math.max(0, v) / yMax) * plotH;

  const { line, area, peak } = useMemo(() => {
    const xs: number[] = [];
    const ys: number[] = [];
    let peakIndex = 0;
    for (let i = 0; i < n; i++) {
      xs.push(margin.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW));
      ys.push(margin.top + plotH - (Math.max(0, values[i]) / yMax) * plotH);
      if (values[i] > values[peakIndex]) peakIndex = i;
    }
    const path = monotonePath(xs, ys);
    const baseline = margin.top + plotH;
    return {
      line: path,
      area: n ? `${path}L${xs[n - 1]},${baseline}L${xs[0]},${baseline}Z` : "",
      peak: n ? peakIndex : null,
    };
  }, [values, n, plotW, plotH, yMax, margin.left, margin.top]);

  const ticks = useMemo(
    () => timeTicks(buckets, granularity, Math.max(2, Math.floor(plotW / 72))),
    [buckets, granularity, plotW],
  );

  const indexAt = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left - margin.left;
    if (n <= 1) return 0;
    return Math.max(0, Math.min(n - 1, Math.round((px / plotW) * (n - 1))));
  };

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (!n) return;
    const step = { ArrowRight: 1, ArrowLeft: -1, Home: -n, End: n }[event.key];
    if (step === undefined) {
      if (event.key === "Escape") setActive(null);
      return;
    }
    event.preventDefault();
    setActive((current) => Math.max(0, Math.min(n - 1, (current ?? (step > 0 ? -1 : n)) + step)));
  };

  const activeText =
    active !== null && buckets[active]
      ? `${bucketLabel(buckets[active], granularity)}: ${formatValue(kind, values[active])}`
      : "";
  const peakX = peak !== null ? x(peak) : 0;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && n > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${name} by ${granularity}. Use arrow keys to read values.`}
          tabIndex={0}
          className="block touch-pan-y outline-none focus-visible:outline-2 focus-visible:outline-accent"
          onPointerMove={(event) => setActive(indexAt(event))}
          onPointerDown={(event) => setActive(indexAt(event))}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKeyDown}
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
          <path d={area} fill={color} fillOpacity={0.1} />
          <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <line
            x1={margin.left}
            x2={width - margin.right}
            y1={margin.top + plotH}
            y2={margin.top + plotH}
            stroke="var(--axis)"
            strokeWidth={1}
          />
          {placeTicks(ticks, x, 2, width - 2).map((tick) => (
            <text key={tick.index} x={tick.x} y={height - 8} textAnchor={tick.anchor} className="fill-ink-3 text-[11px] tabular">
              {tick.label}
            </text>
          ))}
          {showPeak && peak !== null && values[peak] > 0 && active === null && (
            <g>
              <circle cx={peakX} cy={y(values[peak])} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
              <text
                x={peakX}
                y={y(values[peak]) - 10}
                textAnchor={peakX - margin.left < 60 ? "start" : width - margin.right - peakX < 60 ? "end" : "middle"}
                className="fill-ink-2 text-[11px] font-medium tabular"
              >
                Peak · {formatValue(kind, values[peak])}
              </text>
            </g>
          )}
          {active !== null && (
            <g pointerEvents="none">
              <line
                x1={x(active)}
                x2={x(active)}
                y1={margin.top - 6}
                y2={margin.top + plotH}
                stroke="var(--ink-3)"
                strokeWidth={1}
              />
              <circle cx={x(active)} cy={y(values[active])} r={4.5} fill={color} stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
        </svg>
      )}
      {active !== null && buckets[active] && (
        <ChartTooltip
          x={x(active)}
          y={Math.max(36, Math.min(height - 36, y(values[active])))}
          containerWidth={width}
          title={bucketLabel(buckets[active], granularity)}
          rows={[{ color, value: formatValue(kind, values[active]), label: name }]}
          note={note?.(active)}
        />
      )}
      <p className="sr-only" aria-live="polite">
        {activeText}
      </p>
    </div>
  );
}
