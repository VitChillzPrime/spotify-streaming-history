"use client";

import { FileArchive, FolderOpen, LoaderCircle, TriangleAlert, Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { useData } from "@/components/data-provider";
import { Button } from "@/components/ui/button";
import type { ImportProgress } from "@/lib/ingest/protocol";
import { cn } from "@/lib/ui";

/** Collects files from a drop, walking into dropped folders (Safari unzips downloads automatically). */
async function droppedFiles(transfer: DataTransfer): Promise<File[]> {
  // Entries must be read synchronously, inside the drop event.
  const entries = Array.from(transfer.items ?? [])
    .map((item) => item.webkitGetAsEntry?.())
    .filter((entry): entry is FileSystemEntry => !!entry);
  if (entries.length === 0) return Array.from(transfer.files);

  const files: File[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      files.push(await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject)));
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
        if (batch.length === 0) break;
        for (const child of batch) await walk(child);
      }
    }
  };
  for (const entry of entries) await walk(entry);
  return files;
}

function progressText(progress: ImportProgress | null): { label: string; detail: string; ratio: number | null } {
  if (!progress || progress.stage === "reading") return { label: "Opening your export…", detail: "Reading the archive", ratio: null };
  if (progress.stage === "parsing") {
    return {
      label: `Reading file ${progress.done + 1} of ${progress.total}`,
      detail: progress.detail ?? "",
      ratio: progress.total ? (progress.done + 0.5) / progress.total : null,
    };
  }
  return { label: "Crunching the numbers…", detail: "Indexing every stream", ratio: 1 };
}

export function Dropzone({ onImported, compact = false }: { onImported?: () => void; compact?: boolean }) {
  const { importFiles, importState } = useData();
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const start = async (files: File[]) => {
    if (files.length === 0 || importState.running) return;
    if (await importFiles(files)) onImported?.();
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    await start(await droppedFiles(event.dataTransfer));
  };

  if (importState.running) {
    const { label, detail, ratio } = progressText(importState.progress);
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "flex flex-col items-center justify-center rounded-3xl border border-line bg-surface px-6 text-center shadow-card",
          compact ? "py-8" : "py-14",
        )}
      >
        <LoaderCircle className="size-7 animate-spin text-accent" aria-hidden />
        <p className="mt-4 text-[15px] font-semibold text-ink">{label}</p>
        <p className="mt-1 h-5 max-w-full truncate text-[13px] text-ink-3">{detail}</p>
        <div className="mt-5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-3">
          <div
            className={cn("h-full rounded-full bg-accent transition-[width] duration-300", ratio === null && "w-1/3 animate-pulse")}
            style={ratio === null ? undefined : { width: `${Math.round(ratio * 100)}%` }}
          />
        </div>
        <p className="mt-4 text-xs text-ink-3">Everything is processed on this device — nothing is uploaded.</p>
      </div>
    );
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Import your Spotify data: drop the zip here or press Enter to choose it"
        onClick={() => fileInput.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInput.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={onDrop}
        className={cn(
          "group relative flex flex-col items-center justify-center rounded-3xl border-[1.5px] border-dashed px-6 text-center transition-[border-color,background-color,transform] duration-200",
          compact ? "py-8" : "py-12 sm:py-14",
          dragging
            ? "scale-[1.01] border-accent bg-accent-wash"
            : "border-line-strong bg-surface hover:border-accent hover:bg-surface-2",
        )}
      >
        <div
          className={cn(
            "flex size-14 items-center justify-center rounded-2xl transition-colors",
            dragging ? "bg-accent text-white" : "bg-accent-wash text-accent-ink group-hover:bg-accent group-hover:text-white",
          )}
        >
          {dragging ? <FileArchive className="size-6" aria-hidden /> : <Upload className="size-6" aria-hidden />}
        </div>
        <p className="mt-5 text-[17px] font-semibold tracking-[-0.01em] text-ink">
          {dragging ? "Drop it — we'll take it from here" : "Drop your Spotify data here"}
        </p>
        <p className="mt-1.5 max-w-sm text-[13px] leading-5 text-ink-3">
          The <span className="font-medium text-ink-2">my_spotify_data.zip</span> file Spotify emailed you, or the
          JSON files inside it.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="primary"
            onClick={(event) => {
              event.stopPropagation();
              fileInput.current?.click();
            }}
          >
            <FileArchive /> Choose file
          </Button>
          <Button
            variant="ghost"
            onClick={(event) => {
              event.stopPropagation();
              folderInput.current?.click();
            }}
          >
            <FolderOpen /> Choose folder
          </Button>
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        multiple
        accept=".zip,.json,application/zip,application/json"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          void start(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />
      <input
        ref={(node) => {
          folderInput.current = node;
          if (node) node.webkitdirectory = true;
        }}
        type="file"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          void start(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
      />

      {importState.error && (
        <div role="alert" className="mt-4 flex items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left shadow-card">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-bad" aria-hidden />
          <div className="text-[13px] leading-5">
            <p className="font-semibold text-ink">
              {importState.error.code === "no-history"
                ? "That doesn't look like a Spotify export"
                : importState.error.code === "unreadable"
                  ? "The file couldn't be opened"
                  : "Import failed"}
            </p>
            <p className="text-ink-2">{importState.error.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
