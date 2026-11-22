import * as t from "@/types.ts";
import {Plugin} from "../types.ts";
import {eyeTabModifier} from "../tab.ts";
import RequestRedis from "./viewer.ts";

export const redisPlugin: Plugin = {
  kind: t.Kind.REDIS,
  frame: (args) => RequestRedis(args.el, args.show_request, args.on),
  tabModifiers: [eyeTabModifier],
  viewers: {},
  root: () => ({key: "", label: "", badge: {label: "REDIS", color: "var(--err)"}}),
};
