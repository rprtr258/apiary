import * as t from "@/types.ts";
import type {Plugin} from "./cache.ts";

export const grpcPlugin: Plugin = {
  kind: t.Kind.GRPC,
  kindTag: {text: "GRPC", color: "cyan"},
};
