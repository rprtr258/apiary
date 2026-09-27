import * as t from "@/types.ts";
import {Plugin} from "../types.ts";
import RequestMD from "./viewer.ts";

export const mdPlugin: Plugin = {
  kind: t.Kind.MD,
  kindTag: {text: "MD", color: "#70a0e8"},
  frame: (args) => RequestMD(args.el, args.show_request, args.on),
};
