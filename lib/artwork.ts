import { KIND, type Dataset } from "@/lib/model";
import { entityLabel } from "@/lib/stats/entity";
import type { EntityRef } from "@/lib/stats/top";

// The export has track and episode URIs but no artist, album or show URIs, so
// each entity's cover comes from a representative item: an artist's most played
// song, an album's most played track, a show's most played episode.

const URI = /^spotify:(track|album|artist|episode|show|audiobook|chapter):([A-Za-z0-9]+)$/;

/** The open.spotify.com page for a Spotify URI, or null for local files and malformed URIs. */
export function openSpotifyUrl(uri: string | null | undefined): string | null {
  const match = uri ? URI.exec(uri) : null;
  return match ? `https://open.spotify.com/${match[1]}/${match[2]}` : null;
}

function valid(uri: string | null | undefined): string | null {
  return uri && URI.test(uri) ? uri : null;
}

interface ArtworkIndex {
  /** Most played song of each artist (-1 when none). */
  artistSong: Int32Array;
  /** Most played song of each album; only needed for data imported before `albums.uri`. */
  albumSong: Int32Array | null;
  /** Most played episode of each show. */
  showEpisode: Int32Array;
  /** Most played chapter of each audiobook. */
  bookChapter: Int32Array;
}

const indexes = new WeakMap<Dataset, ArtworkIndex>();

function artworkIndex(ds: Dataset): ArtworkIndex {
  const cached = indexes.get(ds);
  if (cached) return cached;

  const songMs = new Float64Array(ds.songs.name.length);
  const episodeMs = new Float64Array(ds.episodes.name.length);
  const chapterMs = new Float64Array(ds.chapters.title.length);
  const needAlbums = !ds.albums.uri;
  const albumSongMs = new Map<number, number>();
  const songCount = ds.songs.name.length;
  const { kind, item, ms, album } = ds;
  const TRACK = KIND.track;
  const EPISODE = KIND.episode;
  const AUDIOBOOK = KIND.audiobook;
  for (let i = 0; i < ds.size; i++) {
    const id = item[i];
    if (id < 0) continue;
    const k = kind[i];
    if (k === TRACK) {
      songMs[id] += ms[i];
      if (needAlbums && album[i] >= 0) {
        const key = album[i] * songCount + id;
        albumSongMs.set(key, (albumSongMs.get(key) ?? 0) + ms[i]);
      }
    } else if (k === EPISODE) {
      episodeMs[id] += ms[i];
    } else if (k === AUDIOBOOK) {
      chapterMs[id] += ms[i];
    }
  }

  const bestBy = (size: number, members: number, owner: (member: number) => number, weight: ArrayLike<number>) => {
    const best = new Int32Array(size).fill(-1);
    const bestWeight = new Float64Array(size);
    for (let m = 0; m < members; m++) {
      const o = owner(m);
      if (weight[m] > bestWeight[o]) {
        bestWeight[o] = weight[m];
        best[o] = m;
      }
    }
    return best;
  };

  let albumSong: Int32Array | null = null;
  if (needAlbums) {
    albumSong = new Int32Array(ds.albums.name.length).fill(-1);
    const bestWeight = new Float64Array(ds.albums.name.length);
    for (const [key, weight] of albumSongMs) {
      const a = Math.floor(key / songCount);
      if (weight > bestWeight[a]) {
        bestWeight[a] = weight;
        albumSong[a] = key - a * songCount;
      }
    }
  }

  const index: ArtworkIndex = {
    artistSong: bestBy(ds.artists.length, songCount, (s) => ds.songs.artist[s], songMs),
    albumSong,
    showEpisode: bestBy(ds.shows.length, ds.episodes.name.length, (e) => ds.episodes.show[e], episodeMs),
    bookChapter: bestBy(ds.books.title.length, ds.chapters.title.length, (c) => ds.chapters.book[c], chapterMs),
  };
  indexes.set(ds, index);
  return index;
}

/** The Spotify URI whose cover art represents an entity, or null when there isn't one. */
export function artworkUri(ds: Dataset, ref: EntityRef): string | null {
  const index = artworkIndex(ds);
  const songUri = (song: number) => (song >= 0 ? valid(ds.songs.uri[song]) : null);
  switch (ref.type) {
    case "song":
      return songUri(ref.id);
    case "album":
      return valid(ds.albums.uri?.[ref.id]) ?? songUri(index.albumSong?.[ref.id] ?? -1);
    case "artist":
      return songUri(index.artistSong[ref.id]);
    case "episode":
      return valid(ds.episodes.uri[ref.id]);
    case "show": {
      const episode = index.showEpisode[ref.id];
      return episode >= 0 ? valid(ds.episodes.uri[episode]) : null;
    }
    case "book": {
      const chapter = index.bookChapter[ref.id];
      return valid(ds.books.uri[ref.id]) ?? (chapter >= 0 ? valid(ds.chapters.uri[chapter]) : null);
    }
  }
}

/** Title, subtitle and monogram tint for an entity. Songs and albums take their artist's tint. */
export function entityVisual(ds: Dataset, ref: EntityRef) {
  const label = entityLabel(ds, ref);
  return {
    ...label,
    seed: ref.type === "song" || ref.type === "album" || ref.type === "episode" ? label.subtitle : label.title,
  };
}
