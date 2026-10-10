// Unit tests for the generic connection pool engine (mcp.ts wires it to MCP
// clients; here it runs over fake clients with counted connect/close).
import {describe, expect, test} from "bun:test";

import {createClientPool, type ClientPool} from "./connection_pool.ts";

type FakeClient = {
  id: number,
  closes: number,
};

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

function setup(ttl: number, connect?: (key: string) => Promise<FakeClient>): {
  pool: ClientPool<FakeClient, string>,
  connects: number[],
  closes: number[],
} {
  const connects: number[] = [];
  const closes: number[] = [];
  const pool = createClientPool<FakeClient, string>({
    ttl,
    keyOf: k => k,
    connect: connect ?? ((): Promise<FakeClient> => {
      const id = connects.length + 1;
      connects.push(id);
      return Promise.resolve({id, closes: 0});
    }),
    close: async client => {
      closes.push(client.id);
    },
  });
  return {
    pool,
    connects,
    closes,
  };
}

describe("createClientPool.run", () => {
  test("reuses the cached client for the same key", async () => {
    const {pool, connects, closes} = setup(1000);
    const first = await pool.run("k", async c => c.id);
    const second = await pool.run("k", async c => c.id);
    expect(first).toBe(1);
    expect(second).toBe(1);
    expect(connects).toEqual([1]);
    expect(closes).toEqual([]);
    expect(pool.size()).toBe(1);
  });

  test("separate keys get separate clients", async () => {
    const {pool, connects} = setup(1000);
    expect(await pool.run("a", async c => c.id)).toBe(1);
    expect(await pool.run("b", async c => c.id)).toBe(2);
    expect(connects).toEqual([1, 2]);
    expect(pool.size()).toBe(2);
  });

  test("concurrent first calls on one key share a single connect", async () => {
    const {pool, connects} = setup(1000);
    const [a, b, c] = await Promise.all([
      pool.run("k", async cl => cl.id),
      pool.run("k", async cl => cl.id),
      pool.run("k", async cl => cl.id),
    ]);
    expect([a, b, c]).toEqual([1, 1, 1]);
    expect(connects).toEqual([1]);
  });

  test("propagates the result of fn", async () => {
    const {pool} = setup(1000);
    const value = await pool.run("k", async c => `client-${c.id}`);
    expect(value).toBe("client-1");
  });

  test("propagates the error of fn", async () => {
    const {pool} = setup(1000);
    expect(pool.run("k", async () => {
      throw new Error("boom");
    })).rejects.toThrow("boom");
  });

  test("evicts the entry after a fn error and reconnects next call", async () => {
    const {pool, connects, closes} = setup(1000);
    expect(pool.run("k", async () => {
      throw new Error("boom");
    })).rejects.toThrow("boom");
    // Entry removed; close fires out-of-band.
    expect(pool.size()).toBe(0);
    await sleep(10);
    expect(closes).toEqual([1]);
    expect(await pool.run("k", async c => c.id)).toBe(2);
    expect(connects).toEqual([1, 2]);
  });

  test("propagates connect failures and does not cache them", async () => {
    let attempts = 0;
    const {pool, connects, closes} = setup(1000, () => {
      attempts++;
      return Promise.reject(new Error("refused"));
    });
    expect(pool.run("k", async c => c.id)).rejects.toThrow("refused");
    expect(pool.run("k", async c => c.id)).rejects.toThrow("refused");
    expect(attempts).toBe(2);
    expect(pool.size()).toBe(0);
    expect(closes).toEqual([]);
    expect(connects).toEqual([]);
  });

  test("concurrent first calls share a connect failure", async () => {
    let attempts = 0;
    const {pool} = setup(1000, () => {
      attempts++;
      return Promise.reject(new Error("refused"));
    });
    const results = await Promise.allSettled([
      pool.run("k", async c => c.id),
      pool.run("k", async c => c.id),
    ]);
    expect(attempts).toBe(1);
    expect(results.every(r => r.status === "rejected")).toBe(true);
  });

  test("structurally equal configs sharing a keyOf hash share a client", async () => {
    const connects: number[] = [];
    const pool = createClientPool<FakeClient, {name: string}>({
      ttl: 1000,
      keyOf: cfg => cfg.name,
      connect: (): Promise<FakeClient> => {
        const id = connects.length + 1;
        connects.push(id);
        return Promise.resolve({id, closes: 0});
      },
      close: async () => {},
    });
    const first = await pool.run({name: "same"}, async c => c.id);
    const second = await pool.run({name: "same"}, async c => c.id); // distinct object, equal hash
    expect(first).toBe(1);
    expect(second).toBe(1);
    expect(connects).toEqual([1]);
    expect(await pool.run({name: "other"}, async c => c.id)).toBe(2);
    expect(connects).toEqual([1, 2]);
  });
});

