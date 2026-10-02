"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/ui";

/**
 * A button that opens a floating panel. Closes on outside click, Escape, or
 * when the panel calls `close()`; focus returns to the trigger.
 */
export function Popover({
  trigger,
  triggerClassName,
  children,
  align = "end",
  className,
  panelClassName,
  label,
}: {
  trigger: ReactNode;
  triggerClassName?: string;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
  className?: string;
  panelClassName?: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  // Bumped whenever the panel closes from inside, so focus can go back to the trigger.
  const [refocus, setRefocus] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  const close = useCallback(() => {
    setOpen(false);
    setRefocus((count) => count + 1);
  }, []);

  useEffect(() => {
    if (refocus > 0) button.current?.focus();
  }, [refocus]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        ref={button}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute top-full z-40 mt-2 min-w-56 origin-top animate-pop rounded-2xl border border-line bg-surface p-1.5 shadow-float",
            align === "end" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

export function MenuItem({
  selected,
  onSelect,
  children,
  hint,
}: {
  selected?: boolean;
  onSelect: () => void;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-surface-2",
        selected ? "font-semibold text-ink" : "text-ink-2",
      )}
    >
      <span className="flex size-4 items-center justify-center" aria-hidden>
        {selected && (
          <svg viewBox="0 0 16 16" className="size-4 text-accent-ink">
            <path
              d="M3.5 8.5l3 3 6-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className="flex-1">{children}</span>
      {hint && <span className="text-xs font-normal text-ink-3 tabular">{hint}</span>}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="mx-2 my-1.5 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <p className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{children}</p>;
}
