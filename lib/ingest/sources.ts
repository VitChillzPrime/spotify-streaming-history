import { unzipSync } from "fflate";
import { listZip, readZipEntry } from "@/lib/ingest/zip";

/** A JSON file to parse, either loose or inside a zip archive. */
export interface Source {
  /** File name without folders, e.g. `Streaming_History_Audio_2023.json`. */
  name: string;
  /** Path inside the archive (or the file name for loose files). */
  path: string;
  /** Uncompressed size in bytes. */
  size: number;
  /** Rows come from a `Streaming_History_Video_*` file. */
  video: boolean;
  read(): Promise<Uint8Array>;
}

/** `Streaming_History_Audio_*`, `StreamingHistory_music_*`, `StreamingHistory0`, `endsong_*`, `endvideo_*`… */
const HISTORY_NAME = /^(streaming_?history|end_?song|end_?video)/i;

export function baseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

export function isHistoryFile(path: string): boolean {
  return HISTORY_NAME.test(baseName(path)) && /\.json$/i.test(path);
}

export function isVideoFile(path: string): boolean {
  return /video/i.test(baseName(path));
}

/** macOS resource forks and folder entries that zip tools leave behind. */
function isJunk(path: string): boolean {
  return path.endsWith("/") || path.includes("__MACOSX/") || baseName(path).startsWith("._");
}

function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05);
}

export class UnreadableArchiveError extends Error {
  constructor(fileName: string) {
    super(`“${fileName}” could not be opened as a zip archive.`);
    this.name = "UnreadableArchiveError";
  }
}

/**
 * Finds the streaming-history JSON files among the user's files. Other JSON
 * (playlists, library, inferences…) is only considered when nothing matches
 * by name, so renamed history files still work.
 */
export async function collectSources(files: File[]): Promise<Source[]> {
  const matched: Source[] = [];
  const others: Source[] = [];
  const add = (source: Source) => (isHistoryFile(source.path) ? matched : others).push(source);

  for (const file of files) {
    if (/\.json$/i.test(file.name)) {
      add({
        name: file.name,
        path: file.name,
        size: file.size,
        video: isVideoFile(file.name),
        read: async () => new Uint8Array(await file.arrayBuffer()),
      });
      continue;
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isZip(bytes)) continue;
    // Entries are inflated one at a time so a large export never sits in memory twice.
    const native = listZip(bytes);
    const entries: { path: string; size: number; read: () => Promise<Uint8Array> }[] = [];
    if (native) {
      for (const entry of native) {
        entries.push({ path: entry.name, size: entry.size, read: () => readZipEntry(bytes, entry) });
      }
    } else {
      // ZIP64 and other unusual archives: fall back to fflate.
      try {
        unzipSync(bytes, {
          filter(entry) {
            entries.push({
              path: entry.name,
              size: entry.originalSize,
              read: async () => unzipSync(bytes, { filter: (f) => f.name === entry.name })[entry.name],
            });
            return false;
          },
        });
      } catch {
        throw new UnreadableArchiveError(file.name);
      }
    }
    for (const entry of entries) {
      if (isJunk(entry.path) || !/\.json$/i.test(entry.path)) continue;
      add({
        name: baseName(entry.path),
        path: entry.path,
        size: entry.size,
        video: isVideoFile(entry.path),
        read: async () => {
          try {
            return await entry.read();
          } catch {
            throw new UnreadableArchiveError(file.name);
          }
        },
      });
    }
  }

  const sources = matched.length > 0 ? matched : others;
  return sources.sort((a, b) => a.path.localeCompare(b.path));
}

export type HistoryFormat = "extended" | "basic";

/** Identifies which export a parsed JSON file came from by looking at its first rows. */
export function detectFormat(json: unknown): HistoryFormat | null {
  if (!Array.isArray(json)) return null;
  for (let i = 0; i < Math.min(json.length, 20); i++) {
    const row = json[i];
    if (typeof row !== "object" || row === null) continue;
    if ("ts" in row && ("ms_played" in row || "master_metadata_track_name" in row)) return "extended";
    if ("endTime" in row && "msPlayed" in row) return "basic";
  }
  return null;
}
