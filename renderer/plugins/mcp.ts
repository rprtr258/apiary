import * as t from "@/types.ts";
import {api} from "../api.ts";
import {createSourceCache, type Plugin} from "./cache.ts";
import {store} from "../store.ts";

export const mcpPlugin: Plugin<t.MCPTool> = {
  kind: t.Kind.MCP,
  kindTag: {text: "MCP", color: "white"},
  cache: createSourceCache<t.MCPTool>({
    fetcher: (id: string) => api.mcpListTools(id),
    errorTitle: "Could not fetch tools",
  }),
  itemKey: (tool: t.MCPTool) => tool.name,
  label: (tool: t.MCPTool) => tool.name,
  tag: () => ({
    text: "TOOL",
    type: "info",
    style: {backgroundColor: "#000000", color: "#FFFFFF"},
  }),
  onOpen: (id: string, tool: t.MCPTool) =>
    store.openToolViewer(id, tool),
};
