import { describe, expect, it, vi } from "vitest";
import { createLimiter, createResourceCache } from "@/lib/resource-cache";

describe("createResourceCache", () => {
  it("loads each key once, shares in-flight requests and notifies subscribers", async () => {
    const fetcher = vi.fn(async (key: string) => `value:${key}`);
    const cache = createResourceCache(fetcher, null as string | null);
    const listener = vi.fn();
    cache.subscribe(listener);

    expect(cache.peek("a")).toBeUndefined();
    const [first, second] = await Promise.all([cache.load("a"), cache.load("a")]);
    expect(first).toBe("value:a");
    expect(second).toBe("value:a");
    expect(await cache.load("a")).toBe("value:a");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.peek("a")).toBe("value:a");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("settles failures to the fallback", async () => {
    const cache = createResourceCache(async () => {
      throw new Error("offline");
    }, "fallback");
    expect(await cache.load("x")).toBe("fallback");
    expect(cache.peek("x")).toBe("fallback");
  });
});

describe("createLimiter", () => {
  it("never runs more than the limit at once", async () => {
    const run = createLimiter(2);
    let active = 0;
    let peak = 0;
    const task = async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
    };
    await Promise.all(Array.from({ length: 7 }, () => run(task)));
    expect(peak).toBe(2);
  });
});
