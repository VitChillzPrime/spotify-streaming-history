import type { ReactNode } from "react";
import { cn } from "@/lib/ui";

export interface BarItem {
  key: string;
  label: ReactNode;
  /** Drives the bar length. */
  value: number;
  /** The figure shown at the bar's end. */
  display: string;
  hint?: ReactNode;
  onSelect?: () => void;
}

/**
 * Ranked horizontal bars for one series (nominal categories): every bar wears
 * the same slot-1 colour, values sit at the bar end in text ink.
 */
export function BarList({
  items,
  className,
  max,
  columns = 1,
}: {
  items: BarItem[];
  className?: string;
  max?: number;
  /** Two columns from the `sm` breakpoint up. */
  columns?: 1 | 2;
}) {
  const top = max ?? Math.max(0, ...items.map((item) => item.value));
  return (
    <ul className={cn(columns === 2 ? "grid gap-x-8 gap-y-3 sm:grid-cols-2" : "space-y-3", className)}>
      {items.map((item) => {
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate text-ink-2">{item.label}</span>
              <span className="shrink-0 font-medium text-ink tabular">
                {item.display}
                {item.hint && <span className="ml-1.5 font-normal text-ink-3">{item.hint}</span>}
              </span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full origin-left animate-grow-x rounded-full bg-series-1"
                style={{ width: `${top ? Math.max(0.5, (item.value / top) * 100) : 0}%` }}
              />
            </div>
          </>
        );
        return (
          <li key={item.key}>
            {item.onSelect ? (
              <button type="button" onClick={item.onSelect} className="-m-1.5 block w-[calc(100%+12px)] rounded-xl p-1.5 text-left hover:bg-surface-2">
                {body}
              </button>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
