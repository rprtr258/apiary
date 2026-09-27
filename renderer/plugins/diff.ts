import * as t from "@/types.ts";
import type {Plugin} from "./cache.ts";

export const diffPlugin: Plugin = {
  kind: t.Kind.DIFF,
  kindTag: {text: "DIFF", color: "#70e888"},
};
