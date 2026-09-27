import * as t from "@/types.ts";
import type {Plugin} from "../cache.ts";
import RequestDIFF from "./viewer.ts";

export const diffPlugin: Plugin = {
  kind: t.Kind.DIFF,
  kindTag: {text: "DIFF", color: "#70e888"},
  frame: (args) => RequestDIFF(args.el, args.show_request, args.on),
};
