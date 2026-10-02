/** Runs at most `max` tasks at once; the rest wait their turn. */
export function createLimiter(max: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async function run<T>(task: () => Promise<T>): Promise<T> {
    if (active >= max) await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}

export interface ResourceCache<V> {
  /** The settled value, or undefined while unknown. */
  peek(key: string): V | undefined;
  /** Loads once per key: concurrent callers share a request, and the result is remembered. */
  load(key: string): Promise<V>;
  subscribe(listener: () => void): () => void;
  clear(): void;
}

/**
 * An in-memory cache of async lookups (cover URLs, artist details) that React
 * components read through `useSyncExternalStore`, so every tile showing the
 * same item updates together. Failed loads settle to `fallback`.
 */
export function createResourceCache<V>(fetcher: (key: string) => Promise<V>, fallback: V): ResourceCache<V> {
  const memory = new Map<string, V>();
  const inflight = new Map<string, Promise<V>>();
  const listeners = new Set<() => void>();
  const settle = (key: string, value: V) => {
    memory.set(key, value);
    inflight.delete(key);
    for (const listener of listeners) listener();
    return value;
  };
  return {
    peek: (key) => memory.get(key),
    load(key) {
      if (memory.has(key)) return Promise.resolve(memory.get(key) as V);
      let pending = inflight.get(key);
      if (!pending) {
        pending = fetcher(key).then(
          (value) => settle(key, value),
          () => settle(key, fallback),
        );
        inflight.set(key, pending);
      }
      return pending;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    clear() {
      memory.clear();
      for (const listener of listeners) listener();
    },
  };
}
