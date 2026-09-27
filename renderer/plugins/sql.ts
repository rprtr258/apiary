import * as t from "@/types.ts";
import type {Plugin} from "./cache.ts";

export const sqlPlugin: Plugin = {
  kind: t.Kind.SQL,
  kindTag: {text: "SQL", color: "lightblue"},
};
