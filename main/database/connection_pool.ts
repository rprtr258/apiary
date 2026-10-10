// Generic connection pool: caches clients keyed by connection configs
// (normalized to strings via `keyOf`), dedupes concurrent connects for the
// same config, and closes clients once they have not been acquired for longer
// than `ttl`. Used by mcp.ts to keep MCP connections alive across requests
// (one handshake per connection config instead of one per call) - the same
// pattern as renderer/plugins/cache.ts, one layer down.
//
// Eviction rules:
// - idle timeout: a sweep (on every acquire and on a timer) drops entries
//   whose `lastUsed` is older than `ttl`, closing their clients;
// - explicit evict(key, client): removes the entry if it still holds that
//   exact client (identity guard, so a stale onclose callback cannot evict a
//   newer connection created under the same key), closing it unless an
//   operation is still running on it (close is deferred until it drains).
export type ClientPool<T, K> = {
  // Acquires a client for `key` (creates one via the constructor's `connect`
  // if none is cached), runs `fn` with it and releases it. On `fn` error the
  // entry is evicted, so a broken connection self-heals on the next call
  // instead of being served forever.
  run<R>(key: K, fn: (client: T) => Promise<R>): Promise<R>,
  evict(key: K, client: T): void,
  sweep(): void,
  size(): number,
};

const DEFAULT_TTL = 1000*60*5;

export function createClientPool<T, K>(opts: {
  // Idle time after which a cached client is closed.
  ttl?: number,
  // Cache key for a connection config: structurally equal configs MUST map to
  // the same string, so equal configs share one client.
  keyOf: (key: K) => string,
  // Creates a client for a config never connected (or freshly evicted).
  connect: (key: K) => Promise<T>,
  // Closes a client whose entry is dropped (idle expiry or eviction).
  close: (client: T) => Promise<void>,
}): ClientPool<T, K> {
  const {keyOf, connect, close} = opts;
  const ttl = opts.ttl ?? DEFAULT_TTL;
  type Entry = {
    client: T,
    busy: number, // operations currently running on the client
    lastUsed: number, // Date.now() of the last acquire
    closing: boolean, // evicted while busy; close as soon as busy drops to 0
  };
  const clients = new Map<string, Entry>();
  const pending = new Map<string, Promise<Entry>>();

  const closeEntry = (entry: Entry): void => {
    // Isolate close failures: an eviction must never surface to callers.
    Promise.resolve().then(() => close(entry.client)).catch(() => {});
  };

  const maybeClose = (entry: Entry): void => {
    if (entry.busy === 0 && entry.closing)
      closeEntry(entry);
  };

  const evict = (key: K, client: T): void => {
    const k = keyOf(key);
    const entry = clients.get(k);
    if (entry === undefined || entry.client !== client)
      return;
    clients.delete(k);
    if (entry.busy === 0)
      closeEntry(entry);
    else
      entry.closing = true;
  };

  const sweep = (): void => {
    const now = Date.now();
    for (const [key, entry] of clients) {
      if (entry.busy > 0 || now - entry.lastUsed <= ttl)
        continue;
      clients.delete(key);
      closeEntry(entry);
    }
  };

  async function run<R>(key: K, fn: (client: T) => Promise<R>): Promise<R> {
    sweep();
    const k = keyOf(key);
    let entry = clients.get(k);
    if (entry === undefined) {
      let connecting = pending.get(k);
      if (connecting === undefined) {
        connecting = (async () => {
          const client = await connect(key);
          const fresh: Entry = {client, busy: 0, lastUsed: Date.now(), closing: false};
          clients.set(k, fresh);
          return fresh;
        })().finally(() => {
          pending.delete(k);
        });
        pending.set(k, connecting);
      }
      // All concurrent first callers of the same key await the same connect
      // promise, so N racing requests share one handshake - and each of them
      // counts itself busy below, so the client is never swept mid-operation.
      entry = await connecting;
    }
    entry.lastUsed = Date.now();
    entry.busy++;
    try {
      return await fn(entry.client);
    } catch (e) {
      evict(key, entry.client);
      throw e;
    } finally {
      entry.busy--;
      maybeClose(entry);
    }
  }

  // Periodic sweep so idle clients are closed even when no new requests come
  // in (e.g. a stdio server subprocess would otherwise linger until app exit).
  // Unref'd so it never keeps the process (or a test run) alive.
  const timer = setInterval(sweep, Math.max(1, Math.round(ttl / 2)));
  (timer as {unref?: () => void}).unref?.();

  return {run, evict, sweep, size: () => clients.size};
}
