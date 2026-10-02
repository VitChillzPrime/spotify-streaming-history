import { useSyncExternalStore } from "react";

interface Codec<T> {
  serialize: (value: T) => string;
  /** Returns null for unusable stored values, which then fall back to the default. */
  deserialize: (raw: string) => T | null;
}

const jsonCodec = <T,>(validate: (value: unknown) => T | null): Codec<T> => ({
  serialize: (value) => JSON.stringify(value),
  deserialize: (raw) => {
    try {
      return validate(JSON.parse(raw));
    } catch {
      return null;
    }
  },
});

/**
 * A small preference stored in localStorage and read with `useSyncExternalStore`,
 * so server rendering sees the default and the client switches without a
 * hydration mismatch. Stays in sync across tabs. Falls back to memory when
 * storage is blocked (private windows, disabled site data).
 */
export function createLocalStore<T>(key: string, fallback: T, codec: Codec<T>) {
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; value: T } | null = null;
  let memory: { value: T } | null = null;

  function get(): T {
    let raw: string | null;
    try {
      raw = localStorage.getItem(key);
    } catch {
      return memory ? memory.value : fallback;
    }
    if (cache && cache.raw === raw) return cache.value;
    const value = raw === null ? fallback : (codec.deserialize(raw) ?? fallback);
    cache = { raw, value };
    return value;
  }

  function set(value: T) {
    const raw = codec.serialize(value);
    try {
      localStorage.setItem(key, raw);
      cache = { raw, value };
    } catch {
      memory = { value };
    }
    for (const listener of listeners) listener();
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  function useValue(): [T, (value: T) => void] {
    const value = useSyncExternalStore(subscribe, get, () => fallback);
    return [value, set];
  }

  return { get, set, subscribe, useValue };
}

export function jsonStore<T>(key: string, fallback: T, validate: (value: unknown) => T | null) {
  return createLocalStore(key, fallback, jsonCodec(validate));
}
