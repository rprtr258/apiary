import {RequestID} from "@/types.ts";
import {describe, test, expect} from "bun:test";
import type {Result} from "@/result.ts";
import {ok, err} from "@/result.ts";
import {STALE_AFTER, createSourceCache, isStale} from "./cache.ts";

function testCache(fetcher: (id: RequestID) => Promise<Result<string[]>>) {
  return createSourceCache({fetcher, errorTitle: "test"});
}

describe("createSourceCache", () => {
  test("fetch stores fetched items as fresh", async () => {
    const cache = testCache(id => Promise.resolve(ok([`item-${id}`])));
    expect(cache.get("a")).toBeUndefined();
    await cache.fetch("a");
    const entry = cache.get("a");
    expect(entry?.items).toEqual(["item-a"]);
    expect(entry?.loading).toBe(false);
    expect(isStale(cache, "a")).toBe(false);
  });

  test("fetch error shows loading=false and empty items, entry stays stale", async () => {
    const cache = testCache(() => Promise.resolve(err("boom")));
    await cache.fetch("a");
    const entry = cache.get("a");
    expect(entry?.items).toEqual([]);
    expect(entry?.loading).toBe(false);
    expect(isStale(cache, "a")).toBe(true);
  });

  test("ensureFresh skips fresh entries and refetches stale ones", async () => {
    let calls = 0;
    const cache = testCache(() => {
      calls += 1;
      return Promise.resolve(ok([String(calls)]));
    });
    await cache.ensureFresh(["a"]);
    expect(calls).toBe(1);
    await cache.ensureFresh(["a"]); // fresh -> skipped
    expect(calls).toBe(1);

    const entry = cache.get("a");
    expect(entry).toBeDefined();
    entry!.lastFetch = Date.now() - STALE_AFTER - 1; // backdate past the window
    await cache.ensureFresh(["a"]);
    expect(calls).toBe(2);
    expect(cache.get("a")?.items).toEqual(["2"]);
  });

  test("ensureFresh skips in-flight entries", async () => {
    let calls = 0;
    let resolveFetch: (res: Result<string[]>) => void = () => {};
    const cache = testCache(() => new Promise<Result<string[]>>(resolve => {
      calls += 1;
      resolveFetch = resolve;
    }));
    const first = cache.fetch("a"); // in flight
    await cache.ensureFresh(["a"]);
    expect(calls).toBe(1);
    resolveFetch(ok(["x"]));
    await first;
  });

  test("seed stores items on ok and resets on err", () => {
    const cache = testCache(() => Promise.resolve(ok([])));
    cache.seed("a", ok(["x"]));
    expect(cache.get("a")?.items).toEqual(["x"]);
    expect(cache.get("a")?.loading).toBe(false);
    expect(isStale(cache, "a")).toBe(false);
    cache.seed("a", err("bad"));
    expect(cache.get("a")?.items).toEqual([]);
    expect(cache.get("a")?.lastFetch).toBe(0);
    expect(isStale(cache, "a")).toBe(true);
  });

  test("invalidate drops items and marks the entry in-flight", () => {
    const cache = testCache(() => Promise.resolve(ok(["x"])));
    cache.seed("a", ok(["x"]));
    cache.invalidate("a");
    const entry = cache.get("a");
    expect(entry?.items).toEqual([]);
    expect(entry?.loading).toBe(true);
    expect(entry?.lastFetch).toBe(0);
  });
});
