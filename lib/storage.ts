import { DATASET_VERSION, type Dataset } from "@/lib/model";

// The dataset is stored in IndexedDB on the user's device. It never leaves the browser.

const DB_NAME = "encore";
const DB_VERSION = 1;
const STORE = "datasets";
const CURRENT = "current";

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
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error("The database is open in another tab with an older version."));
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE, mode);
    const committed = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error("Transaction aborted"));
    });
    const [result] = await Promise.all([request(run(tx.objectStore(STORE))), committed]);
    return result;
  } finally {
    db.close();
  }
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

export async function deleteDataset(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await withStore("readwrite", (store) => store.delete(CURRENT));
}

export async function storageUsage(): Promise<number | null> {
  const estimate = await navigator.storage?.estimate?.().catch(() => null);
  return estimate?.usage ?? null;
}
