import type { Dataset } from "@/lib/model";

export type ImportStage = "reading" | "parsing" | "indexing";

export interface ImportProgress {
  stage: ImportStage;
  /** Files parsed so far (parsing stage). */
  done: number;
  total: number;
  /** Name of the file being parsed. */
  detail?: string;
}

export type ImportErrorCode = "no-history" | "empty" | "unreadable" | "unknown";

export interface ImportRequest {
  files: File[];
}

export type ImportResponse =
  | { type: "progress"; progress: ImportProgress }
  | { type: "done"; dataset: Dataset; skippedFiles: string[] }
  | { type: "error"; code: ImportErrorCode; message: string };

/** The typed-array buffers of a dataset, so it can be transferred between threads without copying. */
export function datasetBuffers(dataset: Dataset): ArrayBuffer[] {
  return [
    dataset.end,
    dataset.ms,
    dataset.kind,
    dataset.item,
    dataset.album,
    dataset.platform,
    dataset.country,
    dataset.reasonStart,
    dataset.reasonEnd,
    dataset.flags,
    dataset.songs.artist,
    dataset.albums.artist,
    dataset.episodes.show,
    dataset.chapters.book,
  ].map((column) => column.buffer as ArrayBuffer);
}
