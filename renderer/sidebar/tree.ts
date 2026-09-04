import * as t from "@/types.ts";
import {none, Option, some} from "@/option.ts";
import {NTag, NTree, TagType, TreeOption, treeLabelClass} from "../components/dataview.ts";
import {NScrollbar} from "../components/layout.ts";
import {store} from "../store.ts";
import {DOMNode, formatSize, m, signal} from "../lib/utils.ts";
import {useLocalStorage} from "../lib/localStorage.ts";
import {css} from "../lib/styles.ts";
import {endpointCache, fetchSources, sourceCacheChanged, tableCache, toolCache} from "./sourceCache.ts";
import {showContextMenu} from "./contextMenu.ts";
import {badge} from "./shared.ts";

function basename(id: string): string {
  return id.split("/").pop() ?? "";
}

function dirname(id: string): string {
  return id.split("/").slice(0, -1).join("/");
}

function formatTableLabel(args: {
  name: string,
  rowCount: number,
  sizeBytes: number,
}): string {
  const {name, rowCount: rows, sizeBytes: bytes} = args;
  return `${name} (${rows.toLocaleString()} rows, ${formatSize(bytes)})`;
}

function formatEndpointLabel(endpoint: t.EndpointInfo): string {
  const {path} = endpoint;
  // Format: /route/
  // Ensure path starts with / and ends with / if not empty
  const formattedPath = path === "" ? "/" : path.startsWith("/") ? path : `/${path}`;
  const pathWithTrailingSlash = formattedPath.endsWith("/") ? formattedPath : `${formattedPath}/`;
  return pathWithTrailingSlash;
}

type VirtualKey = {
  sourceID: string,
  name: string,
  kind: "table" | "endpoint" | "tool" | "loading" | "empty",
};

function parseVirtualKey(key: string): Option<VirtualKey> {
  const parts = key.split(":");
  if (parts.length !== 4)
    return none;
  const [, kind, sourceID, name] = parts;
  if (!((kind): kind is VirtualKey["kind"] => ["table", "endpoint", "tool", "loading", "empty"].includes(kind))(kind))
    return none;
  return some({sourceID, name, kind});
}

const expandedKeys = useLocalStorage<string[]>("expanded-keys", []);
const expandedKeysSignal = signal(expandedKeys.value);
expandedKeysSignal.sub(function*() {
  while (true) {
    const keys = yield;
    expandedKeys.value = keys;
  }
}());

function drag({node, dragNode, dropPosition}: {
  node: TreeOption,
  dragNode: TreeOption,
  dropPosition: "before" | "inside" | "after",
}): void  {
  const dir = (d: string): string => d === "" ? "" : d + "/";
  const oldID = dragNode.key;
  const into = node.key;
  switch (dropPosition) {
    case "before":
    case "after":
      store.rename(oldID, dir(dirname(into)) + basename(oldID));
      break;
    case "inside":
      store.rename(oldID, dir(into) + basename(oldID));
      break;
  }
}

type HTTPMethodProps = {
  bg: string,
  color: string,
  tagType: TagType,
};
const httpMethodPropsUnknown: HTTPMethodProps = {bg: "#3a3a3a", color: "#c0c0c0", tagType: "info"}; // Grey
const httpMethodPropsMap: Record<string, HTTPMethodProps> = {
  "GET":     {bg: "#1a5f3a", color: "#70e888", tagType: "success"}, // Green
  "POST":    {bg: "#2a3a5f", color: "#70a0e8", tagType: "info"},    // Blue
  "PUT":     {bg: "#5f4a1a", color: "#e8c070", tagType: "warning"}, // Orange/Yellow
  "DELETE":  {bg: "#5f1a1a", color: "#e87070", tagType: "error"},   // Red
  "PATCH":   {bg: "#3a1a5f", color: "#a870e8", tagType: "warning"}, // Purple
  "HEAD":    {bg: "#1a5f5f", color: "#70e8e8", tagType: "info"},    // Cyan
  "OPTIONS": {bg: "#5f5f1a", color: "#e8e870", tagType: "info"},    // Yellow
};
function httpMethodProps(method: string): HTTPMethodProps {
  const upperMethod = method.toUpperCase();
  return httpMethodPropsMap[upperMethod] ?? httpMethodPropsUnknown;
}

