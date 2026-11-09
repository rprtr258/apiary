import * as t from "@/types.ts";
import {ItemBadge} from "../types.ts";
import type {Item} from "../source.ts";
import {createSourceCache, listChildren} from "../cache.ts";
import {api} from "../../api.ts";
import {store} from "../../store.ts";

const httpMethodPropsMap: Record<string, ItemBadge> = {
  "GET":     {label: "GET",     background: "color-mix(in srgb, var(--green) 25%, transparent)", color: "var(--green)"},
  "POST":    {label: "POST",    background: "color-mix(in srgb, var(--accent) 25%, transparent)", color: "var(--accent)"},
  "PUT":     {label: "PUT",     background: "color-mix(in srgb, var(--warn) 25%, transparent)", color: "var(--warn)"},
  "DELETE":  {label: "DELETE",  background: "color-mix(in srgb, var(--err) 25%, transparent)", color: "var(--err)"},
  "PATCH":   {label: "PATCH",   background: "color-mix(in srgb, var(--type) 25%, transparent)", color: "var(--type)"},
  "HEAD":    {label: "HEAD",    background: "color-mix(in srgb, var(--ok) 25%, transparent)", color: "var(--ok)"},
  "OPTIONS": {label: "OPTIONS", background: "color-mix(in srgb, var(--result) 25%, transparent)", color: "var(--result)"},
};
function httpMethodProps(method: string): ItemBadge {
  const upperMethod = method.toUpperCase();
  if (upperMethod in httpMethodPropsMap)
    return httpMethodPropsMap[upperMethod];
  return {label: method, background: "color-mix(in srgb, var(--faint) 25%, transparent)", color: "var(--faint)"};
}

function formatEndpointLabel(endpoint: t.EndpointInfo): string {
  const {path} = endpoint;
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
    badge: {label: "HTTP*", color: "var(--green)"},
    children: () => listChildren(endpointsCache, id, ep => toEndpointNode(id, ep)),
    loading: () => endpointsCache.get(id)?.loading ?? false,
    refresh: () => endpointsCache.fetch(id),
  };
}
