import * as t from "@/types.ts";
import type {Plugin} from "../types.ts";
import {eyeTabModifier} from "../tab.ts";
import RequestMD from "./viewer.ts";

export const mdPlugin: Plugin = {
  kind: t.Kind.MD,
  frame: (args) => RequestMD(args.el, args.show_request, args.on),
  tabModifiers: [eyeTabModifier],
  viewers: {},
  root: () => ({key: "", label: "", badge: {label: "MD", color: "var(--accent)"}}),
};
