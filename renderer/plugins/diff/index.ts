import * as t from "@/types.ts";
import {Plugin} from "../types.ts";
import {eyeTabModifier} from "../tab.ts";
import RequestDIFF from "./viewer.ts";

export const diffPlugin: Plugin = {
  kind: t.Kind.DIFF,
  frame: (args) => RequestDIFF(args.el, args.show_request, args.on),
  tabModifiers: [eyeTabModifier],
  viewers: {},
  root: () => ({key: "", label: "", badge: {label: "DIFF", color: "var(--green)"}}),
};
