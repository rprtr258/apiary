import * as t from "@/types.ts";
import {ItemBadge} from "../types.ts";
import type {Item} from "../source.ts";
import {createSourceCache, listChildren} from "../cache.ts";
import {api} from "../../api.ts";
import {store} from "../../store.ts";

const httpMethodPropsMap: Record<string, ItemBadge> = {
  "GET":     {label: "GET",     background: "var(--color-green-light)", color: "var(--color-green-4)"},
  "POST":    {label: "POST",    background: "var(--color-blue-light)", color: "var(--color-blue-4)"},
  "PUT":     {label: "PUT",     background: "var(--color-yellow-light)", color: "var(--color-yellow-4)"},
  "DELETE":  {label: "DELETE",  background: "var(--color-red-light)", color: "var(--color-red-3)"},
  "PATCH":   {label: "PATCH",   background: "var(--color-violet-light)", color: "var(--color-violet-3)"},
  "HEAD":    {label: "HEAD",    background: "var(--color-cyan-light)", color: "var(--color-cyan-4)"},
  "OPTIONS": {label: "OPTIONS", background: "var(--color-lime-light)", color: "var(--color-lime-4)"},
};
function httpMethodProps(method: string): ItemBadge {
  const upperMethod = method.toUpperCase();
  if (upperMethod in httpMethodPropsMap)
    return httpMethodPropsMap[upperMethod];
  return {label: method, background: "var(--color-default)", color: "var(--color-bright)"};
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
    badge: {label: "HTTP*", color: "var(--color-lime-4)"},
    children: () => listChildren(endpointsCache, id, ep => toEndpointNode(id, ep)),
    loading: () => endpointsCache.get(id)?.loading ?? false,
    refresh: () => endpointsCache.fetch(id),
  };
}
