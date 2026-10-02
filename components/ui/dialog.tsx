"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/ui";
import { IconButton } from "@/components/ui/button";

/**
 * A modal built on the native <dialog> element: focus is trapped, the page
 * behind is inert, and Escape closes it. `variant="sheet"` slides in from the right.
 */
const WIDTHS = {
  center: { sm: "max-w-lg", md: "max-w-xl" },
  sheet: { sm: "max-w-[320px]", md: "max-w-[600px]" },
} as const;

export function Dialog({
  open,
  onClose,
  children,
  label,
  variant = "center",
  size = variant === "sheet" ? "md" : "sm",
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label: string;
  variant?: "center" | "sheet";
  size?: "sm" | "md";
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the <dialog> itself.
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "border-line bg-surface p-0 text-ink shadow-float backdrop:bg-transparent",
        variant === "sheet"
          ? "fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-full border-l open:animate-sheet sm:rounded-l-3xl"
          : "m-auto max-h-[min(860px,calc(100dvh-2rem))] w-[calc(100%-2rem)] rounded-3xl border open:animate-pop",
        WIDTHS[variant][size],
        className,
      )}
    >
      {open && children}
    </dialog>
  );
}

export function DialogHeader({
  title,
  description,
  onClose,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <header className="flex items-start gap-3 px-6 pt-6 pb-4">
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        {description && <p className="mt-1 text-[13px] leading-5 text-ink-3">{description}</p>}
        {children}
      </div>
      <IconButton label="Close" onClick={onClose} className="-mt-1 -mr-2">
        <X />
      </IconButton>
    </header>
  );
}
