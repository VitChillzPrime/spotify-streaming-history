"use client";

import type { ReactNode } from "react";
import { FilterBar } from "@/components/dashboard/filters";
import { useScope } from "@/components/dashboard/use-scope";
import { rangeSpan } from "@/lib/range";

export function PageHeader({
  title,
  description,
  filters = true,
  kinds = false,
  children,
}: {
  title: string;
  /** Defaults to the selected date span. */
  description?: ReactNode;
  filters?: boolean;
  /** Show the music / podcasts / audiobooks filter. */
  kinds?: boolean;
  children?: ReactNode;
}) {
  const { range } = useScope();
  return (
    // z-20: the header's fade-in creates a stacking context; lift it so the date picker opens over the cards below.
    <div className="relative z-20 mb-6 flex animate-fade flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.025em] text-ink sm:text-[30px]">{title}</h1>
        <p className="mt-1 text-sm text-ink-3">{description ?? rangeSpan(range)}</p>
      </div>
      {(filters || children) && (
        <div className="flex flex-wrap items-center gap-2">
          {children}
          {filters && <FilterBar kinds={kinds} />}
        </div>
      )}
    </div>
  );
}

/** A heading for a group of cards within a page. */
export function SectionTitle({ children, description }: { children: ReactNode; description?: ReactNode }) {
  return (
    <div className="mt-10 mb-4 sm:mt-12">
      <h2 className="text-lg font-semibold tracking-[-0.015em] text-ink">{children}</h2>
      {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
    </div>
  );
}
