import * as t from "@/types.ts";
import type {Result} from "@/result.ts";
import {api} from "../../api.ts";
import {createSourceCache, listChildren} from "../cache.ts";
import {store} from "../../store.ts";
import type {Item} from "../source.ts";

export const componentType = "ToolViewer";

export type StateMCPItem = {
  sourceID: string,
  itemKey: string,
  item: t.MCPTool | t.MCPPrompt,
};

// One IPC call lists tools and prompts together; the two caches below slice
// the result. The in-flight map dedupes concurrent fetch rounds so both
// caches share a single api.mcpListItems call.
const inflight = new Map<string, Promise<Result<t.MCPListItems>>>();
function listItems(id: t.RequestID): Promise<Result<t.MCPListItems>> {
  const existing = inflight.get(id);
  if (existing !== undefined)
    return existing;
  const promise = api.mcpListItems(id).finally(() => inflight.delete(id));
  inflight.set(id, promise);
  return promise;
}

const toolsCache = createSourceCache<t.MCPTool>(
  async id => (await listItems(id)).map(items => items.tools),
  "Could not fetch tools",
);
const promptsCache = createSourceCache<t.MCPPrompt>(
  async id => (await listItems(id)).map(items => items.prompts),
  "Could not fetch prompts",
);

// Staleness-guarded fetch of both listings (one IPC call when both are stale)
async function fetchBoth(id: t.RequestID): Promise<void> {
  await Promise.all([
    toolsCache.ensureFresh([id]),
    promptsCache.ensureFresh([id]),
  ]);
}

// Seed both listings from a connection-check result (viewer.ts)
export function seedMCP(id: t.RequestID, res: Result<t.MCPListItems>): void {
  toolsCache.seed(id, res.map(items => items.tools));
  promptsCache.seed(id, res.map(items => items.prompts));
}

// Drop both listings (viewer.ts invalidates on connection-param changes)
export function invalidateMCP(id: t.RequestID): void {
  toolsCache.invalidate(id);
  promptsCache.invalidate(id);
}

function toolItem(id: t.RequestID, tool: t.MCPTool): Item {
  return {
    key: tool.name,
    label: tool.name,
    onOpen: () => store.openViewer(tool.name, componentType, {
      sourceID: id,
      // Prefixed so tab dedup (per componentType + itemKey, store.ts) stays
      // unique when a tool and a prompt share a name
      itemKey: `Tools/${tool.name}`,
      item: tool,
    }),
  };
}

function promptItem(id: t.RequestID, prompt: t.MCPPrompt): Item {
  return {
    key: prompt.name,
    label: prompt.name,
    onOpen: () => store.openViewer(prompt.name, componentType, {
      sourceID: id,
      itemKey: `Prompts/${prompt.name}`,
      item: prompt,
    }),
  };
}

function toolsItem(id: t.RequestID): Item {
  return {
    key: "Tools",
    label: "Tools",
    children: () => listChildren(toolsCache, id, tool => toolItem(id, tool)),
    loading: () => toolsCache.get(id)?.loading ?? false,
  };
}

function promptsItem(id: t.RequestID): Item {
  return {
    key: "Prompts",
    label: "Prompts",
    children: () => listChildren(promptsCache, id, prompt => promptItem(id, prompt)),
    loading: () => promptsCache.get(id)?.loading ?? false,
  };
}

// Invisible root: expanding the request row eagerly fetches both listings
// and reveals the Tools/Prompts folders
export function root(id: t.RequestID): Item {
  return {
    key: "",
    label: "",
    badge: {label: "MCP", color: "white"},
    children: () => {
      void fetchBoth(id);
      return [toolsItem(id), promptsItem(id)];
    },
    loading: () => (toolsCache.get(id)?.loading ?? false) || (promptsCache.get(id)?.loading ?? false),
    refresh: () => fetchBoth(id),
  };
}
