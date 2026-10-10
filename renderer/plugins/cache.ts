import {RequestID} from "@/types.ts";
import type {Result} from "@/result.ts";
import {signal} from "../lib/utils.ts";
import notification from "../lib/notification.ts";

// Time after which a cached listing is considered stale.
export const STALE_AFTER = 1000*60*5; // 5 minutes

// Bumped on every cache mutation so subscribers (e.g. tree view) can re-render.
export const changed = signal(0);

export type SourceCacheEntry<T> = {
  lastFetch: number,
  loading?: boolean,
  items: T[],
};

// Methods are declared with shorthand syntax on purpose: it keeps parameter
// checking bivariant, which lets concrete plugins (e.g. SourceCache<TableInfo>)
// sit in one heterogeneous registry typed as SourceCache<unknown>.
export type SourceCache<T> = {
  fetch(id: RequestID): Promise<void>,
  ensureFresh(ids: RequestID[]): Promise<void>,
  invalidate(id: RequestID): void,
  seed(id: RequestID, res: Result<T[]>): void,
  get(id: RequestID): SourceCacheEntry<T> | undefined,
};

export function isStale<T>(cache: SourceCache<T>, id: RequestID): boolean {
  const entry = cache.get(id);
  return entry === undefined || (Date.now() - entry.lastFetch > STALE_AFTER && !(entry.loading ?? false));
}

export function createSourceCache<T>(
  fetcher: (id: RequestID) => Promise<Result<T[]>>,
  errorTitle: string,
): SourceCache<T> {
  const cache: Record<string, SourceCacheEntry<T>> = {};

  const fetch = async (id: RequestID): Promise<void> => {
    if (!(id in cache)) {
      cache[id] = {lastFetch: 0, items: []};
    }
    cache[id].loading = true;
    changed.update(v => v + 1);
    const res = await fetcher(id);
    if (res.kind === "err") {
      notification("error", errorTitle, {error: res.value});
      cache[id].loading = false;
      changed.update(v => v + 1);
      return;
    }
    cache[id] = {lastFetch: Date.now(), loading: false, items: res.value};
    changed.update(v => v + 1);
  };

  const invalidate = (id: RequestID): void => {
    cache[id] = {lastFetch: 0, loading: true, items: []};
    changed.update(v => v + 1);
  };

  const seed = (id: RequestID, res: Result<T[]>): void => {
    cache[id] = res.kind === "ok"
      ? {lastFetch: Date.now(), loading: false, items: res.value}
      : {lastFetch: 0, loading: false, items: []};
    changed.update(v => v + 1);
  };

  const get = (id: RequestID): SourceCacheEntry<T> | undefined => cache[id];

  const self: SourceCache<T> = {
    fetch,
    ensureFresh: async (ids: string[]): Promise<void> => {
      await Promise.all(ids.filter(id => isStale(self, id)).map(id => fetch(id)));
    },
    invalidate,
    seed,
    get,
  };
  return self;
}
