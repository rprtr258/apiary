import * as t from "@/types.ts";
import {setDisplay} from "../../lib/utils.ts";
import {Plugin} from "../types.ts";
import ToolViewer from "./tool.ts";
import RequestMCP from "./viewer.ts";
import {StateMCPItem, componentType, root} from "./item.ts";

export const mcpPlugin: Plugin = {
  kind: t.Kind.MCP,
  frame: args => {
    setDisplay(args.eye, false); // TODO: dont draw eye in the first place?
    return RequestMCP(args.el, {update: args.on.update});
  },
  viewers: {
    [componentType]: (container, state) => ToolViewer(container, state as StateMCPItem),
  },
  root,
};
