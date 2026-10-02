import {
  DATASET_VERSION,
  FLAG,
  KIND,
  UNKNOWN,
  type Dataset,
  type DatasetFeatures,
  type ImportedFile,
} from "@/lib/model";

type Row = Record<string, unknown>;

/** Interns strings so each distinct value is stored once and referenced by index. */
class Dictionary {
  private readonly index = new Map<string, number>();
  readonly values: string[] = [];

  id(value: string): number {
    let id = this.index.get(value);
    if (id === undefined) {
      id = this.values.length;
      this.values.push(value);
      this.index.set(value, id);
    }
    return id;
  }
}

const SOURCE_EXTENDED = 0;
const SOURCE_BASIC = 1;

/** `reason_end` values Spotify itself marks as `skipped: true`. */
const SKIP_REASONS = new Set(["fwdbtn", "backbtn", "endplay"]);

/** Spotify launched in 2008; anything outside this window is a corrupt timestamp. */
const MIN_TIME = Date.UTC(2005, 0, 1);
const MAX_TIME = Date.UTC(2100, 0, 1);

/**
 * Accumulates raw export rows and produces a sorted, de-duplicated {@link Dataset}.
 *
 * Personal fields such as `ip_addr`, `username` and user agents are never read.
 */
export class DatasetBuilder {
  // Plain arrays while building: a single generic typed-array column class made every
  // store megamorphic (≈70% of import time). They become typed arrays in finalize().
  private readonly end: number[] = [];
  private readonly ms: number[] = [];
  private readonly kind: number[] = [];
  private readonly item: number[] = [];
  private readonly album: number[] = [];
  private readonly platform: number[] = [];
  private readonly country: number[] = [];
  private readonly reasonStart: number[] = [];
  private readonly reasonEnd: number[] = [];
  private readonly flags: number[] = [];
  private readonly source: number[] = [];

  private readonly artists = new Dictionary();
  private readonly shows = new Dictionary();
  private readonly platforms = new Dictionary();
  private readonly countries = new Dictionary();
  private readonly reasons = new Dictionary();

  private readonly songIndex = new Map<string, number>();
  private readonly songName: string[] = [];
  private readonly songArtist: number[] = [];
  /**
   * Per track URI: the resolved song and album, keyed on the raw strings they came from.
   * Most plays repeat a known track, so names are trimmed and keyed once per URI, not per play.
   * `count` picks the most-played release to represent a song.
   */
  private readonly trackCache = new Map<
    string,
    { song: number; album: number; rawName: unknown; rawArtist: unknown; rawAlbum: unknown; count: number }
  >();

  private readonly albumIndex = new Map<string, number>();
  private readonly albumName: string[] = [];
  private readonly albumArtist: number[] = [];

  private readonly episodeIndex = new Map<string, number>();
  private readonly episodeName: string[] = [];
  private readonly episodeShow: number[] = [];
  private readonly episodeUri: string[] = [];

  private readonly bookIndex = new Map<string, number>();
  private readonly bookTitle: string[] = [];
  private readonly bookUri: string[] = [];

  private readonly chapterIndex = new Map<string, number>();
  private readonly chapterTitle: string[] = [];
  private readonly chapterBook: number[] = [];
  private readonly chapterUri: string[] = [];

  private totalRecords = 0;
  private invalid = 0;

