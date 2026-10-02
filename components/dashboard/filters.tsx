"use client";

import { CalendarRange, ChevronDown } from "lucide-react";
import { useState } from "react";
import { useAvailableKinds } from "@/components/dashboard/use-scope";
import { usePrepared } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import { MenuItem, MenuLabel, MenuSeparator, Popover } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";
import { isRangeValid, rangeLabel, RECENT_PRESETS, type RangeSpec } from "@/lib/range";
import { filtersStore, type KindFilter } from "@/lib/settings";
import { dayOf, dayParts } from "@/lib/time";
import { cn } from "@/lib/ui";

const sameRange = (a: RangeSpec, b: RangeSpec) => JSON.stringify(a) === JSON.stringify(b);

function toInputValue(day: number): string {
  const { year, month, date } = dayParts(day);
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(date).padStart(2, "0")}`;
}

function fromInputValue(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? dayOf(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

export function RangePicker() {
  const p = usePrepared();
  const [filters, setFilters] = filtersStore.useValue();
  const current = isRangeValid(p, filters.range) ? filters.range : ({ type: "all" } as const);
  const [from, setFrom] = useState(() => toInputValue(current.type === "custom" ? current.from : p.firstDay));
  const [to, setTo] = useState(() => toInputValue(current.type === "custom" ? current.to : p.lastDay));
  const select = (range: RangeSpec) => setFilters({ ...filters, range });
  const customFrom = fromInputValue(from);
  const customTo = fromInputValue(to);

  return (
    <Popover
      label="Date range"
      panelClassName="w-72"
      triggerClassName="inline-flex h-9 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-[13px] font-medium text-ink shadow-card transition-colors hover:bg-surface-2"
      trigger={
        <>
          <CalendarRange className="size-4 text-ink-3" aria-hidden />
          <span className="sr-only">Date range: </span>
          {rangeLabel(current)}
          <ChevronDown className="size-4 text-ink-3" aria-hidden />
        </>
      }
    >
      {(close) => {
        const pick = (range: RangeSpec) => {
          select(range);
          close();
        };
        return (
          <div>
            <MenuItem selected={current.type === "all"} onSelect={() => pick({ type: "all" })}>
              All time
            </MenuItem>
            <MenuSeparator />
            <MenuLabel>Year</MenuLabel>
            {[...p.years].reverse().map((year) => (
              <MenuItem
                key={year}
                selected={sameRange(current, { type: "year", year })}
                onSelect={() => pick({ type: "year", year })}
              >
                {year}
              </MenuItem>
            ))}
            <MenuSeparator />
            <MenuLabel>Most recent</MenuLabel>
            {RECENT_PRESETS.map((preset) => (
              <MenuItem
                key={preset.days}
                selected={sameRange(current, { type: "recent", days: preset.days })}
                onSelect={() => pick({ type: "recent", days: preset.days })}
              >
                {preset.label}
              </MenuItem>
            ))}
            <MenuSeparator />
            <form
              className="space-y-2 px-2.5 pt-1 pb-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (customFrom !== null && customTo !== null) pick({ type: "custom", from: customFrom, to: customTo });
              }}
            >
              <MenuLabel>Custom range</MenuLabel>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px] text-ink-3">
                  From
                  <input
                    type="date"
                    value={from}
                    min={toInputValue(p.firstDay)}
                    max={toInputValue(p.lastDay)}
                    onChange={(event) => setFrom(event.target.value)}
                    className="mt-1 h-8 w-full rounded-lg border border-line bg-surface-2 px-2 text-xs text-ink"
                  />
                </label>
                <label className="text-[11px] text-ink-3">
                  To
                  <input
                    type="date"
                    value={to}
                    min={toInputValue(p.firstDay)}
                    max={toInputValue(p.lastDay)}
                    onChange={(event) => setTo(event.target.value)}
                    className="mt-1 h-8 w-full rounded-lg border border-line bg-surface-2 px-2 text-xs text-ink"
                  />
                </label>
              </div>
              <Button type="submit" size="sm" variant="primary" className="w-full" disabled={customFrom === null || customTo === null}>
                Apply range
              </Button>
            </form>
          </div>
        );
      }}
    </Popover>
  );
}

const KIND_LABELS: Record<KindFilter, string> = {
  all: "Everything",
  music: "Music",
  podcasts: "Podcasts",
  audiobooks: "Audiobooks",
};

/** Content filter; only shown when the data has more than one kind of content. */
export function KindPicker() {
  const available = useAvailableKinds();
  const [filters, setFilters] = filtersStore.useValue();
  if (available.length < 2) return null;
  const value = filters.kind === "all" || available.includes(filters.kind) ? filters.kind : "all";
  const options = (["all", ...available] as KindFilter[]).map((kind) => ({ value: kind, label: KIND_LABELS[kind] }));
  return (
    <Segmented
      label="Content"
      value={value}
      options={options}
      onChange={(kind) => setFilters({ ...filters, kind })}
    />
  );
}

export function FilterBar({ kinds = false, className }: { kinds?: boolean; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {kinds && <KindPicker />}
      <RangePicker />
    </div>
  );
}
