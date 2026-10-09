import * as t from "@/types.ts";
import {Plugin} from "./types.ts";
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
