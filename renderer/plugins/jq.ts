import * as t from "@/types.ts";
import type {Plugin} from "./cache.ts";
import RequestJQ from "../RequestJQ.ts";

export const jqPlugin: Plugin = {
  kind: t.Kind.JQ,
  kindTag: {text: "JQ", color: "violet"},
  frame: (args) => RequestJQ(args.el, args.show_request, args.on),
};
