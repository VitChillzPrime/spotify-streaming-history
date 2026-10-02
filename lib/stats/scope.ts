import { KIND, type Kind } from "@/lib/model";
import type { Prepared } from "@/lib/prepare";
import { resolveRange, type Range, type RangeSpec } from "@/lib/range";

/** Everything a statistic needs: the data, the date range, which content, and what counts as a stream. */
export interface Scope {
  p: Prepared;
  range: Range;
  /** Bit mask of `KIND` values to include (see `KINDS`). */
  kinds: number;
  /** A play counts as a stream once it reaches this many ms. Spotify itself uses 30 seconds. */
  minMs: number;
}

export const DEFAULT_MIN_MS = 30_000;

export const KINDS = {
  all: 0b1111,
  music: 1 << KIND.track,
  podcasts: 1 << KIND.episode,
  audiobooks: 1 << KIND.audiobook,
} as const;

export function hasKind(kinds: number, kind: Kind | number): boolean {
  return (kinds & (1 << kind)) !== 0;
}

export function withRange(scope: Scope, spec: RangeSpec): Scope {
  return { ...scope, range: resolveRange(scope.p, spec) };
}

export function withKinds(scope: Scope, kinds: number): Scope {
  return { ...scope, kinds };
}

export interface Totals {
  /** Total time played. */
  ms: number;
  /** Plays that reached the stream threshold. */
  plays: number;
  /** All plays, including very short ones. */
  count: number;
}

export function emptyTotals(): Totals {
  return { ms: 0, plays: 0, count: 0 };
}
