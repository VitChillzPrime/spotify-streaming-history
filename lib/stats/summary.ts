import { FLAG, KIND } from "@/lib/model";
import { emptyTotals, type Scope, type Totals } from "@/lib/stats/scope";

export interface Ratio {
  /** Plays where the export recorded this field. */
  known: number;
  /** Plays where it was true. */
  on: number;
}

export interface Summary extends Totals {
  /** Totals per `KIND`. */
  byKind: Totals[];
  songs: number;
  artists: number;
  albums: number;
  shows: number;
  episodes: number;
  books: number;
  /** Days with at least one stream. */
  activeDays: number;
  firstStart: number | null;
  lastEnd: number | null;
  skips: Ratio;
  shuffle: Ratio;
  offline: Ratio;
  incognito: Ratio;
  video: Totals;
}

/** Headline numbers for a scope. Unique counts only include things actually streamed. */
export function summarize({ p, range, kinds, minMs }: Scope): Summary {
  const { ds, day } = p;
  const seenSong = new Uint8Array(ds.songs.name.length);
  const seenArtist = new Uint8Array(ds.artists.length);
  const seenAlbum = new Uint8Array(ds.albums.name.length);
  const seenShow = new Uint8Array(ds.shows.length);
  const seenEpisode = new Uint8Array(ds.episodes.name.length);
  const seenBook = new Uint8Array(ds.books.title.length);
  const kindMs = [0, 0, 0, 0];
  const kindPlays = [0, 0, 0, 0];
  const kindCount = [0, 0, 0, 0];

  // Plain locals in the hot loop; the result object is assembled once at the end.
  let songs = 0;
  let artists = 0;
  let albums = 0;
  let shows = 0;
  let episodes = 0;
  let books = 0;
  let activeDays = 0;
  let lastActiveDay = NaN;
  let first = -1;
  let lastEnd = -Infinity;
  let skipKnown = 0;
  let skipOn = 0;
  let shuffleKnown = 0;
  let shuffleOn = 0;
  let offlineKnown = 0;
  let offlineOn = 0;
  let incognitoKnown = 0;
  let incognitoOn = 0;
  let videoMs = 0;
  let videoPlays = 0;
  let videoCount = 0;

  // Columns and constants in locals: module-level constants are read through the bundler's
  // export getters, and object properties aren't reliably hoisted out of a 100k-row loop.
  const kindCol = ds.kind;
  const msCol = ds.ms;
  const flagsCol = ds.flags;
  const endCol = ds.end;
  const itemCol = ds.item;
  const albumCol = ds.album;
  const songArtist = ds.songs.artist;
  const episodeShow = ds.episodes.show;
  const chapterBook = ds.chapters.book;
  const TRACK = KIND.track;
  const EPISODE = KIND.episode;
  const AUDIOBOOK = KIND.audiobook;
  const { video: VIDEO, skippedKnown: SKIP_KNOWN, skipped: SKIPPED, shuffleKnown: SHUFFLE_KNOWN, shuffle: SHUFFLE } = FLAG;
  const { offlineKnown: OFFLINE_KNOWN, offline: OFFLINE, incognitoKnown: INCOGNITO_KNOWN, incognito: INCOGNITO } = FLAG;

  for (let i = range.lo; i < range.hi; i++) {
    const kind = kindCol[i];
    if (!(kinds & (1 << kind))) continue;
    const ms = msCol[i];
    const flags = flagsCol[i];
    const counted = ms >= minMs;

    kindMs[kind] += ms;
    kindCount[kind]++;
    if (first < 0) first = i;
    if (endCol[i] > lastEnd) lastEnd = endCol[i];

    if (flags !== 0) {
      if (flags & VIDEO) {
        videoMs += ms;
        videoCount++;
        if (counted) videoPlays++;
      }
      if (flags & SKIP_KNOWN) {
        skipKnown++;
        if (flags & SKIPPED) skipOn++;
      }
      if (flags & SHUFFLE_KNOWN) {
        shuffleKnown++;
        if (flags & SHUFFLE) shuffleOn++;
      }
      if (flags & OFFLINE_KNOWN) {
        offlineKnown++;
        if (flags & OFFLINE) offlineOn++;
      }
      if (flags & INCOGNITO_KNOWN) {
        incognitoKnown++;
        if (flags & INCOGNITO) incognitoOn++;
      }
    }

    if (!counted) continue;
    kindPlays[kind]++;
    if (day[i] !== lastActiveDay) {
      activeDays++;
      lastActiveDay = day[i];
    }

    const item = itemCol[i];
    if (item < 0) continue;
    if (kind === TRACK) {
      if (!seenSong[item]) {
        seenSong[item] = 1;
        songs++;
      }
      const artist = songArtist[item];
      if (!seenArtist[artist]) {
        seenArtist[artist] = 1;
        artists++;
      }
      const album = albumCol[i];
      if (album >= 0 && !seenAlbum[album]) {
        seenAlbum[album] = 1;
        albums++;
      }
    } else if (kind === EPISODE) {
      if (!seenEpisode[item]) {
        seenEpisode[item] = 1;
        episodes++;
      }
      const show = episodeShow[item];
      if (!seenShow[show]) {
        seenShow[show] = 1;
        shows++;
      }
    } else if (kind === AUDIOBOOK) {
      const book = chapterBook[item];
      if (!seenBook[book]) {
        seenBook[book] = 1;
        books++;
      }
    }
  }

  const byKind = kindMs.map((ms, k) => ({ ms, plays: kindPlays[k], count: kindCount[k] }));
  const totals = byKind.reduce((sum, t) => ({ ms: sum.ms + t.ms, plays: sum.plays + t.plays, count: sum.count + t.count }), emptyTotals());
  return {
    ...totals,
    byKind,
    songs,
    artists,
    albums,
    shows,
    episodes,
    books,
    activeDays,
    firstStart: first >= 0 ? p.start[first] : null,
    lastEnd: first >= 0 ? lastEnd : null,
    skips: { known: skipKnown, on: skipOn },
    shuffle: { known: shuffleKnown, on: shuffleOn },
    offline: { known: offlineKnown, on: offlineOn },
    incognito: { known: incognitoKnown, on: incognitoOn },
    video: { ms: videoMs, plays: videoPlays, count: videoCount },
  };
}
