import * as t from "@/types.ts";
import type {Plugin} from "../cache.ts";
import RequestRedis from "./viewer.ts";

export const redisPlugin: Plugin = {
  kind: t.Kind.REDIS,
  kindTag: {text: "REDIS", color: "#e87070"},
  frame: (args) => RequestRedis(args.el, args.show_request, args.on),
};
