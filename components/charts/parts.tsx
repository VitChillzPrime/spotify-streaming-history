"use client";

import { useMemo, useState } from "react";
import { formatValue, maxOf, monotonePath, type ValueKind } from "@/components/charts/scale";
import { ChartTooltip } from "@/components/charts/tooltip";
import { useWidth } from "@/components/charts/use-width";
import { formatPercent } from "@/lib/format";
import { cn } from "@/lib/ui";

/** Categorical slots in their validated order. Assign in sequence; fold the rest into "Other". */
export const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];
export const OTHER_COLOR = "var(--series-other)";

export interface Part {
  key: string;
  label: string;
  value: number;
  color: string;
  detail?: string;
}

/** Part-to-whole as one horizontal bar, separated by 2px surface gaps, with a labelled legend. */
export function StackedBar({
  parts,
  kind = "duration",
  columns = 1,
  className,
}: {
  parts: Part[];
  kind?: ValueKind;
  /** Legend columns from the `sm` breakpoint up. */
  columns?: 1 | 2;
  className?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const visible = parts.filter((part) => part.value > 0);
  const segments: { part: Part; start: number; share: number }[] = [];
  for (let i = 0, start = 0; i < visible.length; i++) {
    const share = total ? visible[i].value / total : 0;
    segments.push({ part: visible[i], start, share });
    start += share;
  }

  return (
    <div className={className}>
      <div ref={ref} className="relative" onPointerLeave={() => setActive(null)}>
        <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={visible.map((p) => `${p.label} ${formatPercent(total ? p.value / total : 0)}`).join(", ")}>
          {segments.map(({ part, share }, i) => (
            <div
              key={part.key}
              className={cn("h-full min-w-[3px] transition-opacity", active !== null && active !== i && "opacity-45")}
              style={{ width: `${share * 100}%`, background: part.color }}
              onPointerEnter={() => setActive(i)}
              onPointerDown={() => setActive(i)}
            />
          ))}
        </div>
        {active !== null && segments[active] && (
          <ChartTooltip
            x={(segments[active].start + segments[active].share / 2) * width}
            y={6}
            containerWidth={width}
            title={segments[active].part.label}
            rows={[
              {
                color: segments[active].part.color,
                value: formatValue(kind, segments[active].part.value),
                label: formatPercent(segments[active].share),
              },
            ]}
            note={segments[active].part.detail}
          />
        )}
      </div>
      <ul className={cn("mt-4 grid gap-x-6 gap-y-2.5", columns === 2 && "sm:grid-cols-2")}>
        {visible.map((part, i) => (
          <li
            key={part.key}
            className="flex min-w-0 items-center gap-2.5 text-[13px]"
            onPointerEnter={() => setActive(i)}
            onPointerLeave={() => setActive(null)}
          >
            <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: part.color }} />
            <span className="min-w-0 flex-1 truncate text-ink-2">{part.label}</span>
            <span className="font-medium text-ink tabular">{formatValue(kind, part.value)}</span>
            <span className="w-10 text-right text-ink-3 tabular">{formatPercent(total ? part.value / total : 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A tiny trend line without axes. */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  color = "var(--series-1)",
  className,
}: {
  values: ArrayLike<number>;
  width?: number;
  height?: number;
  color?: string;
  className?: string;
}) {
  const paths = useMemo(() => {
    const n = values.length;
    if (n < 2) return null;
    const max = maxOf(values) || 1;
    const xs = Array.from({ length: n }, (_, i) => 1 + (i / (n - 1)) * (width - 2));
    const ys = Array.from({ length: n }, (_, i) => height - 2 - (values[i] / max) * (height - 4));
    const line = monotonePath(xs, ys);
    return { line, area: `${line}L${xs[n - 1]},${height}L${xs[0]},${height}Z` };
  }, [values, width, height]);
  if (!paths) return null;
  return (
    <svg width={width} height={height} aria-hidden className={cn("block overflow-visible", className)}>
      <path d={paths.area} fill={color} fillOpacity={0.1} />
      <path d={paths.line} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Legend({ items, className }: { items: { label: string; color: string; shape?: "box" | "line" }[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2", className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={item.shape === "line" ? "h-[3px] w-3.5 rounded-full" : "size-2.5 rounded-[3px]"}
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** A thin horizontal meter for a share (0–1). */
export function Meter({ value, color = "var(--series-1)", className }: { value: number; color?: string; className?: string }) {
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-3", className)}>
      <div
        className="h-full origin-left animate-grow-x rounded-full"
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }}
      />
    </div>
  );
}
