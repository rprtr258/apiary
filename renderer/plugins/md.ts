import * as t from "@/types.ts";
import type {Plugin} from "./cache.ts";

export const mdPlugin: Plugin = {
  kind: t.Kind.MD,
  kindTag: {text: "MD", color: "#70a0e8"},
};
