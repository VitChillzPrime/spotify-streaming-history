import { KIND } from "@/lib/model";
import type { Scope } from "@/lib/stats/scope";
import { HOUR_MS, MINUTE_MS } from "@/lib/time";

export interface Streak {
  from: number;
  to: number;
  days: number;
}

/** Consecutive days with at least one stream: the longest, and the one running at the end of the range. */
export function streaks(scope: Scope): { longest: Streak | null; current: Streak | null } {
  const { p, range, kinds, minMs } = scope;
  const kindCol = p.ds.kind;
  const msCol = p.ds.ms;
  const dayCol = p.day;
  let longest: Streak | null = null;
  let run: Streak | null = null;
  for (let i = range.lo; i < range.hi; i++) {
    if (msCol[i] < minMs || !((kinds >> kindCol[i]) & 1)) continue;
    const day = dayCol[i];
    if (run && day === run.to) continue;
    if (run && day === run.to + 1) {
      run.to = day;
      run.days++;
    } else {
      run = { from: day, to: day, days: 1 };
    }
    if (!longest || run.days > longest.days) longest = { ...run };
  }
  const current = run && run.to === range.dataTo ? { ...run } : null;
  return { longest, current };
}

export interface DayTotal {
  day: number;
  ms: number;
  plays: number;
}

/** The days with the most listening. */
export function biggestDays(scope: Scope, limit = 5): DayTotal[] {
  const { p, range, kinds, minMs } = scope;
  const kindCol = p.ds.kind;
  const msCol = p.ds.ms;
  const dayCol = p.day;
  const days: DayTotal[] = [];
  let current: DayTotal | null = null;
  for (let i = range.lo; i < range.hi; i++) {
    if (!((kinds >> kindCol[i]) & 1)) continue;
    const day = dayCol[i];
    if (!current || current.day !== day) {
      current = { day, ms: 0, plays: 0 };
      days.push(current);
    }
    current.ms += msCol[i];
    if (msCol[i] >= minMs) current.plays++;
  }
  return days.sort((a, b) => b.ms - a.ms).slice(0, limit);
}

export interface Session {
  /** Epoch ms of the first start and last stop. */
  start: number;
  end: number;
  /** Time actually played. */
  ms: number;
  plays: number;
  /** Stream indices of the first and last play. */
  first: number;
  last: number;
}

export const SESSION_GAP = 30 * MINUTE_MS;

export const SESSION_BUCKETS = [
  { label: "Under 15 min", max: 15 * MINUTE_MS },
  { label: "15 to 30 min", max: 30 * MINUTE_MS },
  { label: "30 to 60 min", max: HOUR_MS },
  { label: "1 to 2 hours", max: 2 * HOUR_MS },
  { label: "2 to 4 hours", max: 4 * HOUR_MS },
  { label: "4+ hours", max: Infinity },
] as const;

export interface SessionStats {
  count: number;
  totalMs: number;
  /** The longest sessions by time played, longest first. */
  longest: Session[];
  /** Session counts per `SESSION_BUCKETS` entry. */
  lengths: number[];
}

/** Groups plays into listening sessions: a gap of more than 30 minutes starts a new one. */
export function sessions(scope: Scope, gap = SESSION_GAP, keep = 5): SessionStats {
  const { p, range, kinds, minMs } = scope;
  const kindCol = p.ds.kind;
  const msCol = p.ds.ms;
  const endCol = p.ds.end;
  const startCol = p.start;
  const stats: SessionStats = { count: 0, totalMs: 0, longest: [], lengths: SESSION_BUCKETS.map(() => 0) };
  let session: Session | null = null;

  const close = (s: Session) => {
    if (s.ms <= 0) return;
    stats.count++;
    stats.totalMs += s.ms;
    stats.lengths[SESSION_BUCKETS.findIndex((bucket) => s.ms < bucket.max)]++;
    if (stats.longest.length < keep || s.ms > stats.longest[stats.longest.length - 1].ms) {
      stats.longest.push(s);
      stats.longest.sort((a, b) => b.ms - a.ms);
      if (stats.longest.length > keep) stats.longest.pop();
    }
  };

  for (let i = range.lo; i < range.hi; i++) {
    if (!((kinds >> kindCol[i]) & 1)) continue;
    const start = startCol[i];
    const end = endCol[i];
    if (session && start - session.end <= gap) {
      session.end = Math.max(session.end, end);
      session.ms += msCol[i];
      if (msCol[i] >= minMs) session.plays++;
      session.last = i;
    } else {
      if (session) close(session);
      session = { start, end, ms: msCol[i], plays: msCol[i] >= minMs ? 1 : 0, first: i, last: i };
    }
  }
  if (session) close(session);
  return stats;
}

export interface Repeat {
  song: number;
  day: number;
  plays: number;
  ms: number;
}

/** Songs streamed the most times within a single day. */
export function repeats(scope: Scope, limit = 10, minPlays = 3): Repeat[] {
  const { p, range, minMs } = scope;
  const kindCol = p.ds.kind;
  const msCol = p.ds.ms;
  const itemCol = p.ds.item;
  const dayCol = p.day;
  const TRACK = KIND.track;
  const results: Repeat[] = [];
  let day = NaN;
  let counts = new Map<number, Repeat>();
  const flush = () => {
    for (const repeat of counts.values()) if (repeat.plays >= minPlays) results.push(repeat);
  };
  for (let i = range.lo; i < range.hi; i++) {
    if (kindCol[i] !== TRACK || msCol[i] < minMs) continue;
    const song = itemCol[i];
    if (song < 0) continue;
    if (dayCol[i] !== day) {
      flush();
      counts = new Map();
      day = dayCol[i];
    }
    const repeat = counts.get(song);
    if (repeat) {
      repeat.plays++;
      repeat.ms += msCol[i];
    } else {
      counts.set(song, { song, day, plays: 1, ms: msCol[i] });
    }
  }
  flush();
  return results.sort((a, b) => b.plays - a.plays || b.ms - a.ms).slice(0, limit);
}
