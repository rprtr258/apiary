import * as t from "@/types.ts";
import {Plugin} from "../types.ts";
import RequestJQ from "./viewer.ts";

export const jqPlugin: Plugin = {
  kind: t.Kind.JQ,
  frame: (args) => RequestJQ(args.el, args.show_request, args.on),
  viewers: {},
  root: () => ({key: "", label: "", badge: {label: "JQ", color: "violet"}}),
};
