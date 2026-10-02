import { DatasetBuilder } from "@/lib/ingest/builder";
import { datasetBuffers, type ImportRequest, type ImportResponse } from "@/lib/ingest/protocol";
import { collectSources, detectFormat, UnreadableArchiveError } from "@/lib/ingest/sources";
import type { ImportedFile } from "@/lib/model";

// Runs off the main thread: unzipping and parsing hundreds of megabytes of
// JSON would otherwise freeze the page.

function send(message: ImportResponse, transfer: Transferable[] = []) {
  self.postMessage(message, { transfer });
}

self.addEventListener("message", async (event: MessageEvent<ImportRequest>) => {
  try {
    send({ type: "progress", progress: { stage: "reading", done: 0, total: 0 } });
    const sources = await collectSources(event.data.files);
    if (sources.length === 0) {
      send({
        type: "error",
        code: "no-history",
        message:
          "No streaming history was found. Upload the zip Spotify emailed you, or the Streaming_History JSON files inside it.",
      });
      return;
    }

    const builder = new DatasetBuilder();
    const decoder = new TextDecoder();
    const files: ImportedFile[] = [];
    const skippedFiles: string[] = [];
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      send({ type: "progress", progress: { stage: "parsing", done: i, total: sources.length, detail: source.name } });
      let json: unknown;
      try {
        json = JSON.parse(decoder.decode(await source.read()));
      } catch (error) {
        if (error instanceof UnreadableArchiveError) throw error;
        skippedFiles.push(source.name);
        continue;
      }
      const format = detectFormat(json);
      if (!format) {
        skippedFiles.push(source.name);
        continue;
      }
      const rows = json as unknown[];
      if (format === "extended") builder.addExtended(rows, { video: source.video });
      else builder.addBasic(rows);
      files.push({ name: source.name, format, records: rows.length });
    }

    send({ type: "progress", progress: { stage: "indexing", done: sources.length, total: sources.length } });
    const dataset = builder.finalize({ files, importedAt: Date.now() });
    if (dataset.size === 0) {
      send({
        type: "error",
        code: "empty",
        message: "The files were read, but they don't contain any plays.",
      });
      return;
    }
    send({ type: "done", dataset, skippedFiles }, datasetBuffers(dataset));
  } catch (error) {
    send({
      type: "error",
      code: error instanceof UnreadableArchiveError ? "unreadable" : "unknown",
      message: error instanceof Error ? error.message : "Something went wrong while reading your files.",
    });
  }
});
