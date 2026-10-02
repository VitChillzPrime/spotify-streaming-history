"use client";

import { cn } from "@/lib/ui";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** A compact single-choice control (radio group semantics). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  size = "md",
}: {
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl bg-surface-2 p-0.5", className)}
      onKeyDown={(event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
        event.preventDefault();
        const index = options.findIndex((option) => option.value === value);
        const next = (index + (event.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
        onChange(options[next].value);
        const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]");
        buttons[next]?.focus();
      }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "shrink-0 rounded-[10px] font-medium whitespace-nowrap transition-colors",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-[13px]",
              active ? "bg-surface text-ink shadow-card" : "text-ink-3 hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
