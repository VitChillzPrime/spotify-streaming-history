import type { Prepared } from "@/lib/prepare";
import type { Scope } from "@/lib/stats/scope";

const LIMIT = 80;
const caches = new WeakMap<Prepared, Map<string, unknown>>();

/**
 * Memoizes a computation per prepared dataset, date range, content filter and
 * stream threshold, so revisiting a page (or switching back to a filter) is
 * instant. `name` must include any other inputs, e.g. `timeline:month`.
 * Entries are dropped with the dataset, and the oldest go first past LIMIT.
 */
export function cached<T>(scope: Scope, name: string, compute: () => T): T {
  let cache = caches.get(scope.p);
  if (!cache) {
    cache = new Map();
    caches.set(scope.p, cache);
  }
  const key = `${name}|${JSON.stringify(scope.range.spec)}|${scope.kinds}|${scope.minMs}`;
  if (cache.has(key)) {
    const value = cache.get(key) as T;
    // Refresh recency.
    cache.delete(key);
    cache.set(key, value);
    return value;
  }
  const value = compute();
  cache.set(key, value);
  if (cache.size > LIMIT) cache.delete(cache.keys().next().value!);
  return value;
}