  /** Rows from `Streaming_History_*.json` / `endsong_*.json` (the "Extended streaming history" export). */
  addExtended(rows: unknown[], options: { video?: boolean } = {}): number {
    let added = 0;
    for (const value of rows) {
      this.totalRecords++;
      if (!isRow(value)) {
        this.invalid++;
        continue;
      }
      const end = parseTimestamp(value.ts);
      if (!isPlausibleTime(end)) {
        this.invalid++;
        continue;
      }

      let flags = options.video ? FLAG.video : 0;
      flags |= boolFlag(value.shuffle, FLAG.shuffle, FLAG.shuffleKnown);
      flags |= boolFlag(value.offline, FLAG.offline, FLAG.offlineKnown);
      flags |= boolFlag(value.incognito_mode, FLAG.incognito, FLAG.incognitoKnown);
      const reasonEnd = text(value.reason_end);
      if (typeof value.skipped === "boolean") {
        flags |= boolFlag(value.skipped, FLAG.skipped, FLAG.skippedKnown);
      } else if (reasonEnd) {
        // Older exports leave `skipped` null; Spotify's own flag is exactly these end reasons.
        flags |= FLAG.skippedKnown | (SKIP_REASONS.has(reasonEnd) ? FLAG.skipped : 0);
      }

      const bookTitle = text(value.audiobook_title);
      const bookUri = text(value.audiobook_uri);
      const chapterTitle = text(value.audiobook_chapter_title);
      const chapterUri = text(value.audiobook_chapter_uri);
      const episodeName = text(value.episode_name);
      const showName = text(value.episode_show_name);
      const episodeUri = text(value.spotify_episode_uri);
      const trackName = text(value.master_metadata_track_name);
      const trackUri = text(value.spotify_track_uri);

      let kind: number = KIND.unknown;
      let item = -1;
      let album = -1;
      if (bookTitle || bookUri || chapterTitle || chapterUri) {
        kind = KIND.audiobook;
        item = this.chapterId(bookTitle, bookUri, chapterTitle, chapterUri);
      } else if (episodeName || showName || episodeUri) {
        kind = KIND.episode;
        item = this.episodeId(episodeName, showName, episodeUri);
      } else if (trackName || trackUri) {
        kind = KIND.track;
        const track = this.track(
          trackUri,
          value.master_metadata_track_name,
          value.master_metadata_album_artist_name,
          value.master_metadata_album_album_name,
        );
        item = track.song;
        album = track.album;
      }

      this.push(
        end,
        toMs(value.ms_played),
        kind,
        item,
        album,
        this.platforms.id(text(value.platform) ?? UNKNOWN.platform),
        this.countries.id(text(value.conn_country)?.toUpperCase() ?? UNKNOWN.country),
        this.reasons.id(text(value.reason_start) ?? UNKNOWN.reason),
        this.reasons.id(reasonEnd ?? UNKNOWN.reason),
        flags,
        SOURCE_EXTENDED,
      );
      added++;
    }
    return added;
  }

  /** Rows from `StreamingHistory*.json` (the basic "Account data" export, roughly the last year). */
  addBasic(rows: unknown[]): number {
    let added = 0;
    for (const value of rows) {
      this.totalRecords++;
      if (!isRow(value)) {
        this.invalid++;
        continue;
      }
      const end = parseTimestamp(value.endTime);
      if (!isPlausibleTime(end)) {
        this.invalid++;
        continue;
      }

      let kind: number = KIND.unknown;
      let item = -1;
      const bookTitle = text(value.audiobookName) ?? text(value.audiobookTitle) ?? text(value.bookName);
      const chapterTitle = text(value.chapterName) ?? text(value.chapterTitle);
      const showName = text(value.podcastName) ?? text(value.showName);
      const episodeName = text(value.episodeName);
      const trackName = text(value.trackName);
      const artistName = text(value.artistName);
      if (bookTitle || chapterTitle) {
        kind = KIND.audiobook;
        item = this.chapterId(bookTitle, null, chapterTitle, null);
      } else if (showName || episodeName) {
        kind = KIND.episode;
        item = this.episodeId(episodeName, showName, null);
      } else if (trackName || artistName) {
        kind = KIND.track;
        item = this.songId(trackName ?? UNKNOWN.track, this.artists.id(artistName ?? UNKNOWN.artist));
      }

      this.push(
        end,
        toMs(value.msPlayed),
        kind,
        item,
        -1,
        this.platforms.id(UNKNOWN.platform),
        this.countries.id(UNKNOWN.country),
        this.reasons.id(UNKNOWN.reason),
        this.reasons.id(UNKNOWN.reason),
        0,
        SOURCE_BASIC,
      );
      added++;
    }
    return added;
  }

