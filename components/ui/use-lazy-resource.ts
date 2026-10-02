"use client";

import { useEffect, useSyncExternalStore, type RefObject } from "react";
import type { ResourceCache } from "@/lib/resource-cache";

/**
 * Reads `key` from a resource cache, starting the load only once `element` is
 * near the viewport, so long lists don't fire hundreds of requests at once.
 */
export function useLazyResource<V>(
  cache: ResourceCache<V>,
  key: string | null,
  element: RefObject<Element | null>,
): V | undefined {
  const value = useSyncExternalStore(
    cache.subscribe,
    () => (key ? cache.peek(key) : undefined),
    () => undefined,
  );

  useEffect(() => {
    const node = element.current;
    if (!key || !node || cache.peek(key) !== undefined) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        void cache.load(key);
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cache, key, element]);

  return value;
}
