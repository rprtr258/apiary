import * as t from "@/types.ts";
import {api} from "../../api.ts";
import {setDisplay} from "../../lib/utils.ts";
import {createSourceCache, type Plugin} from "../cache.ts";
import {store} from "../../store.ts";
import ToolViewer from "./tool.ts";
import RequestMCP from "./viewer.ts";

const componentType = "ToolViewer";
export type StateMCPTool = {
  sourceID: string,
  itemKey: string,
  tool: t.MCPTool,
};

export const mcpPlugin: Plugin<t.MCPTool> = {
  kind: t.Kind.MCP,
  kindTag: {text: "MCP", color: "white"},
  frame: (args) => {
    setDisplay(args.eye, false); // TODO: dont draw eye in the first place?
    return RequestMCP(args.el, {update: args.on.update});
  },
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
  viewer: {
    componentType,
    factory: (container, state) => ToolViewer(container, state as StateMCPTool),
  },
  onOpen: (id: string, tool: t.MCPTool, itemKey: string) =>
    store.openViewer(componentType, tool.name, {sourceID: id, itemKey, tool}),
};
