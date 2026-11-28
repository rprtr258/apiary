import * as t from "@/types.ts";
import type {Plugin} from "../types.ts";
import {eyeTabModifier} from "../tab.ts";
import RequestSQL from "./viewer.ts";

export const sqlPlugin: Plugin = {
  kind: t.Kind.SQL,
  frame: (args) => RequestSQL(args.el, args.show_request, args.on),
  tabModifiers: [eyeTabModifier],
  viewers: {},
  root: () => ({key: "", label: "", badge: {label: "SQL", color: "var(--accent)"}}),
};
