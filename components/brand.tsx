import Link from "next/link";
import { cn } from "@/lib/ui";

export const APP_NAME = "Encore";

/** The app mark: an equaliser in a rounded tile. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <rect x="7.5" y="13" width="3" height="10" rx="1.5" fill="#fff" />
      <rect x="12.5" y="8" width="3" height="15" rx="1.5" fill="#fff" />
      <rect x="17.5" y="11" width="3" height="12" rx="1.5" fill="#fff" />
      <rect x="22.5" y="16" width="3" height="7" rx="1.5" fill="#fff" fillOpacity="0.75" />
    </svg>
  );
}

export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5 rounded-lg", className)}>
      <LogoMark className="size-7" />
      <span className="text-[17px] font-semibold tracking-[-0.02em] text-ink">{APP_NAME}</span>
    </Link>
  );
}
