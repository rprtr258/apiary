import * as t from "@/types.ts";
import {api} from "../../api.ts";
import {setDisplay} from "../../lib/utils.ts";
import {createSourceCache} from "../cache.ts";
import {Plugin} from "../types.ts";
import {store} from "../../store.ts";
import type {TagType} from "../../components/dataview.ts";
import EndpointViewer from "../../components/EndpointViewer.ts";
import RequestHTTPSource from "./viewer.ts";

const componentType = "EndpointViewer";
type StateHTTPSourceEndpoint = {
  sourceID: string,
  itemKey: string,
  endpointInfo: t.EndpointInfo,
};

type HTTPMethodProps = {
  bg: string,
  color: string,
  type: TagType,
};
const httpMethodPropsUnknown: HTTPMethodProps = {bg: "#3a3a3a", color: "#c0c0c0", type: "info"}; // Grey
const httpMethodPropsMap: Record<string, HTTPMethodProps> = {
  "GET":     {bg: "#1a5f3a", color: "#70e888", type: "success"}, // Green
  "POST":    {bg: "#2a3a5f", color: "#85b4ee", type: "info"},    // Blue
  "PUT":     {bg: "#5f4a1a", color: "#e8c070", type: "warning"}, // Orange/Yellow
  "DELETE":  {bg: "#5f1a1a", color: "#e98a8a", type: "error"},   // Red
  "PATCH":   {bg: "#3a1a5f", color: "#a870e8", type: "warning"}, // Purple
  "HEAD":    {bg: "#1a5f5f", color: "#70e8e8", type: "info"},    // Cyan
  "OPTIONS": {bg: "#5f5f1a", color: "#e8e870", type: "info"},    // Yellow
};
function httpMethodProps(method: string): HTTPMethodProps {
  const upperMethod = method.toUpperCase();
  return httpMethodPropsMap[upperMethod] ?? httpMethodPropsUnknown;
}

function formatEndpointLabel(endpoint: t.EndpointInfo): string {
  const {path} = endpoint;
  // Format: /route/
  // Ensure path starts with / and ends with / if not empty
  const formattedPath = path === "" ? "/" : path.startsWith("/") ? path : `/${path}`;
  const pathWithTrailingSlash = formattedPath.endsWith("/") ? formattedPath : `${formattedPath}/`;
  return pathWithTrailingSlash;
}

export const httpSourcePlugin: Plugin<t.EndpointInfo> = {
  kind: t.Kind.HTTPSource,
  kindTag: {text: "HTTP*", color: "lime"},
  frame: (args) => {
    setDisplay(args.eye, false); // TODO: dont draw eye in the first place?
    return RequestHTTPSource(args.el, {update: args.on.update});
  },
  cache: createSourceCache<t.EndpointInfo>({
    fetcher: (id: string) => api.requestListEndpointsHTTPSource(id),
    errorTitle: "Could not fetch endpoints",
  }),
  itemKey: (endpoint: t.EndpointInfo) => `${endpoint.method} ${endpoint.path}`,
  label: formatEndpointLabel,
  tag: (endpoint: t.EndpointInfo) => {
    const {bg, color, type} = httpMethodProps(endpoint.method);
    return {
      text: endpoint.method,
      type,
      style: {backgroundColor: bg, color},
    };
  },
  viewer: {
    componentType,
    factory: (container, state) => EndpointViewer(container, state as StateHTTPSourceEndpoint),
  },
  onOpen: (id: string, endpoint: t.EndpointInfo, itemKey: string) =>
    store.openViewer(componentType, `${endpoint.method} ${endpoint.path}`,
      {sourceID: id, itemKey, endpointInfo: endpoint}),
};
