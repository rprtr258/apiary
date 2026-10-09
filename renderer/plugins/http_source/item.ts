import * as t from "@/types.ts";
import {ItemBadge} from "../types.ts";
import type {Item} from "../source.ts";
import {createSourceCache, listChildren} from "../cache.ts";
import {api} from "../../api.ts";
import {store} from "../../store.ts";

const httpMethodPropsMap: Record<string, ItemBadge> = {
  "GET":     {label: "GET",     background: "#1a5f3a", color: "#70e888"}, // Green
  "POST":    {label: "POST",    background: "#2a3a5f", color: "#85b4ee"},    // Blue
  "PUT":     {label: "PUT",     background: "#5f4a1a", color: "#e8c070"}, // Orange/Yellow
  "DELETE":  {label: "DELETE",  background: "#5f1a1a", color: "#e98a8a"},   // Red
  "PATCH":   {label: "PATCH",   background: "#3a1a5f", color: "#a870e8"}, // Purple
  "HEAD":    {label: "HEAD",    background: "#1a5f5f", color: "#70e8e8"},    // Cyan
  "OPTIONS": {label: "OPTIONS", background: "#5f5f1a", color: "#e8e870"},    // Yellow
};
function httpMethodProps(method: string): ItemBadge {
  const upperMethod = method.toUpperCase();
  if (upperMethod in httpMethodPropsMap)
    return httpMethodPropsMap[upperMethod];
  return {label: method, background: "#3a3a3a", color: "#c0c0c0"}; // Grey
}

function formatEndpointLabel(endpoint: t.EndpointInfo): string {
  const {path} = endpoint;
  // Format: /route/
  // Ensure path starts with / and ends with / if not empty
  const formattedPath = path === "" ? "/" : path.startsWith("/") ? path : `/${path}`;
  const pathWithTrailingSlash = formattedPath.endsWith("/") ? formattedPath : `${formattedPath}/`;
  return pathWithTrailingSlash;
}

const endpointsCache = createSourceCache<t.EndpointInfo>(
  id => api.requestListEndpointsHTTPSource(id),
  "Could not fetch endpoints",
);

// Item keys keep the full "<method> <path>" form: their "/"-nesting produces
// the endpoint folder tree in the sidebar ("GET " > "users" > ":id")
function endpointKey(endpoint: t.EndpointInfo): string{
  return `${endpoint.method} ${endpoint.path}`;
}

export const componentType = "EndpointViewer";
export type StateHTTPSourceEndpoint = {
  sourceID: string,
  itemKey: string,
  endpointInfo: t.EndpointInfo,
};

function toEndpointNode(id: t.RequestID, endpoint: t.EndpointInfo): Item {
  const key = endpointKey(endpoint);
  return {
    key,
    label: formatEndpointLabel(endpoint),
    badge: httpMethodProps(endpoint.method),
    onOpen: () => store.openViewer(key, componentType, {
      sourceID: id,
      itemKey: key,
      endpointInfo: endpoint,
    }),
  };
};

export function root(id: t.RequestID): Item {
  return {
    key: "",
    label: "",
    badge: {label: "HTTP*", color: "lime"},
    children: () => listChildren(endpointsCache, id, ep => toEndpointNode(id, ep)),
    loading: () => endpointsCache.get(id)?.loading ?? false,
    refresh: () => endpointsCache.fetch(id),
  };
}
