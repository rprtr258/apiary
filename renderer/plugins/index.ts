import * as t from "@/types.ts";
import {KindTag, Plugin} from "./types.ts";
import {store} from "../store.ts";
import {isStale} from "./cache.ts";
import {httpPlugin} from "./http/index.ts";
import {httpSourcePlugin} from "./http_source/index.ts";
import {sqlPlugin} from "./sql/index.ts";
import {sqlSourcePlugin} from "./sql_source/index.ts";
import {grpcPlugin} from "./grpc/index.ts";
import {jqPlugin} from "./jq/index.ts";
import {redisPlugin} from "./redis/index.ts";
import {mdPlugin} from "./md/index.ts";
import {diffPlugin} from "./diff/index.ts";
import {mcpPlugin} from "./mcp/index.ts";

// Explicit central registry: one Plugin per request kind.
export const plugins: Plugin[] = [
  httpPlugin,
  httpSourcePlugin,
  sqlPlugin,
  sqlSourcePlugin,
  grpcPlugin,
  jqPlugin,
  redisPlugin,
  mdPlugin,
  diffPlugin,
  mcpPlugin,
];

export const pluginsByKind: Record<t.Kind, Plugin> = Object.fromEntries(
  plugins.map(plugin => [plugin.kind, plugin]),
) as Record<t.Kind, Plugin>;

export function kindTag(kind: t.Kind): KindTag {
  return pluginsByKind[kind].kindTag;
}

// Fetch listings for expanded source requests: filters to real request ids,
// dispatches each id to its kind's plugin cache. Staleness and in-flight
// guards live inside the caches (ensureFresh), so each id is fetched only
// when its listing is missing or older than STALE_AFTER.
export async function ensureFresh(ids: string[]): Promise<void> {
  const jobs = ids.filter(id => id in store.requests).flatMap(id => {
    const cache = pluginsByKind[store.requests[id].kind].cache;
    if (cache === undefined || !isStale(cache, id))
      return [];
    return [[cache, id] as const];
  });
  await Promise.all(jobs.map(([cache, id]) => cache.fetch(id)));
}
