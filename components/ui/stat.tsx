import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/ui";

/** A stat tile: label · value · supporting detail. Values use proportional figures. */
export function Stat({
  label,
  value,
  unit,
  detail,
  icon,
  className,
  style,
  children,
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  return (
    <div
      style={style}
      className={cn(
        "flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-[13px] font-medium text-ink-3">
        {icon && <span className="text-ink-3 [&_svg]:size-4">{icon}</span>}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-2 flex items-baseline gap-1.5 text-[26px] leading-none font-semibold tracking-[-0.03em] text-ink sm:text-[28px]">
        <span className="truncate">{value}</span>
        {unit && <span className="text-[15px] font-medium tracking-normal text-ink-3">{unit}</span>}
      </p>
      {detail && <p className="mt-2 text-[13px] leading-5 text-ink-3">{detail}</p>}
      {children}
    </div>
  );
}

/** A signed change vs a named period. Up isn't inherently good here, so it stays neutral ink with an arrow. */
export function Delta({ ratio, period }: { ratio: number | null; period: string }) {
  if (ratio === null || !Number.isFinite(ratio)) return null;
  const up = ratio >= 0;
  const percent = Math.abs(ratio) < 0.005 ? "0%" : `${Math.round(Math.abs(ratio) * 100)}%`;
  return (
    <span className="inline-flex items-center gap-1 text-[13px] text-ink-3">
      <span aria-hidden className="text-ink-2">
        {up ? "↑" : "↓"}
      </span>
      <span className="font-medium text-ink-2 tabular">{percent}</span>
      <span>vs {period}</span>
    </span>
  );
}
