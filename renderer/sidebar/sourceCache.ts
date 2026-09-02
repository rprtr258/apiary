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
const toolCache: Record<string, E & {
  tools: t.MCPTool[],
}> = {};

const STALE_AFTER = 1000*60*5; // 5 minutes

function isStale(cache: Record<string, E>, key: string): boolean {
  if (!(key in cache))
    return true;
  const entry = cache[key];
  return Date.now() - entry.lastFetch > STALE_AFTER && entry.loading !== true;
}

function staleSourceKeys(keys: string[]): {sql: string[], http: string[], mcp: string[]} {
  const sql: string[] = [];
  const http: string[] = [];
  const mcp: string[] = [];
  for (const key of keys.filter(key => key in store.requests)) {
    const kind = store.requests[key].kind;
    if (kind === t.Kind.SQLSource && isStale(tableCache, key)) {
      sql.push(key);
    } else if (kind === t.Kind.HTTPSource && isStale(endpointCache, key)) {
      http.push(key);
    } else if (kind === t.Kind.MCP && isStale(toolCache, key)) {
      mcp.push(key);
    }
  }
  return {sql, http, mcp};
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

export const fetchTools = (mcpID: string): Promise<void> =>
  fetchCached(
    toolCache,
    mcpID,
    () => ({tools: []}),
    (id: string) => api.mcpListTools(id).then(r => r.map(tools => ({tools}))),
    "Could not fetch tools",
  );

// Mark cached tools stale and show loading state so the sidebar drops stale tools
// immediately while a refetch is in flight.
export function invalidateTools(mcpID: string): void {
  toolCache[mcpID] = {lastFetch: 0, loading: true, tools: []};
  sourceCacheChanged.update(v => v + 1);
}

// Populate cached tools from an already-fetched result (avoids a second backend
// call when the caller fetches for its own purposes, e.g. the MCP status label).
export function setTools(mcpID: string, res: Result<t.MCPTool[]>): void {
  toolCache[mcpID] = res.kind === "ok"
    ? {lastFetch: Date.now(), loading: false, tools: res.value}
    : {lastFetch: 0, loading: false, tools: []};
  sourceCacheChanged.update(v => v + 1);
}

export async function fetchSources(keys: string[]): Promise<void> {
  const {sql, http, mcp} = staleSourceKeys(keys);
  await Promise.all([
    ...sql.map(fetchTables),
    ...http.map(fetchEndpoints),
    ...mcp.map(fetchTools),
  ]);
}

export {tableCache, endpointCache, toolCache};
