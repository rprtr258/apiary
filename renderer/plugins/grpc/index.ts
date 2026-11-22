import * as t from "@/types.ts";
import {Plugin} from "../types.ts";
import {eyeTabModifier} from "../tab.ts";
import RequestGRPC from "./viewer.ts";

export const grpcPlugin: Plugin = {
  kind: t.Kind.GRPC,
  frame: (args) => RequestGRPC(args.el, args.show_request, args.on),
  tabModifiers: [eyeTabModifier],
  viewers: {},
  root: () => ({key: "", label: "", badge: {label: "GRPC", color: "var(--ok)"}}),
};