// pulse keyframes + class for loading state
const pulseClass = css.raw(` {
  animation: pulse 1.5s infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}`);

export function createTreeView(): {el: HTMLElement} {
  const treeContainer = m("div", {style: {minHeight: "0"}});

  function updateTree() {
    const requestsTree = store.requestsTree.value;
    // Save scroll position before update
    const scrollContainer = treeContainer.querySelector(".n-scrollbar-container");
    const scrollTop = scrollContainer?.scrollTop ?? 0;

    const data = (() => {
      const mapper = (tree: t.Tree): TreeOption[] => [
        ...Object.entries(tree.Dirs).map(([k, v]): TreeOption => ({
          key: k,
          label: basename(k),
          children: mapper(v),
        })),
        ...tree.IDs.map(id => {
            const req = store.requests[id];
            const children: TreeOption[] | undefined = (() => {
              switch (true) {
              case req.kind === t.Kind.SQLSource:
                if (id in tableCache && Object.keys(tableCache[id].tables).length > 0) {
                  return Object.values(tableCache[id].tables).map(table => ({
                    key: `virtual:table:${id}:${table.name}`,
                    label: formatTableLabel(table),
                  }));
                } else {
                  // Show "Loading..." or "(None)" based on loading state
                  // Check if cache exists AND is loading
                  const isLoading = id in tableCache && (tableCache[id].loading ?? false);
                  return [{
                    key: `virtual:${isLoading ? "loading" : "empty"}:${id}:table`,
                    label: isLoading ? "Loading..." : "(None)",
                    disabled: true,
                  }];
                }
              case req.kind === t.Kind.HTTPSource:
                if (id in endpointCache && endpointCache[id].endpoints.length > 0) {
                  return endpointCache[id].endpoints.map((endpoint, index) => ({
                    key: `virtual:endpoint:${id}:${index}`,
                    label: formatEndpointLabel(endpoint),
                  }));
                } else {
                  // Show "Loading..." or "(None)" based on loading state
                  const isLoading = id in endpointCache && (endpointCache[id].loading ?? false);
                  return [{
                    key: `virtual:${isLoading ? "loading" : "empty"}:${id}:endpoint`,
                    label: isLoading ? "Loading..." : "(None)",
                    disabled: true,
                  }];
                }
              case req.kind === t.Kind.MCP:
                if (id in toolCache && toolCache[id].tools.length > 0) {
                  return toolCache[id].tools.map(tool => ({
                    key: `virtual:tool:${id}:${tool.name}`,
                    label: tool.name,
                  }));
                } else {
                  const isLoading = id in toolCache && (toolCache[id].loading ?? false);
                  return [{
                    key: `virtual:${isLoading ? "loading" : "empty"}:${id}:tool`,
                    label: isLoading ? "Loading..." : "(None)",
                    disabled: true,
                  }];
                }
              default:
                return undefined;
              }
            })();

            return {
              key: id,
              label: store.requests[id].name,
              ...(children !== undefined ? {children} : {}), // Only set children for SQLSource/HTTPSource
            };
        }),
      ];
      return mapper(requestsTree);
    })();

    treeContainer.replaceChildren(NScrollbar(
      NTree({
        defaultExpandedKeys: expandedKeysSignal.value,
        data,
        on: {
          "update:expanded-keys": async (keys: string[]) => {
            const oldKeys = expandedKeysSignal.value;
            expandedKeysSignal.update(() => keys);

            // Fetch data for sources that were just expanded (staleness/loading guarded inside fetchSources)
            await fetchSources(keys.filter(key => !oldKeys.includes(key)));
          },
          drop: drag,
          context_menu: (option: TreeOption, event: MouseEvent) => {
            showContextMenu(option.key, event);
          },
          click: (v: TreeOption) => {
            const id = v.key;

            // Skip disabled items like "(None)" and "loading" items
            if (v.disabled ?? false) return;

            const virtual = parseVirtualKey(id);
            if (virtual.isSome()) {
              const {kind, sourceID, name} = virtual.value;
              switch (kind) {
              // Skip "loading" and "empty" virtual items
              case "loading":
              case "empty":
                return;
              case "table":
                if (!(sourceID in tableCache) || !(name in tableCache[sourceID].tables))
                  return;
                const tableInfo = tableCache[sourceID].tables[name];
                store.openTableViewer(sourceID, name, tableInfo);
                break;
              case "endpoint": {
                const endpointIndex = parseInt(name, 10);
                if (!(sourceID in endpointCache) || endpointIndex >= endpointCache[sourceID].endpoints.length)
                  return;

                // Open virtual endpoint viewer (not real HTTP request)
                const endpoint = endpointCache[sourceID].endpoints[endpointIndex];
                store.openEndpointViewer(sourceID, endpointIndex, endpoint);
                break;
              }
              case "tool": {
                if (!(sourceID in toolCache))
                  return;
                const tool = toolCache[sourceID].tools.find(tl => tl.name === name);
                if (tool === undefined)
                  return;
                store.openToolViewer(sourceID, tool);
                break;
              }
              }
            } else {
              store.selectRequest(id);
            }
          },
        },
        render: (option: TreeOption, _level: number, _expanded: boolean): DOMNode => {
          const virtual = parseVirtualKey(option.key);
          if (virtual.isSome()) {
            const {kind, sourceID, name} = virtual.value;
            switch (kind) {
            case "empty":
                // "(None)" item - simple text, disabled, no badge, no hover effects
                return m("span", {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    opacity: "0.6",
                    color: "#808080",
                    fontStyle: "italic",
                    pointerEvents: "none", // TODO: move into parent element
                  },
                }, "(None)");
              case "loading":
                // "Loading..." item - not disabled, shows loading state
                return m("span", {
                  class: pulseClass,
                  style: {
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    color: "#a0a0a0",
                    fontStyle: "italic",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    overflow: "clip",
                  },
                  title: "Loading...",
                }, "Loading...");
              case "table": // Virtual table item
                return m("span", {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    width: "100%",
                  },
                },
                NTag({
                  type: "info",
                  style: {
                    minWidth: "2em",
                    justifyContent: "center",
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "#1a3a5f",
                    color: "#70c0e8",
                    fontWeight: "bold",
                    padding: "2px 4px",
                  },
                }, "TBL"),
                m("span", {
                  style: {
                    flex: "1",
                    minWidth: "0",
                    color: "#e0e0e0",
                    overflow: "clip",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  },
                  title: option.label,
                }, option.label));
              case "endpoint": { // Virtual endpoint item
                const endpointIndex = parseInt(name, 10);
                if (sourceID in endpointCache && endpointIndex < endpointCache[sourceID].endpoints.length) {
                  const endpoint = endpointCache[sourceID].endpoints[endpointIndex];
                  // Determine tag color based on HTTP method
                  const {bg, color, tagType} = httpMethodProps(endpoint.method);

                  return m("span", {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      width: "100%",
                    },
                  },
                  NTag({
                    type: tagType,
                    style: {
                      minWidth: "2em",
                      justifyContent: "center",
                      display: "flex",
                      alignItems: "center",
                      backgroundColor: bg,
                      color,
                      fontWeight: "bold",
                      padding: "2px 4px",
                    },
                  }, endpoint.method),
                  m("span", {
                    style: {
                      flex: "1",
                      minWidth: "0",
                      color: "#e0e0e0",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    },
                    title: option.label,
                  }, option.label));
                }
                // Fallback if endpoint not found in cache
                return m("span", {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    width: "100%",
                  },
                },
                NTag({
                  type: "success",
                  style: {
                    minWidth: "4em",
                    justifyContent: "center",
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "#1a5f3a",
                    color: "#70e888",
                    fontWeight: "bold",
                    padding: "2px 4px",
                  },
                }, "EP"),
                m("span", {
                  style: {
                    flex: "1",
                    minWidth: "0",
                    color: "#e0e0e0",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  },
                  title: option.label,
                }, option.label));
              }
              case "tool":
                return m("span", {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    width: "100%",
                  },
                },
                NTag({
                  type: "info",
                  style: {
                    minWidth: "2em",
                    justifyContent: "center",
                    display: "flex",
                    alignItems: "center",
                    backgroundColor: "#000000",
                    color: "#FFFFFF",
                    fontWeight: "bold",
                    padding: "2px 4px",
                  },
                }, "TOOL"),
                m("span", {
                  style: {
                    flex: "1",
                    minWidth: "0",
                    color: "#e0e0e0",
                    overflow: "clip",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  },
                  title: option.label,
                }, option.label));
              }
            }

          // Handle requests (including SQLSource/HTTPSource)
          if (option.key in store.requests) {
            const req = store.requests[option.key];
            const [method, color] = badge(req.kind);

            // Check if this source is currently loading
            const isLoading =
              (req.kind === t.Kind.SQLSource && option.key in tableCache && (tableCache[option.key].loading ?? false)) ||
              (req.kind === t.Kind.HTTPSource && option.key in endpointCache && (endpointCache[option.key].loading ?? false)) ||
              (req.kind === t.Kind.MCP && option.key in toolCache && (toolCache[option.key].loading ?? false));

            // Determine tag type - regular requests have no background, just colored text
            const tagType = req.kind === t.Kind.HTTP ? "success" : "info";

            // The tree component automatically adds folder icon for items with children
            // We just need to render the badge and label

            return [
              NTag({
                type: tagType,
                style: {
                  minWidth: "4em",
                  justifyContent: "center",
                  display: "flex",
                  alignItems: "center",
                  color: color,
                  fontWeight: "bold",
                  padding: "2px 4px",
                  backgroundColor: "#202020",
                  ...(isLoading ? {
                    animation: "pulse 1.5s infinite",
                  } : {}),
                },
              }, method),
              m("span", {
                style: {
                  flex: "1",
                  minWidth: "0",
                  color: "#e0e0e0",
                  overflow: "clip",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                  alignContent: "center",
                  paddingLeft: "4px",
                },
                onclick: (e: MouseEvent) => {
                  e.stopPropagation();
                  store.selectRequest(option.key);
                },
                title: option.label,
              }, option.label),
            ];
          }

          // Handle directories (regular folders) - fallback
          if (option.children !== undefined) {
            return m("span", {
              class: treeLabelClass,
              style: {
                overflow: "clip",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              },
              title: option.label,
            }, option.label);
          }

          return null;
        },
      }),
    ));

    // Restore scroll position after DOM update
    if (scrollTop > 0) {
      setTimeout(() => {
        const newScrollContainer = treeContainer.querySelector(".n-scrollbar-container");
        if (newScrollContainer !== null) {
          newScrollContainer.scrollTop = scrollTop;
        }
      }, 0);
    }
  }

  sourceCacheChanged.sub(function*() {while (true) { yield; updateTree(); }}());

  store.requestsTree.sub(function*() {
    while (true) {
      yield;
      updateTree();
      // Fetch data for expanded sources when requests tree updates
      // (e.g., when store.fetch() loads requests on app startup)
      fetchSources(expandedKeysSignal.value).catch(err => {
        console.error("Failed to fetch expanded sources:", err);
      });
    }
  }());
  expandedKeysSignal.sub(function*() {while (true) { yield; updateTree(); }}());

  return {el: treeContainer};
}
