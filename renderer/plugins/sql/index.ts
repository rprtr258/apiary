import * as t from "@/types.ts";
import {Plugin} from "../types.ts";
import RequestSQL from "./viewer.ts";

export const sqlPlugin: Plugin = {
  kind: t.Kind.SQL,
  frame: (args) => RequestSQL(args.el, args.show_request, args.on),
  viewers: {},
  root: () => ({key: "", label: "", badge: {label: "SQL", color: "lightblue"}}),
};