  finalize(input: { files: ImportedFile[]; importedAt: number }): Dataset {
    const n = this.end.length;
    const { end, ms, kind, item, album, platform, country, reasonStart, reasonEnd, flags, source } = this;

    // Extended history is richer; basic rows inside its date span are the same plays at minute precision.
    let extendedFrom = Infinity;
    let extendedTo = -Infinity;
    for (let i = 0; i < n; i++) {
      if (source[i] !== SOURCE_EXTENDED) continue;
      if (end[i] < extendedFrom) extendedFrom = end[i];
      if (end[i] > extendedTo) extendedTo = end[i];
    }
    let supersededBasic = 0;
    const order = new Uint32Array(n);
    let kept = 0;
    for (let i = 0; i < n; i++) {
      if (source[i] === SOURCE_BASIC && end[i] >= extendedFrom && end[i] <= extendedTo) {
        supersededBasic++;
        continue;
      }
      order[kept++] = i;
    }

    // Sort by start time; the remaining keys make identical rows adjacent for de-duplication.
    const sorted = order.subarray(0, kept).sort(
      (a, b) =>
        end[a] - ms[a] - (end[b] - ms[b]) ||
        end[a] - end[b] ||
        kind[a] - kind[b] ||
        item[a] - item[b] ||
        album[a] - album[b] ||
        platform[a] - platform[b] ||
        country[a] - country[b] ||
        reasonStart[a] - reasonStart[b] ||
        reasonEnd[a] - reasonEnd[b] ||
        flags[a] - flags[b],
    );

    const out = {
      end: new Float64Array(kept),
      ms: new Uint32Array(kept),
      kind: new Uint8Array(kept),
      item: new Int32Array(kept),
      album: new Int32Array(kept),
      platform: new Uint16Array(kept),
      country: new Uint16Array(kept),
      reasonStart: new Uint16Array(kept),
      reasonEnd: new Uint16Array(kept),
      flags: new Uint16Array(kept),
    };
    let size = 0;
    let duplicates = 0;
    let previous = -1;
    for (let k = 0; k < kept; k++) {
      const i = sorted[k];
      if (
        previous >= 0 &&
        end[i] === end[previous] &&
        ms[i] === ms[previous] &&
        kind[i] === kind[previous] &&
        item[i] === item[previous] &&
        album[i] === album[previous] &&
        platform[i] === platform[previous] &&
        country[i] === country[previous] &&
        reasonStart[i] === reasonStart[previous] &&
        reasonEnd[i] === reasonEnd[previous] &&
        flags[i] === flags[previous]
      ) {
        duplicates++;
        continue;
      }
      out.end[size] = end[i];
      out.ms[size] = ms[i];
      out.kind[size] = kind[i];
      out.item[size] = item[i];
      out.album[size] = album[i];
      out.platform[size] = platform[i];
      out.country[size] = country[i];
      out.reasonStart[size] = reasonStart[i];
      out.reasonEnd[size] = reasonEnd[i];
      out.flags[size] = flags[i];
      size++;
      previous = i;
    }

    const columns = {
      end: out.end.slice(0, size),
      ms: out.ms.slice(0, size),
      kind: out.kind.slice(0, size),
      item: out.item.slice(0, size),
      album: out.album.slice(0, size),
      platform: out.platform.slice(0, size),
      country: out.country.slice(0, size),
      reasonStart: out.reasonStart.slice(0, size),
      reasonEnd: out.reasonEnd.slice(0, size),
      flags: out.flags.slice(0, size),
    };

    return {
      version: DATASET_VERSION,
      meta: {
        importedAt: input.importedAt,
        files: input.files,
        totalRecords: this.totalRecords,
        duplicates,
        invalid: this.invalid,
        supersededBasic,
        features: this.features(columns, size),
      },
      size,
      ...columns,
      artists: this.artists.values,
      songs: {
        name: this.songName,
        artist: Int32Array.from(this.songArtist),
        uri: this.representativeUris(),
      },
      albums: { name: this.albumName, artist: Int32Array.from(this.albumArtist), uri: this.albumUris() },
      shows: this.shows.values,
      episodes: {
        name: this.episodeName,
        show: Int32Array.from(this.episodeShow),
        uri: this.episodeUri,
      },
      books: { title: this.bookTitle, uri: this.bookUri },
      chapters: {
        title: this.chapterTitle,
        book: Int32Array.from(this.chapterBook),
        uri: this.chapterUri,
      },
      platforms: this.platforms.values,
      countries: this.countries.values,
      reasons: this.reasons.values,
    };
  }

