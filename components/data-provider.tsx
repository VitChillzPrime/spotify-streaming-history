"use client";

import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ImportErrorCode, ImportProgress } from "@/lib/ingest/protocol";
import { ImportError, runImport } from "@/lib/ingest/run-import";
import type { Dataset } from "@/lib/model";
import { prepare, type Prepared } from "@/lib/prepare";
import { effectiveTimeZone, settingsStore } from "@/lib/settings";
import { deleteDataset, loadDataset, saveDataset } from "@/lib/storage";

export type DataStatus = "loading" | "empty" | "ready";

export interface ImportState {
  running: boolean;
  progress: ImportProgress | null;
  error: { code: ImportErrorCode; message: string } | null;
  /** Files that were found but couldn't be read as streaming history. */
  skippedFiles: string[];
}

interface DataContextValue {
  status: DataStatus;
  dataset: Dataset | null;
  prepared: Prepared | null;
  timeZone: string;
  importState: ImportState;
  /** Set when the data couldn't be saved to IndexedDB (it still works until the tab closes). */
  saveError: string | null;
  importFiles: (files: File[]) => Promise<boolean>;
  clearData: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

const IDLE: ImportState = { running: false, progress: null, error: null, skippedFiles: [] };
const CHANNEL = "encore-data";

export function DataProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [status, setStatus] = useState<DataStatus>("loading");
  const [importState, setImportState] = useState<ImportState>(IDLE);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [settings] = settingsStore.useValue();
  const channel = useRef<BroadcastChannel | null>(null);

  const timeZone = useMemo(() => effectiveTimeZone(settings), [settings]);
  const prepared = useMemo(() => (dataset ? prepare(dataset, timeZone) : null), [dataset, timeZone]);

  const reload = useCallback(async () => {
    try {
      const saved = await loadDataset();
      setDataset(saved);
      setStatus(saved ? "ready" : "empty");
    } catch {
      setStatus("empty");
    }
  }, []);

  useEffect(() => {
    let active = true;
    loadDataset()
      .then((saved) => {
        if (!active) return;
        setDataset(saved);
        setStatus(saved ? "ready" : "empty");
      })
      .catch(() => active && setStatus("empty"));

    // Keep other open tabs in step when data is imported or deleted.
    if (typeof BroadcastChannel !== "undefined") {
      const bc = new BroadcastChannel(CHANNEL);
      bc.onmessage = () => void reload();
      channel.current = bc;
    }
    return () => {
      active = false;
      channel.current?.close();
      channel.current = null;
    };
  }, [reload]);

  const importFiles = useCallback(async (files: File[]) => {
    setImportState({ ...IDLE, running: true });
    try {
      const result = await runImport(files, (progress) => setImportState((state) => ({ ...state, progress })));
      try {
        await saveDataset(result.dataset);
        setSaveError(null);
        channel.current?.postMessage("changed");
      } catch {
        setSaveError("Your stats couldn't be saved in this browser, so they'll be gone when you close this tab.");
      }
      setDataset(result.dataset);
      setStatus("ready");
      setImportState({ ...IDLE, skippedFiles: result.skippedFiles });
      return true;
    } catch (error) {
      setImportState({
        ...IDLE,
        error:
          error instanceof ImportError
            ? { code: error.code, message: error.message }
            : { code: "unknown", message: "Something went wrong while reading your files." },
      });
      return false;
    }
  }, []);

  const clearData = useCallback(async () => {
    await deleteDataset();
    setDataset(null);
    setStatus("empty");
    setSaveError(null);
    channel.current?.postMessage("changed");
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({ status, dataset, prepared, timeZone, importState, saveError, importFiles, clearData }),
    [status, dataset, prepared, timeZone, importState, saveError, importFiles, clearData],
  );

  return <DataContext value={value}>{children}</DataContext>;
}

export function useData(): DataContextValue {
  const context = use(DataContext);
  if (!context) throw new Error("useData must be used inside <DataProvider>");
  return context;
}

/** The prepared dataset; only call this below a component that has checked `status === "ready"`. */
export function usePrepared(): Prepared {
  const { prepared } = useData();
  if (!prepared) throw new Error("usePrepared called before data was ready");
  return prepared;
}
