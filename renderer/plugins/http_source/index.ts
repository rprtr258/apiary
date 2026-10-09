import * as t from "@/types.ts";
import {Plugin} from "../types.ts";
import {setDisplay} from "../../lib/utils.ts";
import EndpointViewer from "../../components/EndpointViewer.ts";
import RequestHTTPSource from "./viewer.ts";
import {root, componentType, StateHTTPSourceEndpoint} from "./item.ts";

export const httpSourcePlugin: Plugin = {
  kind: t.Kind.HTTPSource,
  frame: args => {
    setDisplay(args.eye, false); // TODO: dont draw eye in the first place?
    return RequestHTTPSource(args.el, {update: args.on.update});
  },
  viewers: {
    [componentType]: (container, state) => EndpointViewer(container, state as StateHTTPSourceEndpoint),
  },
  root,
};