  private push(
    end: number,
    ms: number,
    kind: number,
    item: number,
    album: number,
    platform: number,
    country: number,
    reasonStart: number,
    reasonEnd: number,
    flags: number,
    source: number,
  ) {
    this.end.push(end);
    this.ms.push(ms);
    this.kind.push(kind);
    this.item.push(item);
    this.album.push(album);
    this.platform.push(platform);
    this.country.push(country);
    this.reasonStart.push(reasonStart);
    this.reasonEnd.push(reasonEnd);
    this.flags.push(flags);
    this.source.push(source);
  }

  /** Resolves a track play to its song and album, via the per-URI cache when possible. */
  private track(uri: string | null, rawName: unknown, rawArtist: unknown, rawAlbum: unknown) {
    const cached = uri ? this.trackCache.get(uri) : undefined;
    if (cached && cached.rawName === rawName && cached.rawArtist === rawArtist && cached.rawAlbum === rawAlbum) {
      cached.count++;
      return cached;
    }
    const artist = this.artists.id(text(rawArtist) ?? UNKNOWN.artist);
    const song = this.songId(text(rawName) ?? UNKNOWN.track, artist);
    const albumName = text(rawAlbum);
    const resolved = {
      song,
      album: albumName ? this.albumId(albumName, artist) : -1,
      rawName,
      rawArtist,
      rawAlbum,
      count: (cached?.count ?? 0) + 1,
    };
    if (uri) this.trackCache.set(uri, resolved);
    return resolved;
  }

  /** Songs are keyed by title + artist so single, album and deluxe releases count as one song. */
  private songId(name: string, artist: number): number {
    const key = `${artist}\u0001${name.toLowerCase()}`;
    let id = this.songIndex.get(key);
    if (id === undefined) {
      id = this.songName.length;
      this.songName.push(name);
      this.songArtist.push(artist);
      this.songIndex.set(key, id);
    }
    return id;
  }

  private albumId(name: string, artist: number): number {
    const key = `${artist}\u0001${name.toLowerCase()}`;
    let id = this.albumIndex.get(key);
    if (id === undefined) {
      id = this.albumName.length;
      this.albumName.push(name);
      this.albumArtist.push(artist);
      this.albumIndex.set(key, id);
    }
    return id;
  }

  private episodeId(name: string | null, showName: string | null, uri: string | null): number {
    const show = this.shows.id(showName ?? UNKNOWN.show);
    const key = uri ?? `${show}\u0001${name ?? ""}`;
    let id = this.episodeIndex.get(key);
    if (id === undefined) {
      id = this.episodeName.length;
      this.episodeName.push(name ?? UNKNOWN.episode);
      this.episodeShow.push(show);
      this.episodeUri.push(uri ?? "");
      this.episodeIndex.set(key, id);
    }
    return id;
  }

  private chapterId(
    bookTitle: string | null,
    bookUri: string | null,
    chapterTitle: string | null,
    chapterUri: string | null,
  ): number {
    const bookKey = bookUri ?? bookTitle ?? UNKNOWN.book;
    let book = this.bookIndex.get(bookKey);
    if (book === undefined) {
      book = this.bookTitle.length;
      this.bookTitle.push(bookTitle ?? UNKNOWN.book);
      this.bookUri.push(bookUri ?? "");
      this.bookIndex.set(bookKey, book);
    }
    const key = chapterUri ?? `${book}\u0001${chapterTitle ?? ""}`;
    let id = this.chapterIndex.get(key);
    if (id === undefined) {
      id = this.chapterTitle.length;
      this.chapterTitle.push(chapterTitle ?? bookTitle ?? UNKNOWN.chapter);
      this.chapterBook.push(book);
      this.chapterUri.push(chapterUri ?? "");
      this.chapterIndex.set(key, id);
    }
    return id;
  }

  private representativeUris(): string[] {
    const uris = new Array<string>(this.songName.length).fill("");
    const best = new Array<number>(this.songName.length).fill(0);
    for (const [uri, { song, count }] of this.trackCache) {
      if (count > best[song]) {
        best[song] = count;
        uris[song] = uri;
      }
    }
    return uris;
  }

