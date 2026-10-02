import type { CSSProperties } from "react";
import { cn, hueOf, initials } from "@/lib/ui";

export const TILE_SIZES = {
  sm: "size-8",
  md: "size-10",
  lg: "size-14",
  xl: "size-20",
} as const;

const TEXT_SIZES = {
  sm: "text-[11px]",
  md: "text-[13px]",
  lg: "text-lg",
  xl: "text-2xl",
} as const;

/**
 * A tinted initials tile: shown while cover art loads, and in its place when
 * artwork is turned off or Spotify has none for the item.
 */
export function Monogram({
  name,
  seed,
  size = "md",
  round = false,
  fill = false,
  className,
}: {
  name: string;
  /** Text that picks the tint; defaults to `name`. Songs use their artist so they match. */
  seed?: string;
  size?: keyof typeof TILE_SIZES;
  round?: boolean;
  /** Fill the parent instead of using the size's dimensions. */
  fill?: boolean;
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
        round ? "rounded-full" : "rounded-[22%]",
        fill ? "size-full" : TILE_SIZES[size],
        TEXT_SIZES[size],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
