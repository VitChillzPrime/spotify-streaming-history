import type { ImportErrorCode, ImportProgress, ImportResponse } from "@/lib/ingest/protocol";
import type { Dataset } from "@/lib/model";

export class ImportError extends Error {
  constructor(
    readonly code: ImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ImportError";
  }
}

/** Parses the user's export in a Web Worker and resolves with the finished dataset. */
export function runImport(
  files: File[],
  onProgress: (progress: ImportProgress) => void,
): Promise<{ dataset: Dataset; skippedFiles: string[] }> {
  const worker = new Worker(new URL("./import.worker.ts", import.meta.url), { type: "module" });
  return new Promise((resolve, reject) => {
    worker.addEventListener("message", (event: MessageEvent<ImportResponse>) => {
      const message = event.data;
      if (message.type === "progress") {
        onProgress(message.progress);
        return;
      }
      worker.terminate();
      if (message.type === "done") resolve({ dataset: message.dataset, skippedFiles: message.skippedFiles });
      else reject(new ImportError(message.code, message.message));
    });
    worker.addEventListener("error", (event) => {
      worker.terminate();
      reject(new ImportError("unknown", event.message || "The import worker crashed."));
    });
    worker.postMessage({ files });
  });
}
