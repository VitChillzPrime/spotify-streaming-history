import type { CSSProperties } from "react";
import { cn, hueOf, initials } from "@/lib/ui";

const SIZES = {
  sm: "size-8 text-[11px]",
  md: "size-10 text-[13px]",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl",
} as const;

/**
 * A tinted initials tile standing in for artwork (the export has no images, and
 * fetching covers would send your history to a third party). Artists are round.
 */
export function Monogram({
  name,
  seed,
  size = "md",
  round = false,
  className,
}: {
  name: string;
  /** Text that picks the tint; defaults to `name`. Songs use their artist so they match. */
  seed?: string;
  size?: keyof typeof SIZES;
  round?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      style={{ "--h": hueOf(seed ?? name) } as CSSProperties}
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold tracking-tight select-none",
        "bg-[oklch(0.93_0.035_var(--h))] text-[oklch(0.42_0.1_var(--h))]",
        "dark:bg-[oklch(0.3_0.045_var(--h))] dark:text-[oklch(0.86_0.07_var(--h))]",
        round ? "rounded-full" : "rounded-[28%]",
        SIZES[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
