import * as t from "@/types.ts";
import {Plugin} from "../types.ts";
import RequestJQ from "./viewer.ts";

export const jqPlugin: Plugin = {
  kind: t.Kind.JQ,
  kindTag: {text: "JQ", color: "violet"},
  frame: (args) => RequestJQ(args.el, args.show_request, args.on),
};
