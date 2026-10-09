import * as t from "@/types.ts";
import {Plugin} from "../types.ts";
import RequestRedis from "./viewer.ts";

export const redisPlugin: Plugin = {
  kind: t.Kind.REDIS,
  frame: (args) => RequestRedis(args.el, args.show_request, args.on),
  viewers: {},
  root: () => ({key: "", label: "", badge: {label: "REDIS", color: "#e87070"}}),
};
