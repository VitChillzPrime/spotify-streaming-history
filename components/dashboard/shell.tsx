"use client";

import { Database, Menu, Settings, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Brand } from "@/components/brand";
import { EntitySheetProvider } from "@/components/dashboard/entity-sheet";
import { NAV } from "@/components/dashboard/nav";
import { SettingsDialog } from "@/components/dashboard/settings-dialog";
import { useData, usePrepared } from "@/components/data-provider";
import { Dropzone } from "@/components/import/dropzone";
import { ThemeToggle } from "@/components/theme";
import { IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatMonth, formatNumber } from "@/lib/format";
import { cn } from "@/lib/ui";

export function DashboardShell({ children }: { children: ReactNode }) {
  const { status } = useData();
  if (status === "loading") return <LoadingScreen />;
  if (status === "empty") return <NoData />;
  return <ReadyShell>{children}</ReadyShell>;
}

function ReadyShell({ children }: { children: ReactNode }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { saveError } = useData();

  return (
    <EntitySheetProvider>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-line bg-page lg:flex">
        <div className="px-6 pt-6 pb-5">
          <Brand />
        </div>
        <NavLinks />
        <SidebarFooter onSettings={() => setSettingsOpen(true)} />
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-page/85 px-4 backdrop-blur-md lg:hidden">
        <Brand />
        <div className="flex items-center gap-1">
          <IconButton label="Settings" onClick={() => setSettingsOpen(true)}>
            <Settings />
          </IconButton>
          <IconButton label="Open menu" onClick={() => setMenuOpen(true)}>
            <Menu />
          </IconButton>
        </div>
      </header>

      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} variant="sheet" size="sm" label="Menu">
        <div className="flex h-full flex-col">
          <div className="px-6 pt-6 pb-5">
            <Brand />
          </div>
          <NavLinks onNavigate={() => setMenuOpen(false)} />
          <SidebarFooter
            onSettings={() => {
              setMenuOpen(false);
              setSettingsOpen(true);
            }}
          />
        </div>
      </Dialog>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <div className="lg:pl-[264px]">
        <main className="mx-auto w-full max-w-[1240px] px-4 pt-6 pb-16 sm:px-6 lg:px-10 lg:pt-10">
          {saveError && (
            <div role="alert" className="mb-6 flex items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-[13px] shadow-card">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
              <p className="text-ink-2">{saveError}</p>
            </div>
          )}
          {children}
        </main>
      </div>
    </EntitySheetProvider>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const p = usePrepared();
  return (
    <nav aria-label="Dashboard" className="flex-1 overflow-y-auto px-3">
      {NAV.map((group) => {
        const items = group.items.filter(
          (item) =>
            (item.requires === undefined || p.kindCounts[item.requires] > 0) &&
            (item.feature === undefined || p.ds.meta.features[item.feature]),
        );
        if (items.length === 0) return null;
        return (
          <div key={group.label} className="mb-5">
            <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-[0.08em] text-ink-3 uppercase">{group.label}</p>
            <ul className="space-y-0.5">
              {items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                        active ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                      )}
                    >
                      <Icon className={cn("size-[18px]", active ? "text-accent" : "text-ink-3")} aria-hidden />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ onSettings }: { onSettings: () => void }) {
  const { dataset } = useData();
  const p = usePrepared();
  return (
    <div className="space-y-3 border-t border-line p-4">
      <div className="flex items-center gap-3 rounded-xl px-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-surface-2 text-ink-3">
          <Database className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 text-xs leading-4">
          <p className="font-medium text-ink tabular">{formatNumber(dataset?.size ?? 0)} plays</p>
          <p className="truncate text-ink-3">
            {formatMonth(p.firstDay)} to {formatMonth(p.lastDay)}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onSettings}
          className="inline-flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Settings className="size-4" aria-hidden /> Settings
        </button>
        <ThemeToggle />
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-dvh items-center justify-center" role="status" aria-label="Loading your stats">
      <div className="flex items-end gap-1" aria-hidden>
        {[0.55, 1, 0.75, 0.4].map((scale, i) => (
          <span
            key={i}
            className="eq-bar block h-8 w-1.5 rounded-full bg-accent"
            style={{ animationDelay: `${i * 0.15}s`, transform: `scaleY(${scale})` }}
          />
        ))}
      </div>
    </div>
  );
}

function NoData() {
  return (
    <div className="min-h-dvh">
      <header className="flex h-16 items-center justify-between px-4 sm:px-8">
        <Brand />
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-xl px-4 pt-10 pb-20 sm:pt-20">
        <h1 className="text-center text-3xl font-semibold tracking-[-0.03em] text-ink">No data yet</h1>
        <p className="mt-2 mb-8 text-center text-[15px] text-ink-3">
          Import your Spotify export to see your stats. Not sure how to get it?{" "}
          <Link href="/#get-your-data" className="font-medium text-accent-ink hover:underline">
            Here&rsquo;s how
          </Link>
          .
        </p>
        <Dropzone />
      </main>
    </div>
  );
}
