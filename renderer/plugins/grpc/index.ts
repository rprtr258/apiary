import * as t from "@/types.ts";
import {Plugin} from "../types.ts";
import RequestGRPC from "./viewer.ts";

export const grpcPlugin: Plugin = {
  kind: t.Kind.GRPC,
  kindTag: {text: "GRPC", color: "cyan"},
  frame: (args) => RequestGRPC(args.el, args.show_request, args.on),
};
