import { FLAG, type Dataset } from "@/lib/model";
import { emptyTotals, type Scope, type Totals } from "@/lib/stats/scope";
import { hourly, timeline, weekdays, type Timeline } from "@/lib/stats/time";
import { entityKey, rank, type EntityRef, type EntityType, type Ranked } from "@/lib/stats/top";

/** Indices of the entity's streams within the scope's range, in order. */
export function entitySubset(scope: Scope, ref: EntityRef): Int32Array {
  const { p, range } = scope;
  const { kind, column, lookup } = entityKey(scope, ref.type);
  const kindCol = p.ds.kind;
  const target = ref.id;
  const out: number[] = [];
  for (let i = range.lo; i < range.hi; i++) {
    if (kindCol[i] !== kind) continue;
    let id = column[i];
    if (id < 0) continue;
    if (lookup) id = lookup[id];
    if (id === target) out.push(i);
  }
  return Int32Array.from(out);
}

export interface EntityLabel {
  title: string;
  subtitle?: string;
  /** The artist / show behind a song, album or episode, for linking. */
  parent?: EntityRef;
  uri?: string;
}

export function entityLabel(ds: Dataset, ref: EntityRef): EntityLabel {
  const { id } = ref;
  switch (ref.type) {
    case "artist":
      return { title: ds.artists[id] };
    case "song": {
      const artist = ds.songs.artist[id];
      return {
        title: ds.songs.name[id],
        subtitle: ds.artists[artist],
        parent: { type: "artist", id: artist },
        uri: ds.songs.uri[id] || undefined,
      };
    }
    case "album": {
      const artist = ds.albums.artist[id];
      return { title: ds.albums.name[id], subtitle: ds.artists[artist], parent: { type: "artist", id: artist } };
    }
    case "show":
      return { title: ds.shows[id] };
    case "episode": {
      const show = ds.episodes.show[id];
      return {
        title: ds.episodes.name[id],
        subtitle: ds.shows[show],
        parent: { type: "show", id: show },
        uri: ds.episodes.uri[id] || undefined,
      };
    }
    case "book":
      return { title: ds.books.title[id], uri: ds.books.uri[id] || undefined };
  }
}

/** A link that opens the entity in Spotify: the exact URI when the export has one, otherwise a search. */
export function spotifyUrl(ds: Dataset, ref: EntityRef): string {
  const label = entityLabel(ds, ref);
  const match = label.uri?.match(/^spotify:(track|episode|show|audiobook|album|artist):([A-Za-z0-9]+)$/);
  if (match) return `https://open.spotify.com/${match[1]}/${match[2]}`;
  const query = label.subtitle ? `${label.title} ${label.subtitle}` : label.title;
  return `https://open.spotify.com/search/${encodeURIComponent(query)}`;
}

export const ENTITY_NOUN: Record<EntityType, string> = {
  artist: "artist",
  song: "song",
  album: "album",
  show: "show",
  episode: "episode",
  book: "audiobook",
};

export interface EntityDetail {
  totals: Totals;
  skips: { known: number; on: number };
  /** Stream indices of the first and most recent stream in the whole history. */
  first: number;
  last: number;
  activeDays: number;
  biggestDay: { day: number; ms: number } | null;
  /** Position among its peers by time in the range (1 = top), or null if not played in range. */
  rank: number | null;
  peers: number;
  /** Share of all listening of the same kind in the range. */
  share: number;
  timeline: Timeline;
  hourly: Float64Array;
  weekdays: Float64Array;
  songs: Ranked[];
  albums: Ranked[];
  episodes: Ranked[];
}

export function entityDetail(scope: Scope, ref: EntityRef): EntityDetail {
  const { p, minMs } = scope;
  const { ds } = p;
  const subset = entitySubset(scope, ref);
  const totals = emptyTotals();
  const skips = { known: 0, on: 0 };
  let activeDays = 0;
  let lastActive = NaN;
  let biggestDay: EntityDetail["biggestDay"] = null;
  let dayMs = 0;
  let currentDay = NaN;
  const SKIP_KNOWN = FLAG.skippedKnown;
  const SKIPPED = FLAG.skipped;

  for (let k = 0; k < subset.length; k++) {
    const i = subset[k];
    const ms = ds.ms[i];
    const day = p.day[i];
    totals.ms += ms;
    totals.count++;
    if (ms >= minMs) {
      totals.plays++;
      if (day !== lastActive) {
        activeDays++;
        lastActive = day;
      }
    }
    const flags = ds.flags[i];
    if (flags & SKIP_KNOWN) {
      skips.known++;
      if (flags & SKIPPED) skips.on++;
    }
    if (day !== currentDay) {
      currentDay = day;
      dayMs = 0;
    }
    dayMs += ms;
    if (!biggestDay || dayMs > biggestDay.ms) biggestDay = { day: currentDay, ms: dayMs };
  }

  // First and most recent stream across the whole history: scan in from each end.
  const { kind, column, lookup } = entityKey(scope, ref.type);
  const matches = (i: number) => {
    if (ds.kind[i] !== kind || ds.ms[i] < minMs) return false;
    const id = column[i];
    return id >= 0 && (lookup ? lookup[id] : id) === ref.id;
  };
  let first = -1;
  for (let i = 0; i < ds.size; i++) {
    if (matches(i)) {
      first = i;
      break;
    }
  }
  let last = -1;
  for (let i = ds.size - 1; i >= 0 && first >= 0; i--) {
    if (matches(i)) {
      last = i;
      break;
    }
  }

  const peers = rank(scope, ref.type, "time");
  const position = peers.findIndex((entry) => entry.id === ref.id);
  const kindTotal = peers.reduce((sum, entry) => sum + entry.ms, 0);
  const allKinds: Scope = { ...scope, kinds: 0b1111 };

  return {
    totals,
    skips,
    first,
    last,
    activeDays,
    biggestDay,
    rank: position >= 0 ? position + 1 : null,
    peers: peers.length,
    share: kindTotal > 0 ? totals.ms / kindTotal : 0,
    timeline: timeline(allKinds, undefined, subset),
    hourly: hourly(allKinds, subset).ms,
    weekdays: weekdays(allKinds, subset).ms,
    songs: ref.type === "artist" || ref.type === "album" ? rank(scope, "song", "time", subset) : [],
    albums: ref.type === "artist" ? rank(scope, "album", "time", subset) : [],
    episodes: ref.type === "show" ? rank(scope, "episode", "time", subset) : [],
  };
}
