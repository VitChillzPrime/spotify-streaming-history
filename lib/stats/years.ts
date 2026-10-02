import { firstPlays } from "@/lib/stats/discovery";
import { biggestDays, type DayTotal } from "@/lib/stats/records";
import { KINDS, withKinds, withRange, type Scope } from "@/lib/stats/scope";
import { summarize, type Summary } from "@/lib/stats/summary";
import { hourly, timeline } from "@/lib/stats/time";
import { rank, type Ranked } from "@/lib/stats/top";
import { dayParts } from "@/lib/time";

export interface YearReview {
  year: number;
  scope: Scope;
  summary: Summary;
  /** The previous year's summary, when it is in the data. */
  previous: Summary | null;
  artists: Ranked[];
  songs: Ranked[];
  albums: Ranked[];
  shows: Ranked[];
  /** Artists heard for the first time ever this year. */
  newArtists: number;
  biggestDay: DayTotal | null;
  topMonth: { start: number; ms: number } | null;
  peakHour: number | null;
  /** Listening per month (January first). */
  months: Float64Array;
}

/** A "year in review" for every year in the data, newest first. */
export function yearReviews(base: Scope, limit = 5): YearReview[] {
  const { p, minMs } = base;
  const first = firstPlays(p, minMs).artist;
  const summaries = new Map<number, Summary>();
  const reviewFor = (year: number): YearReview => {
    const scope = withRange(base, { type: "year", year });
    const summary = summarize(scope);
    summaries.set(year, summary);

    let newArtists = 0;
    for (let artist = 0; artist < first.length; artist++) {
      const index = first[artist];
      if (index >= scope.range.lo && index < scope.range.hi) newArtists++;
    }

    const months = timeline(scope, "month");
    const monthMs = new Float64Array(12);
    let topMonth: YearReview["topMonth"] = null;
    for (let b = 0; b < months.buckets.length; b++) {
      const { start } = months.buckets[b];
      monthMs[dayParts(start).month] = months.ms[b];
      if (months.ms[b] > (topMonth?.ms ?? 0)) topMonth = { start, ms: months.ms[b] };
    }

    const hours = hourly(scope).ms;
    let peakHour: number | null = null;
    for (let hour = 0; hour < 24; hour++) {
      if (hours[hour] > 0 && (peakHour === null || hours[hour] > hours[peakHour])) peakHour = hour;
    }

    const music = withKinds(scope, KINDS.music);
    return {
      year,
      scope,
      summary,
      previous: null,
      artists: rank(music, "artist", "time").slice(0, limit),
      songs: rank(music, "song", "plays").slice(0, limit),
      albums: rank(music, "album", "time").slice(0, limit),
      shows: rank(scope, "show", "time").slice(0, limit),
      newArtists,
      biggestDay: biggestDays(scope, 1)[0] ?? null,
      topMonth,
      peakHour,
      months: monthMs,
    };
  };

  const reviews = p.years.map(reviewFor).filter((review) => review.summary.count > 0);
  for (const review of reviews) review.previous = summaries.get(review.year - 1) ?? null;
  return reviews.reverse();
}
