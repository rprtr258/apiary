import * as t from "@/types.ts";
import {api} from "../../api.ts";
import {setDisplay} from "../../lib/utils.ts";
import {createSourceCache} from "../cache.ts";
import {Plugin} from "../types.ts";
import {store} from "../../store.ts";
import ToolViewer from "./tool.ts";
import RequestMCP from "./viewer.ts";

const componentType = "ToolViewer";
export type StateMCPItem = {
  sourceID: string,
  itemKey: string,
  item: t.MCPTool | t.MCPPrompt,
};

const cache = createSourceCache<t.MCPTool | t.MCPPrompt>(
  async id => (await api.mcpListItems(id)).map(items => [
    ...items.tools,
    ...items.prompts,
  ]),
  "Could not fetch tools and prompts",
);

export const mcpPlugin: Plugin<t.MCPTool | t.MCPPrompt> = {
  kind: t.Kind.MCP,
  kindTag: {text: "MCP", color: "white"},
  frame: args => {
    setDisplay(args.eye, false); // TODO: dont draw eye in the first place?
    return RequestMCP(args.el, {update: args.on.update});
  },
  cache,
  itemKey: item => `${item.kind === "prompt" ? "Prompts" : "Tools"}/${item.name}`,
  label: item => item.name,
  viewers: {
    [componentType]: (container, state) => ToolViewer(container, state as StateMCPItem),
  },
  onOpen: (id, item, itemKey) =>
    store.openViewer(item.name, componentType, {sourceID: id, itemKey, item}),
};
