import * as t from "@/types.ts";
import type {Plugin} from "./cache.ts";
import RequestGRPC from "../RequestGRPC.ts";

export const grpcPlugin: Plugin = {
  kind: t.Kind.GRPC,
  kindTag: {text: "GRPC", color: "cyan"},
  frame: (args) => RequestGRPC(args.el, args.show_request, args.on),
};
