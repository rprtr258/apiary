import * as t from "@/types.ts";
import {store} from "../store.ts";
import {isStale, type KindTag, type Plugin} from "./cache.ts";
import {httpPlugin} from "./http.ts";
import {httpSourcePlugin} from "./httpSource.ts";
import {sqlPlugin} from "./sql.ts";
import {sqlSourcePlugin} from "./sqlSource.ts";
import {grpcPlugin} from "./grpc.ts";
import {jqPlugin} from "./jq.ts";
import {redisPlugin} from "./redis.ts";
import {mdPlugin} from "./md.ts";
import {diffPlugin} from "./diff.ts";
import {mcpPlugin} from "./mcp.ts";

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
