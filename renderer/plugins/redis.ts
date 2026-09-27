import * as t from "@/types.ts";
import type {Plugin} from "./cache.ts";

export const redisPlugin: Plugin = {
  kind: t.Kind.REDIS,
  kindTag: {text: "REDIS", color: "#e87070"},
};