  /** The most played track URI on each album, so its cover art can be looked up. */
  private albumUris(): string[] {
    const uris = new Array<string>(this.albumName.length).fill("");
    const best = new Array<number>(this.albumName.length).fill(0);
    for (const [uri, { album, count }] of this.trackCache) {
      if (album >= 0 && count > best[album]) {
        best[album] = count;
        uris[album] = uri;
      }
    }
    return uris;
  }

  private features(
    columns: Pick<Dataset, "album" | "platform" | "country" | "reasonStart" | "reasonEnd" | "flags">,
    size: number,
  ): DatasetFeatures {
    let flagsSeen = 0;
    let albums = false;
    let platforms = false;
    let countries = false;
    let reasons = false;
    const unknownPlatform = this.platforms.values.indexOf(UNKNOWN.platform);
    const unknownCountry = this.countries.values.indexOf(UNKNOWN.country);
    const unknownReason = this.reasons.values.indexOf(UNKNOWN.reason);
    for (let i = 0; i < size; i++) {
      flagsSeen |= columns.flags[i];
      if (columns.album[i] >= 0) albums = true;
      if (columns.platform[i] !== unknownPlatform) platforms = true;
      if (columns.country[i] !== unknownCountry) countries = true;
      if (columns.reasonStart[i] !== unknownReason || columns.reasonEnd[i] !== unknownReason) reasons = true;
    }
    return {
      skips: (flagsSeen & FLAG.skippedKnown) !== 0,
      shuffle: (flagsSeen & FLAG.shuffleKnown) !== 0,
      offline: (flagsSeen & FLAG.offlineKnown) !== 0,
      incognito: (flagsSeen & FLAG.incognitoKnown) !== 0,
      platforms,
      countries,
      reasons,
      albums,
      video: (flagsSeen & FLAG.video) !== 0,
    };
  }
}

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  const first = value.charCodeAt(0);
  const last = value.charCodeAt(value.length - 1);
  if (first > 32 && first !== 160 && last > 32 && last !== 160) return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toMs(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.round(n), 0xffffffff);
}

function boolFlag(value: unknown, on: number, known: number): number {
  if (typeof value !== "boolean") return 0;
  return known | (value ? on : 0);
}

function isPlausibleTime(t: number): boolean {
  return Number.isFinite(t) && t >= MIN_TIME && t < MAX_TIME;
}

function digits(s: string, from: number, count: number): number {
  let n = 0;
  for (let i = from; i < from + count; i++) {
    const d = s.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return NaN;
    n = n * 10 + d;
  }
  return n;
}

/**
 * Parses Spotify timestamps as UTC: `2023-03-28T16:40:34Z` (extended),
 * `2023-03-28 16:40:34` (older extended) and `2023-03-28 16:40` (basic).
 * Anything else falls back to `Date.parse`.
 */
export function parseTimestamp(value: unknown): number {
  if (typeof value === "number") return value > 1e11 ? value : value * 1000;
  if (typeof value !== "string") return NaN;
  const s = value.trim();
  const separator = s.charCodeAt(10);
  if (
    s.length >= 16 &&
    s.charCodeAt(4) === 45 &&
    s.charCodeAt(7) === 45 &&
    (separator === 84 || separator === 32) &&
    s.charCodeAt(13) === 58
  ) {
    let seconds = 0;
    let fraction = 0;
    let rest = 16;
    if (s.charCodeAt(16) === 58) {
      seconds = digits(s, 17, 2);
      rest = 19;
      if (s.charCodeAt(19) === 46) {
        let j = 20;
        while (j < s.length && s.charCodeAt(j) >= 48 && s.charCodeAt(j) <= 57) j++;
        fraction = Number(`0.${s.slice(20, j)}`) * 1000;
        rest = j;
      }
    }
    const tail = s.slice(rest);
    if (tail === "" || tail === "Z" || tail === "z" || tail === "+00:00") {
      const t = Date.UTC(
        digits(s, 0, 4),
        digits(s, 5, 2) - 1,
        digits(s, 8, 2),
        digits(s, 11, 2),
        digits(s, 14, 2),
        seconds,
      );
      return t + Math.round(fraction);
    }
  }
  return Date.parse(s);
}
