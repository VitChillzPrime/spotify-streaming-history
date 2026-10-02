/**
 * The in-browser data model.
 *
 * A Spotify export is flattened into a columnar dataset: one typed-array
 * column per field, one entry per stream, sorted by start time. Strings
 * (track names, artists, platforms, …) live once in dictionary tables and
 * streams point at them by index. This keeps a multi-year history down to a
 * few megabytes in IndexedDB and lets every statistic be a tight loop.
 */

export const DATASET_VERSION = 1;

/** What kind of content a stream played. */
export const KIND = {
  track: 0,
  episode: 1,
  audiobook: 2,
  unknown: 3,
} as const;
export type Kind = (typeof KIND)[keyof typeof KIND];

/** Bit flags packed into `Dataset.flags`. `*Known` bits mark fields the export actually provided. */
export const FLAG = {
  shuffle: 1 << 0,
  skipped: 1 << 1,
  offline: 1 << 2,
  incognito: 1 << 3,
  video: 1 << 4,
  shuffleKnown: 1 << 5,
  skippedKnown: 1 << 6,
  offlineKnown: 1 << 7,
  incognitoKnown: 1 << 8,
} as const;

export type ExportFormat = "extended" | "basic";

export interface ImportedFile {
  name: string;
  format: ExportFormat;
  records: number;
}

export interface DatasetMeta {
  importedAt: number;
  files: ImportedFile[];
  /** Raw records read from the files, before cleanup. */
  totalRecords: number;
  /** Exact duplicate rows removed (overlapping exports, repeated files). */
  duplicates: number;
  /** Rows that could not be read (missing or malformed timestamp). */
  invalid: number;
  /** Basic-format rows dropped because extended history already covers their dates. */
  supersededBasic: number;
  /** Which optional fields are present anywhere in the data. */
  features: DatasetFeatures;
}

export interface DatasetFeatures {
  skips: boolean;
  shuffle: boolean;
  offline: boolean;
  incognito: boolean;
  platforms: boolean;
  countries: boolean;
  reasons: boolean;
  albums: boolean;
  video: boolean;
}

export interface Dataset {
  version: number;
  meta: DatasetMeta;
  /** Number of streams. */
  size: number;

  // Per-stream columns (index i = one stream), sorted by start time.
  /** Epoch ms (UTC) when playback stopped: Spotify's `ts`. */
  end: Float64Array;
  /** Milliseconds played. */
  ms: Uint32Array;
  kind: Uint8Array;
  /** Index into `songs`, `episodes` or `chapters` depending on `kind`; -1 when unknown. */
  item: Int32Array;
  /** Index into `albums` for tracks; -1 otherwise. */
  album: Int32Array;
  platform: Uint16Array;
  country: Uint16Array;
  reasonStart: Uint16Array;
  reasonEnd: Uint16Array;
  flags: Uint16Array;

  // Dictionaries.
  artists: string[];
  songs: { name: string[]; artist: Int32Array; uri: string[] };
  albums: { name: string[]; artist: Int32Array };
  shows: string[];
  episodes: { name: string[]; show: Int32Array; uri: string[] };
  books: { title: string[]; uri: string[] };
  chapters: { title: string[]; book: Int32Array; uri: string[] };
  platforms: string[];
  countries: string[];
  reasons: string[];
}

/** Placeholder labels used when an export omits a name. */
export const UNKNOWN = {
  artist: "Unknown artist",
  track: "Unknown track",
  album: "Unknown album",
  show: "Unknown show",
  episode: "Unknown episode",
  book: "Unknown audiobook",
  chapter: "Unknown chapter",
  platform: "Unknown",
  country: "ZZ",
  reason: "unknown",
} as const;
