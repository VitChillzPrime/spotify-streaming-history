import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/ui";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn("min-w-0 rounded-2xl border border-line bg-surface shadow-card", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 sm:px-6", className)}>
      <div className="min-w-0 flex-1 basis-56">
        <h2 id={id} className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-[13px] leading-5 text-ink-3">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </header>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-5 pt-4 pb-5 sm:px-6 sm:pb-6", className)} {...props} />;
}

/** A small uppercase label used above groups of content. */
export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return (
    <p className={cn("text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase", className)} {...props} />
  );
}
