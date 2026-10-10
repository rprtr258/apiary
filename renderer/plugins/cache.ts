import {RequestID} from "@/types.ts";
import type {Result} from "@/result.ts";
import {signal} from "../lib/utils.ts";
import notification from "../lib/notification.ts";
import type {Item} from "./source.ts";

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
    // Defer the notification out of the caller's frame: fetches are started
    // during tree materialization, which can run inside a changed-signal
    // subscriber generator (sidebar rebuild). A synchronous update here
    // would call .next() on that running generator - a hard JS error - and
    // abort the fetch before the API call, leaving the listing stuck in
    // loading state forever.
    await Promise.resolve();
    changed.update(v => v + 1);
    const res = await fetcher(id);
    if (res.kind === "err")
      notification("error", errorTitle, {error: res.value});
    // Failed listings count as recently attempted: if they stayed stale, every
    // changed-signal re-render of the tree would refire the fetch - an unbounded
    // retry storm. The next attempt happens after STALE_AFTER or via refresh.
    // A failed refresh keeps the previously fetched items (stale-while-error).
    cache[id] = {lastFetch: Date.now(), loading: false, items: res.kind === "ok" ? res.value : cache[id].items};
    changed.update(v => v + 1);
  };

  const invalidate = (id: RequestID): void => {
    cache[id] = {lastFetch: 0, loading: true, items: []};
    changed.update(v => v + 1);
  };

  const seed = (id: RequestID, res: Result<T[]>): void => {
    // Same attempted-now semantics as fetch errors: a seeded error must not
    // look stale, or the next tree materialization refires the fetch.
    cache[id] = {lastFetch: Date.now(), loading: false, items: res.kind === "ok" ? res.value : []};
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

// Children thunk body for listing nodes: serves the current entries as nodes
// and fires a staleness-guarded fetch (fire-and-forget) when the listing is
// missing or stale. Placeholder rendering (Loading.../(None)) is handled by
// the source facade, not here.
export function listChildren<T>(cache: SourceCache<T>, id: string, toNode: (entry: T) => Item): Item[] {
  if (isStale(cache, id))
    void cache.fetch(id);
  return (cache.get(id)?.items ?? []).map(toNode);
}
