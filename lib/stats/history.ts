import { KIND, type Dataset } from "@/lib/model";
import type { Scope } from "@/lib/stats/scope";

/** Lower-case, accent-free text so "beyonce" finds "Beyoncé". */
export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

interface SearchIndex {
  songs: string[];
  artists: string[];
  albums: string[];
  episodes: string[];
  shows: string[];
  chapters: string[];
  books: string[];
}

const indexes = new WeakMap<Dataset, SearchIndex>();

function searchIndex(ds: Dataset): SearchIndex {
  let index = indexes.get(ds);
  if (!index) {
    index = {
      songs: ds.songs.name.map(normalizeText),
      artists: ds.artists.map(normalizeText),
      albums: ds.albums.name.map(normalizeText),
      episodes: ds.episodes.name.map(normalizeText),
      shows: ds.shows.map(normalizeText),
      chapters: ds.chapters.title.map(normalizeText),
      books: ds.books.title.map(normalizeText),
    };
    indexes.set(ds, index);
  }
  return index;
}

/** Stream indices in the scope matching the query, newest first. */
export function searchHistory(scope: Scope, query: string): Int32Array {
  const { p, range, kinds } = scope;
  const TRACK = KIND.track;
  const { ds } = p;
  const q = normalizeText(query.trim());
  const matches: number[] = [];

  if (!q) {
    for (let i = range.hi - 1; i >= range.lo; i--) if (((kinds >> ds.kind[i]) & 1)) matches.push(i);
    return Int32Array.from(matches);
  }

  const index = searchIndex(ds);
  const artistHit = index.artists.map((name) => name.includes(q));
  const songHit = index.songs.map((name, id) => name.includes(q) || artistHit[ds.songs.artist[id]]);
  const albumHit = index.albums.map((name) => name.includes(q));
  const showHit = index.shows.map((name) => name.includes(q));
  const episodeHit = index.episodes.map((name, id) => name.includes(q) || showHit[ds.episodes.show[id]]);
  const bookHit = index.books.map((name) => name.includes(q));
  const chapterHit = index.chapters.map((name, id) => name.includes(q) || bookHit[ds.chapters.book[id]]);

  for (let i = range.hi - 1; i >= range.lo; i--) {
    const kind = ds.kind[i];
    if (!((kinds >> kind) & 1)) continue;
    const item = ds.item[i];
    if (item < 0) continue;
    const hit =
      kind === TRACK
        ? songHit[item] || (ds.album[i] >= 0 && albumHit[ds.album[i]])
        : kind === KIND.episode
          ? episodeHit[item]
          : kind === KIND.audiobook
            ? chapterHit[item]
            : false;
    if (hit) matches.push(i);
  }
  return Int32Array.from(matches);
}
