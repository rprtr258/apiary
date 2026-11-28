import * as t from "@/types.ts";
import type {Plugin} from "../types.ts";
import {eyeTabModifier} from "../tab.ts";
import RequestJQ from "./viewer.ts";

export const jqPlugin: Plugin = {
  kind: t.Kind.JQ,
  frame: (args) => RequestJQ(args.el, args.show_request, args.on),
  tabModifiers: [eyeTabModifier],
  viewers: {},
  root: () => ({key: "", label: "", badge: {label: "JQ", color: "var(--type)"}}),
};
