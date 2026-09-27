import * as t from "@/types.ts";
import type {Plugin} from "./cache.ts";
import RequestSQL from "../RequestSQL.ts";

export const sqlPlugin: Plugin = {
  kind: t.Kind.SQL,
  kindTag: {text: "SQL", color: "lightblue"},
  frame: (args) => RequestSQL(args.el, args.show_request, args.on),
};
