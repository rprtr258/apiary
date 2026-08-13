import * as t from "@/types.ts";
import type {Result} from "@/result.ts";
import {signal} from "../lib/utils.ts";
import {api} from "../api.ts";
import {store} from "../store.ts";
import notification from "../lib/notification.ts";

type E = {lastFetch: number, loading?: boolean};

const tableCache: Record<string, E & {
  tables: Record<string, t.TableInfo>,
}> = {};
const endpointCache: Record<string, E & {
  endpoints: t.EndpointInfo[],
}> = {};

const STALE_AFTER = 1000*60*5; // 5 minutes

function isStale(cache: Record<string, E>, key: string): boolean {
  if (!(key in cache))
    return true;
  const entry = cache[key];
  return Date.now() - entry.lastFetch > STALE_AFTER && entry.loading !== true;
}

function staleSourceKeys(keys: string[]): {sql: string[], http: string[]} {
  const sql: string[] = [];
  const http: string[] = [];
  for (const key of keys.filter(key => key in store.requests)) {
    const kind = store.requests[key].kind;
    if (kind === t.Kind.SQLSource && isStale(tableCache, key)) {
      sql.push(key);
    } else if (kind === t.Kind.HTTPSource && isStale(endpointCache, key)) {
      http.push(key);
    }
  }
  return {sql, http};
}

// Bumped on every cache mutation so subscribers (e.g. tree view) can re-render.
export const sourceCacheChanged = signal(0);

async function fetchCached<V>(
  cache: Record<string, E & V>,
  key: string,
  init: () => V,
  fetch: (key: string) => Promise<Result<V>>,
  errorTitle: string,
): Promise<void> {
  if (!(key in cache)) {
    cache[key] = {
      lastFetch: 0,
      ...init(),
    };
  }
  cache[key].loading = true;
  sourceCacheChanged.update(v => v + 1);
  const res = await fetch(key);
  if (res.kind === "err") {
    notification.error({title: errorTitle, error: res.value});
    cache[key].loading = false;
    sourceCacheChanged.update(v => v + 1);
    return;
  }
  cache[key] = {
    lastFetch: Date.now(),
    loading: false,
    ...res.value,
  };
  sourceCacheChanged.update(v => v + 1);
}

export const fetchTables = (sqlSourceID: string): Promise<void> =>
  fetchCached(
    tableCache,
    sqlSourceID,
    () => ({tables: {}}),
    (id: string) => api.requestListTablesSQLSource(id).then(r => r.map(tables => ({tables: Object.fromEntries(tables.map(table => [table.name, table]))}))),
    "Could not fetch tables",
  );

export const fetchEndpoints = (httpSourceID: string): Promise<void> =>
  fetchCached(
    endpointCache,
    httpSourceID,
    () => ({endpoints: []}),
    (id: string) => api.requestListEndpointsHTTPSource(id).then(r => r.map(endpoints => ({endpoints}))),
    "Could not fetch endpoints",
  );

export async function fetchSources(keys: string[]): Promise<void> {
  const {sql, http} = staleSourceKeys(keys);
  await Promise.all([
    ...sql.map(fetchTables),
    ...http.map(fetchEndpoints),
  ]);
}

export {tableCache, endpointCache};
