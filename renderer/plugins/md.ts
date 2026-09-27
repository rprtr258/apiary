import * as t from "@/types.ts";
import type {Plugin} from "./cache.ts";
import RequestMD from "../RequestMD.ts";

export const mdPlugin: Plugin = {
  kind: t.Kind.MD,
  kindTag: {text: "MD", color: "#70a0e8"},
  frame: (args) => RequestMD(args.el, args.show_request, args.on),
};
