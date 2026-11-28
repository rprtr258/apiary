import * as t from "@/types.ts";
import type {Plugin} from "../types.ts";
import EndpointViewer from "../../components/EndpointViewer.ts";
import RequestHTTPSource from "./viewer.ts";
import {root, componentType, StateHTTPSourceEndpoint} from "./item.ts";

export const httpSourcePlugin: Plugin = {
  kind: t.Kind.HTTPSource,
  frame: args => RequestHTTPSource(args.el, {update: args.on.update}),
  viewers: {
    [componentType]: (container, state) => EndpointViewer(container, state as StateHTTPSourceEndpoint),
  },
  root,
};