describe("createClientPool idle expiry", () => {
  test("drops clients idle longer than ttl and reconnects", async () => {
    const {pool, connects, closes} = setup(30);
    expect(await pool.run("k", async c => c.id)).toBe(1);
    await sleep(80);
    expect(await pool.run("k", async c => c.id)).toBe(2);
    expect(connects).toEqual([1, 2]);
    await sleep(10);
    expect(closes).toEqual([1]);
  });

  test("sweep() closes idle clients without waiting for the next request", async () => {
    const {pool, closes} = setup(30);
    await pool.run("k", async c => c.id);
    await sleep(80);
    pool.sweep();
    await sleep(10);
    expect(pool.size()).toBe(0);
    expect(closes).toEqual([1]);
  });

  test("keeps clients fresh within ttl", async () => {
    const {pool, connects, closes} = setup(100);
    await pool.run("k", async c => c.id);
    await sleep(30);
    await pool.run("k", async c => c.id);
    await sleep(30);
    await pool.run("k", async c => c.id);
    expect(connects).toEqual([1]);
    await sleep(10);
    expect(closes).toEqual([]);
    expect(pool.size()).toBe(1);
  });

  test("does not sweep a client while an operation is running on it", async () => {
    const {pool, closes} = setup(20);
    let release: (value?: unknown) => void = () => {};
    const gate = new Promise(resolve => {
      release = resolve;
    });
    const run = pool.run("k", async () => {
      await gate;
      return "done";
    });
    // Operation blocks past ttl; sweep must not close the busy client.
    await sleep(60);
    pool.sweep();
    await sleep(10);
    expect(closes).toEqual([]);
    expect(pool.size()).toBe(1);
    release();
    expect(await run).toBe("done");
    await sleep(60);
    pool.sweep();
    await sleep(10);
    expect(closes).toEqual([1]);
    expect(pool.size()).toBe(0);
  });

  test("does not sweep while ANY concurrent operation is still running on the shared client", async () => {
    // Regression: callers awaiting the shared connect promise used to skip the
    // busy count, so a sweep could close the client once the first op finished
    // while a second one was still running.
    const {pool, closes} = setup(20);
    let releaseA: (value?: unknown) => void = () => {};
    let releaseB: (value?: unknown) => void = () => {};
    const gateA = new Promise(resolve => {
      releaseA = resolve;
    });
    const gateB = new Promise(resolve => {
      releaseB = resolve;
    });
    const runA = pool.run("k", async () => {
      await gateA;
      return "a";
    });
    const runB = pool.run("k", async () => {
      await gateB;
      return "b";
    });
    await sleep(5);
    releaseA();
    expect(await runA).toBe("a");
    // A released, B still in flight and idle past ttl: client must survive.
    await sleep(60);
    pool.sweep();
    await sleep(10);
    expect(closes).toEqual([]);
    releaseB();
    expect(await runB).toBe("b");
    await sleep(60);
    pool.sweep();
    await sleep(10);
    expect(closes).toEqual([1]);
  });
});

describe("createClientPool.evict", () => {
  test("removes and closes the entry when the client matches", async () => {
    const {pool, closes} = setup(1000);
    let cached: FakeClient | undefined;
    await pool.run("k", async c => {
      cached = c;
      return c.id;
    });
    expect(pool.size()).toBe(1);
    pool.evict("k", {id: 99, closes: 0}); // identity guard: wrong client, ignored
    expect(pool.size()).toBe(1);
    pool.evict("k", cached as FakeClient);
    expect(pool.size()).toBe(0);
    await sleep(10);
    expect(closes).toEqual([1]);
  });

  test("defers close until a running operation drains", async () => {
    const {pool, closes} = setup(1000);
    let cached: FakeClient | undefined;
    let release: (value?: unknown) => void = () => {};
    const gate = new Promise(resolve => {
      release = resolve;
    });
    const run = pool.run("k", async c => {
      cached = c;
      await gate;
      return "done";
    });
    await sleep(5);
    pool.evict("k", cached as FakeClient);
    expect(pool.size()).toBe(0);
    // Op still in flight: client must not be closed under it.
    await sleep(10);
    expect(closes).toEqual([]);
    release();
    expect(await run).toBe("done");
    await sleep(10);
    expect(closes).toEqual([1]);
  });

  test("is a no-op for unknown keys", () => {
    const {pool} = setup(1000);
    pool.evict("nope", {id: 1, closes: 0});
    expect(pool.size()).toBe(0);
  });
});
