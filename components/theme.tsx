"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useLayoutEffect, useRef } from "react";
import { applyTheme, onSystemThemeChange, themeStore, type ThemePreference } from "@/lib/theme";
import { cn } from "@/lib/ui";

/** Keeps <html data-theme> in sync with the saved preference, the OS setting and other tabs. */
export function ThemeSync() {
  const [preference] = themeStore.useValue();
  const applied = useRef<ThemePreference | null>(null);

  // Reads storage directly: while hydrating, `preference` is still the server default ("system"),
  // and applying that would flash the wrong theme. Also re-applies after React's dev-mode remount
  // resets <html> attributes. Only real changes after the first paint cross-fade.
  useLayoutEffect(() => {
    const stored = themeStore.get();
    applyTheme(stored, applied.current !== null && applied.current !== stored);
    applied.current = stored;
  }, [preference]);

  useEffect(() => {
    if (preference !== "system") return;
    return onSystemThemeChange(() => applyTheme("system", true));
  }, [preference]);

  return null;
}

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeToggle({ className, showLabels = false }: { className?: string; showLabels?: boolean }) {
  const [preference, setPreference] = themeStore.useValue();
  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn("inline-flex items-center gap-0.5 rounded-full border border-line bg-surface-2 p-0.5", className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={showLabels ? undefined : label}
            title={label}
            onClick={() => setPreference(value)}
            className={cn(
              "inline-flex h-7 items-center justify-center gap-1.5 rounded-full text-xs font-medium transition-colors",
              showLabels ? "px-3" : "w-7",
              active ? "bg-surface text-ink shadow-card" : "text-ink-3 hover:text-ink",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {showLabels && label}
          </button>
        );
      })}
    </div>
  );
}
