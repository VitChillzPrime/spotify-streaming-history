"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

export interface TooltipRow {
  /** Series colour, shown as a short line key. */
  color?: string;
  label?: string;
  value: string;
}

const GAP = 14;
const EDGE = 4;

/**
 * The hover readout. Values lead (strong ink), labels follow; series are keyed
 * with a short stroke, never coloured text. It sits beside the point, flips
 * sides near an edge, and on narrow charts centres above (or below) the point,
 * always staying inside the chart.
 */
export function ChartTooltip({
  x,
  y,
  containerWidth,
  title,
  rows,
  note,
}: {
  x: number;
  y: number;
  containerWidth: number;
  title: ReactNode;
  rows: TooltipRow[];
  note?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    let left = x + GAP;
    let top = y - height / 2;
    if (left + width > containerWidth - EDGE) left = x - GAP - width;
    if (left < EDGE) {
      left = Math.max(EDGE, Math.min(containerWidth - width - EDGE, x - width / 2));
      top = y - height - GAP;
      if (top < -height / 2) top = y + GAP;
    }
    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
    el.style.visibility = "visible";
  });

  return (
    <div
      ref={ref}
      className="pointer-events-none invisible absolute top-0 left-0 z-20 w-max max-w-64 rounded-xl border border-line bg-surface px-3 py-2 shadow-float"
    >
      <p className="text-[11px] leading-4 font-medium text-ink-3">{title}</p>
      {rows.map((row, i) => (
        <div key={i} className="mt-1 flex items-center gap-2">
          {row.color && <span aria-hidden className="h-[3px] w-3 shrink-0 rounded-full" style={{ background: row.color }} />}
          <span className="text-[13px] leading-4 font-semibold text-ink tabular">{row.value}</span>
          {row.label && <span className="truncate text-xs text-ink-3">{row.label}</span>}
        </div>
      ))}
      {note && <p className="mt-1 text-[11px] leading-4 text-ink-3">{note}</p>}
    </div>
  );
}
