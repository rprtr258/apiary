import * as t from "@/types.ts";
import type {Plugin} from "../types.ts";
import ToolViewer from "./tool.ts";
import RequestMCP from "./viewer.ts";
import ResourceViewer, {componentType as resourceComponentType, StateMCPResource} from "./resource.ts";
import {StateMCPItem, componentType, root} from "./item.ts";

export const mcpPlugin: Plugin = {
  kind: t.Kind.MCP,
  frame: args => RequestMCP(args.el, {update: args.on.update}),
  viewers: {
    [componentType]: (container, state) => ToolViewer(container, state as StateMCPItem),
    [resourceComponentType]: (container, state) => ResourceViewer(container, state as StateMCPResource),
  },
  root,
};
