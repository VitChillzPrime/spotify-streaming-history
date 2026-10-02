import { DATASET_VERSION, type Dataset } from "@/lib/model";

// The dataset is stored in IndexedDB on the user's device. It never leaves the browser.

const DB_NAME = "encore";
const DB_VERSION = 2;
const STORE = "datasets";
const CURRENT = "current";

/** Small caches keyed by Spotify URI or ID: cover art URLs and Spotify Web API lookups. */
export type CacheStore = "artwork" | "spotify";
const CACHE_STORES: CacheStore[] = ["artwork", "spotify"];

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      // Version 2 adds the caches; existing stores and data are kept.
      for (const name of [STORE, ...CACHE_STORES]) {
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("The database is open in another tab with an older version."));
  });
}

// One connection per tab, reused across operations (artwork lookups make many small ones).
// It closes itself when another tab needs to upgrade the schema, and reopens on next use.
let connection: Promise<IDBDatabase> | null = null;

function database(): Promise<IDBDatabase> {
  connection ??= openDatabase().then(
    (db) => {
      db.onversionchange = () => {
        db.close();
        connection = null;
      };
      db.onclose = () => {
        connection = null;
      };
      return db;
    },
    (error) => {
      connection = null;
      throw error;
    },
  );
  return connection;
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
  name: string = STORE,
): Promise<T> {
  const db = await database();
  const tx = db.transaction(name, mode);
  const committed = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
  });
  const [result] = await Promise.all([request(run(tx.objectStore(name))), committed]);
  return result;
}

/** Returns the saved dataset, or null when there is none (or it was saved by an incompatible version). */
export async function loadDataset(): Promise<Dataset | null> {
  if (typeof indexedDB === "undefined") return null;
  const value = (await withStore("readonly", (store) => store.get(CURRENT))) as Dataset | undefined;
  if (!value || value.version !== DATASET_VERSION) return null;
  return value;
}

export async function saveDataset(dataset: Dataset): Promise<void> {
  await withStore("readwrite", (store) => store.put(dataset, CURRENT));
  // Ask the browser not to evict the data under storage pressure. Best effort.
  await navigator.storage?.persist?.().catch(() => false);
}

/** Deletes the dataset and everything derived from it (cached artwork and Spotify lookups). */
export async function deleteDataset(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await withStore("readwrite", (store) => store.delete(CURRENT));
  for (const name of CACHE_STORES) await withStore("readwrite", (store) => store.clear(), name);
}

export async function cacheGet<T>(store: CacheStore, key: string): Promise<T | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  return (await withStore("readonly", (s) => s.get(key), store)) as T | undefined;
}

export async function cachePut(store: CacheStore, key: string, value: unknown): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await withStore("readwrite", (s) => s.put(value, key), store);
}

export async function storageUsage(): Promise<number | null> {
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  return estimate?.usage ?? null;
}
