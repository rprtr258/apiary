import * as t from "@/types.ts";
import type {Plugin} from "./cache.ts";

export const jqPlugin: Plugin = {
  kind: t.Kind.JQ,
  kindTag: {text: "JQ", color: "violet"},
};
