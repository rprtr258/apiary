import * as t from "@/types.ts";
import type {Result} from "@/result.ts";
import {api} from "../../api.ts";
import {createSourceCache, listChildren} from "../cache.ts";
import {store} from "../../store.ts";
import type {Item} from "../source.ts";
import {componentType as resourceComponentType} from "./resource.ts";

export const componentType = "ToolViewer";

export type StateMCPItem = {
  sourceID: string,
  itemKey: string,
  item: t.MCPTool | t.MCPPrompt,
};

// One IPC call lists tools, prompts and resources together; the three caches
// below slice the result. The in-flight map dedupes concurrent fetch rounds
// so all caches share a single api.mcpListItems call.
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
const resourcesCache = createSourceCache<t.MCPResource>(
  async id => (await listItems(id)).map(items => items.resources),
  "Could not fetch resources",
);

// Staleness-guarded fetch of all listings (one IPC call when any is stale)
async function fetchAll(id: t.RequestID): Promise<void> {
  await Promise.all([
    toolsCache.ensureFresh([id]),
    promptsCache.ensureFresh([id]),
    resourcesCache.ensureFresh([id]),
  ]);
}

// Seed all listings from a connection-check result (viewer.ts)
export function seedMCP(id: t.RequestID, res: Result<t.MCPListItems>): void {
  toolsCache.seed(id, res.map(items => items.tools));
  promptsCache.seed(id, res.map(items => items.prompts));
  resourcesCache.seed(id, res.map(items => items.resources));
}

// Drop all listings (viewer.ts invalidates on connection-param changes)
export function invalidateMCP(id: t.RequestID): void {
  toolsCache.invalidate(id);
  promptsCache.invalidate(id);
  resourcesCache.invalidate(id);
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

function resourceItem(id: t.RequestID, resource: t.MCPResource): Item {
  // Keyed by name like tools/prompts; the uri is the viewer itemKey identity.
  // Falls back to the uri for resources without a name
  const title = resource.name !== "" ? resource.name : resource.uri;
  return {
    key: title,
    label: title,
    onOpen: () => store.openViewer(title, resourceComponentType, {
      sourceID: id,
      // URIs are unique per server, so this stays distinct per resource
      itemKey: `Resources/${resource.uri}`,
      resource,
    }),
  };
}

function resourcesItem(id: t.RequestID): Item {
  return {
    key: "Resources",
    label: "Resources",
    children: () => listChildren(resourcesCache, id, resource => resourceItem(id, resource)),
    loading: () => resourcesCache.get(id)?.loading ?? false,
  };
}

// Invisible root: expanding the request row eagerly fetches all listings
// and reveals the Tools/Prompts/Resources folders
export function root(id: t.RequestID): Item {
  return {
    key: "",
    label: "",
    badge: {label: "MCP", color: "white"},
    children: () => {
      void fetchAll(id);
      return [toolsItem(id), promptsItem(id), resourcesItem(id)];
    },
    loading: () => (toolsCache.get(id)?.loading ?? false) || (promptsCache.get(id)?.loading ?? false) || (resourcesCache.get(id)?.loading ?? false),
    refresh: () => fetchAll(id),
  };
}
