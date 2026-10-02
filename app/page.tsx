import {
  CalendarRange,
  Clock,
  Compass,
  Cpu,
  Database,
  Flame,
  Lock,
  Mail,
  MousePointerClick,
  ShieldCheck,
  SkipForward,
  Trash2,
  Trophy,
  Upload,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { APP_NAME, Brand } from "@/components/brand";
import { Equalizer } from "@/components/landing/equalizer";
import { HeaderAction, ImportPanel } from "@/components/landing/import-panel";
import { ThemeToggle } from "@/components/theme";

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Trophy,
    title: "Top artists, tracks & albums",
    body: "Ranked by time or streams for any period, with trends, first listens and a deep-dive for every name.",
  },
  {
    icon: Clock,
    title: "Your listening clock",
    body: "The hours and weekdays you press play, a day-by-day calendar, and how every year compares.",
  },
  {
    icon: Flame,
    title: "Streaks & records",
    body: "Longest streaks, biggest days, marathon sessions and the songs you played on repeat.",
  },
  {
    icon: SkipForward,
    title: "Habits",
    body: "Skip rates, shuffle, offline listening, how plays start and end, devices and countries.",
  },
  {
    icon: Compass,
    title: "Discovery & eras",
    body: "New artists over time, your top artist of every month, loyal favourites and forgotten ones.",
  },
  {
    icon: CalendarRange,
    title: "Year in review",
    body: "A recap of every year in your history, not just the last one, side by side.",
  },
];

const STEPS: { icon: LucideIcon; title: string; body: ReactNode }[] = [
  {
    icon: MousePointerClick,
    title: "Request your data",
    body: (
      <>
        Open{" "}
        <a
          href="https://www.spotify.com/account/privacy/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-accent-ink underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
        >
          Spotify&rsquo;s privacy settings
        </a>
        , tick <strong className="font-semibold text-ink">Extended streaming history</strong> (your whole history, with
        skips and devices) and request it. &ldquo;Account data&rdquo; works too, but covers only the last year.
      </>
    ),
  },
  {
    icon: Mail,
    title: "Wait for the email",
    body: "Spotify emails you a download link once it's ready, usually within a few days and sometimes up to 30.",
  },
  {
    icon: Upload,
    title: "Drop the zip here",
    body: "Drop my_spotify_data.zip (or the JSON files inside it) above. It's read on your device in a few seconds.",
  },
];

const PRIVACY: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Cpu, title: "Processed on your device", body: "Files are unzipped and parsed by your browser. Nothing is uploaded, ever." },
  { icon: Database, title: "Stored in this browser", body: "Your stats are kept in this browser's IndexedDB so they're here next time." },
  { icon: ShieldCheck, title: "No accounts, no tracking", body: "No sign-up, no analytics, no third-party requests with your listening data." },
  { icon: Trash2, title: "Delete anytime", body: "Remove everything from Settings in one click. IP addresses in the export are never read." },
];

export default function HomePage() {
  return (
    <div className="relative overflow-x-clip">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[720px] bg-[radial-gradient(60%_55%_at_50%_0%,var(--accent-wash-strong),transparent_70%)]"
      />

      <header className="relative z-10 mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Brand />
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <a href="#get-your-data" className="hidden rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink-2 hover:text-ink sm:block">
            Get your data
          </a>
          <a href="#privacy" className="hidden rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink-2 hover:text-ink sm:block">
            Privacy
          </a>
          <ThemeToggle />
          <HeaderAction />
        </nav>
      </header>

      <main className="relative z-10">
        <section className="mx-auto max-w-3xl px-4 pt-14 pb-20 text-center sm:px-6 sm:pt-20">
          <p className="inline-flex animate-fade items-center gap-2 rounded-full border border-line bg-surface/80 px-3.5 py-1.5 text-[13px] font-medium text-ink-2 shadow-card backdrop-blur">
            <Lock className="size-3.5 text-accent-ink" aria-hidden />
            Private by design. Everything runs in your browser.
          </p>
          <h1 className="mt-7 animate-rise text-[44px] leading-[1.02] font-semibold tracking-[-0.045em] text-balance text-ink sm:text-[68px]">
            Your Spotify history, <span className="text-accent-ink">finally unpacked.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl animate-rise text-[17px] leading-7 text-pretty text-ink-2 [animation-delay:80ms]">
            Drop in the data export Spotify sends you and explore every play you&rsquo;ve ever made: top artists and
            songs, when and how you listen, streaks, eras and a year-by-year review.
          </p>
          <Equalizer className="mx-auto mt-10 mb-2 h-16 max-w-md opacity-80" />
          <div className="mx-auto mt-6 max-w-xl animate-rise [animation-delay:160ms]">
            <ImportPanel />
          </div>
          <p className="mt-4 text-xs text-ink-3">
            Works with both Spotify exports · .zip or .json · music, podcasts, audiobooks and video
          </p>
        </section>

        <section aria-labelledby="features-title" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="features-title" className="text-center text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">
            Everything in your history, explored
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-[15px] text-ink-3">
            Pick any year or date range and every chart follows along. Click any artist, song or album for its own story.
          </p>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="rounded-3xl border border-line bg-surface p-6 shadow-card">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-accent-wash text-accent-ink">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.015em] text-ink">{title}</h3>
                <p className="mt-1.5 text-[14px] leading-6 text-ink-3">{body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="get-your-data" aria-labelledby="steps-title" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-16 sm:px-6">
          <h2 id="steps-title" className="text-center text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">
            Getting your data
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-[15px] text-ink-3">
            Spotify gives everyone a copy of their listening history. It takes a minute to request.
          </p>
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="relative rounded-3xl border border-line bg-surface p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-surface-2 text-ink-2">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="text-[13px] font-semibold text-ink-3 tabular">Step {i + 1}</span>
                </div>
                <h3 className="mt-5 text-[17px] font-semibold tracking-[-0.015em] text-ink">{title}</h3>
                <p className="mt-1.5 text-[14px] leading-6 text-ink-3">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="privacy" aria-labelledby="privacy-title" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-16 sm:px-6">
          <div className="overflow-hidden rounded-[32px] border border-line bg-surface shadow-card">
            <div className="grid gap-10 p-8 sm:p-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div>
                <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-white">
                  <Lock className="size-5" aria-hidden />
                </span>
                <h2 id="privacy-title" className="mt-6 text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">
                  Your listening stays yours.
                </h2>
                <p className="mt-3 text-[15px] leading-7 text-ink-3">
                  {APP_NAME} is a static web page. There&rsquo;s no server to send your history to. The work happens in
                  your browser, and your stats are saved on your device.
                </p>
              </div>
              <ul className="grid gap-6 sm:grid-cols-2">
                {PRIVACY.map(({ icon: Icon, title, body }) => (
                  <li key={title}>
                    <Icon className="size-5 text-accent-ink" aria-hidden />
                    <h3 className="mt-3 text-[15px] font-semibold text-ink">{title}</h3>
                    <p className="mt-1 text-[14px] leading-6 text-ink-3">{body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-line px-4 py-8 text-xs text-ink-3 sm:flex-row sm:px-6">
        <p>
          {APP_NAME} isn&rsquo;t affiliated with Spotify. Spotify is a trademark of Spotify AB.
        </p>
        <p>Made for exploring your own listening.</p>
      </footer>
    </div>
  );
}
