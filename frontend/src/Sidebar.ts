import {app, database} from "../wailsjs/go/models.ts";
import {NEmpty, NIcon, NList, NListItem, NTag, NTree, treeLabelClass, TreeOption} from "./components/dataview.ts";
import {ContentCopyFilled, CopySharp, DeleteOutlined, DoubleLeftOutlined, DoubleRightOutlined, EditOutlined} from "./components/icons.ts";
import {NSelect} from "./components/input.ts";
import {NScrollbar, NTabs} from "./components/layout.ts";
import {api, HistoryEntry, Kinds} from "./api.ts";
import {notification, store, useNotification} from "./store.ts";
import {DOMNode, m, setDisplay, signal, Signal} from "./utils.ts";

function basename(id: string): string {
  return id.split("/").pop() ?? "";
}

function dirname(id: string): string {
  return id.split("/").slice(0, -1).join("/");
}

const units = ["B", "KiB", "MiB", "GiB", "TiB"] as const;
function formatSize(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} B`;

  const unitIndex = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const size = bytes / Math.pow(1024, unitIndex);
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

function formatTableLabel(args: {
  name: string,
  rowCount: number,
  sizeBytes: number,
}): string {
  const {name, rowCount: rows, sizeBytes: bytes} = args;
  return `${name} (${rows.toLocaleString()} rows, ${formatSize(bytes)})`;
}

const tableCache: Record<string, {tables: Record<string, database.TableInfo>, lastFetch: number}> = {};

async function fetchTables(sqlSourceID: string): Promise<void> {
  // Clear cache to force fresh fetch
  delete tableCache[sqlSourceID];

  const res = await api.requestListTablesSQLSource(sqlSourceID);
  if (res.kind === "err") {
    notification.error({title: "Could not fetch tables", error: res.value});
    return;
  }

  tableCache[sqlSourceID] = {
    lastFetch: Date.now(),
    tables: Object.fromEntries(res.value.map(t => [t.name, t])),
  };
}

const endpointCache: Record<string, {endpoints: database.EndpointInfo[], lastFetch: number}> = {};

async function fetchEndpoints(httpSourceID: string): Promise<void> {
  const res = await api.requestListEndpointsHTTPSource(httpSourceID);
  if (res.kind === "err") {
    notification.error({title: "Could not fetch endpoints", error: res.value});
    // Don't delete cache on error - keep old data if available
    return;
  }

  endpointCache[httpSourceID] = {
    lastFetch: Date.now(),
    endpoints: res.value,
  };
}

function formatEndpointLabel(endpoint: database.EndpointInfo): string {
  const {path} = endpoint;
  // Format: /route/
  // Ensure path starts with / and ends with / if not empty
  const formattedPath = path === "" ? "/" : path.startsWith("/") ? path : `/${path}`;
  const pathWithTrailingSlash = formattedPath.endsWith("/") ? formattedPath : `${formattedPath}/`;
  return pathWithTrailingSlash;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function cutEnd(str: string, suffix: string) {
  if (!str.endsWith(suffix))
    throw new Error(`String ${str} does not end with ${suffix}`);
  return str.slice(0, -suffix.length);
}

function fromNow(date: Date): string {
  const now = new Date();

  const milliseconds = now.getTime() - date.getTime();
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours   = Math.floor(minutes / 60);
  const days    = Math.floor(hours   / 24);
  const weeks   = Math.floor(days    /  7);
  const months  = Math.floor(weeks   /  4);
  const years   = Math.floor(months  / 12);

  switch (true) {
    case years   > 0: return years   === 1 ? "a year ago"   : `${years} years ago`;
    case months  > 0: return months  === 1 ? "a month ago"  : `${months} months ago`;
    case weeks   > 0: return weeks   === 1 ? "a week ago"   : `${weeks} weeks ago`;
    case days    > 0: return days    === 1 ? "yesterday"    : `${days} days ago`;
    case hours   > 0: return hours   === 1 ? "an hour ago"  : `${hours} hours ago`;
    case minutes > 0: return minutes === 1 ? "a minute ago" : `${minutes} minutes ago`;
    default:          return "just now";
  }
}

function useLocalStorage<T>(key: string, init: T): {
  get value(): T,
  set value(value: T),
} {
  const value = localStorage.getItem(key);
  let curValue = value === null ? init : JSON.parse(value) as T;
  return {
    get value() {
      return curValue;
    },
    set value(value) {
      localStorage.setItem(key, JSON.stringify(value));
      curValue = value;
    },
  };
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

function badge(req: app.requestPreview): [string, string] {
  switch (req.Kind) {
  case database.Kind.HTTP:       return ["HTTP",  "lime"     ];
  case database.Kind.SQL:        return ["SQL",   "lightblue"];
  case database.Kind.GRPC:       return ["GRPC",  "cyan"     ];
  case database.Kind.JQ:         return ["JQ",    "violet"   ];
  case database.Kind.REDIS:      return ["REDIS", "red"      ];
  case database.Kind.MD:         return ["MD",    "blue"     ];
  case database.Kind.SQLSource:  return ["SQL*",  "blue"     ];
  case database.Kind.HTTPSource: return ["HTTP*", "lime"     ];
  default:                       return [String(req.Kind), ""];
  }
}

type Kind = typeof Kinds[number];
export const newRequestKind = signal<Kind | undefined>(undefined);
export const newRequestName = signal<string | undefined>(undefined);
export const renameID = signal<string | undefined>(undefined);
export const renameValue = signal<string | undefined>(undefined);
export function renameInit(id: string) {
  renameID.update(() => id);
  renameValue.update(() => id);
}

function showContextMenu(id: string, event: MouseEvent): void {
  const preOptions: {
    label: string,
    key: string,
    icon?: DOMNode,
    show?: boolean,
    on: {
      click: () => void,
    },
  }[] = [
    {
      label: "Rename",
      key: "rename",
      icon: NIcon({component: EditOutlined}),
      on: {
        click: () => renameInit(id),
      },
    },
    {
      label: "Duplicate",
      key: "duplicate",
      icon: NIcon({component: CopySharp}),
      on: {
        click: () => {
          store.duplicate(id);
        },
      },
    },
    {
      label: "Copy as curl",
      key: "copy-as-curl",
      icon: NIcon({component: ContentCopyFilled}),
      show: store.requests[id].Kind === database.Kind.HTTP,
      on: {
        click: () => {
          api.get(id).then(r => {
            if (r.kind === "err") {
              useNotification().error({title: "Error", content: `Failed to load request: ${r.value}`});
              return;
            }

            const req = r.value.Request as unknown as database.HTTPRequest; // TODO: remove unknown cast
            const httpToCurl = ({url, method, body, headers}: database.HTTPRequest) => {
              const headersStr = headers.length > 0 ? " " + headers.map(({key, value}) => `-H "${key}: ${value}"`).join(" ") : "";
              const bodyStr = body !== "" ? ` -d '${body}'` : "";
              return `curl -X ${method} ${url}${headersStr}${bodyStr}`;
            };
            navigator.clipboard.writeText(httpToCurl(req));
          });
        },
      },
    },
    {
      label: "Delete",
      key: "delete",
      icon: NIcon({color: "red", component: DeleteOutlined}),
      on: {
        click: () => {
          store.deleteRequest(id);
        },
      },
    },
  ];
  const options = preOptions.filter(opt => opt.show !== false).map(opt => {
    const res = m("div", {
      style: {
        padding: "8px 12px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        color: "#ffffff",
      },
      // TODO: remove, put to styles
      onmouseover: (e: Event) => {(e.currentTarget as HTMLElement).style.background = "#404040";},
      onmouseout: (e: Event) => {(e.currentTarget as HTMLElement).style.background = "";},
      onclick: () => {
        opt.on.click();
        globalDropdown.hide();
      },
    }, opt.icon ?? null, opt.label);
    return res;
  });
  globalDropdown.show(event.clientX, event.clientY, options);
}

function Dropdown() {
  const open = signal(false);
  const el: HTMLElement = m("div", {style: {
    position: "fixed",
    zIndex: "1000",
    background: "#2a2a2a",
    color: "#ffffff",
    border: "1px solid #404040",
    borderRadius: "4px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
    minWidth: "120px",
  }});
  open.sub(function*() {while(true) setDisplay(el, yield);}());
  document.addEventListener("click", e => {
    if (!el.contains(e.target as Node))
      open.update(() => false);
  });

  return {
    el,
    show(
      x: number,
      y: number,
      options: HTMLElement[],
    ) {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;

      el.replaceChildren(...options);
      open.update(() => true);

      // NOTE: we can go out of window (literally),
      // so we have to adjust dropdown position to be inside if possible
      {
        const x = clamp(parseFloat(cutEnd(el.style.left, "px")), 0, window.innerWidth - el.offsetWidth);
        const y = clamp(parseFloat(cutEnd(el.style.top, "px")), 0, window.innerHeight - el.offsetHeight);
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
      }
    },
    hide() {
      open.update(() => false);
    },
  };
}

export const globalDropdown = Dropdown();

export function Sidebar(sidebarHidden: Signal<boolean>) {
  const collapseButtonClosed = [NIcon({component: DoubleRightOutlined})];
  const collapseButtonOpen = [NIcon({component: DoubleLeftOutlined}), "hide"];
  const collapseButton = m("button", {
    id: "collapse-button",
    type: "button",
    style: {
      color: "black",
      display: "flex",
      gap: ".5em",
      justifyContent: "center",
      alignItems: "center",
    },
  });
  sidebarHidden.sub(function*() {
    while (true) {
      const sidebarHidden = yield;
      collapseButton.replaceChildren(...(sidebarHidden ? collapseButtonClosed : collapseButtonOpen));
      collapseButton.style.cursor = sidebarHidden ? "e-resize" : "w-resize";
      collapseButton.style.height = sidebarHidden ? "100%" : "3em";
    }
  }());

  const treeContainer = m("div", {style: {minHeight: "0"}});
  function updateTree(requestsTree: app.Tree) {
    const data = (() => {
      const mapper = (tree: app.Tree): TreeOption[] =>
        Object.entries(tree.Dirs).map(([k, v]): TreeOption => ({
          key: k,
          label: basename(k),
          children: mapper(v),
        })).concat(Object.entries(tree.IDs).map(([id, basename]) => {
            const req = store.requests[id];
            const isSQLSource = id in store.requests && req.Kind === database.Kind.SQLSource;
            const isHTTPSource = id in store.requests && req.Kind === database.Kind.HTTPSource;

            let children: TreeOption[] | undefined;

            if (isSQLSource && id in tableCache && Object.keys(tableCache[id].tables).length > 0) {
              children = Object.values(tableCache[id].tables).map(table => ({
                key: `virtual:table:${id}:${table.name}`,
                label: formatTableLabel(table),
              }));
            } else if (isHTTPSource && id in endpointCache && endpointCache[id].endpoints.length > 0) {
              children = endpointCache[id].endpoints.map((endpoint, index) => ({
                key: `virtual:endpoint:${id}:${index}`,
                label: formatEndpointLabel(endpoint),
              }));
            }

            const item: TreeOption = {
              key: id,
              label: basename,
              ...(children !== undefined ? {children} : {}),
            };
            return item;
        }));
      return mapper(requestsTree);
    })();
    treeContainer.replaceChildren(NScrollbar(
      NTree({
        defaultExpandedKeys: expandedKeysSignal.value,
        data,
        on: {
          "update:expanded-keys": async (keys: string[]) => {
            expandedKeysSignal.update(() => keys);
            // Fetch tables for newly expanded SQLSource
            const sqlSourceKeys = keys.filter(key =>
              key in store.requests
              && store.requests[key].Kind === database.Kind.SQLSource
              && (!(key in tableCache) || Date.now() - tableCache[key].lastFetch > 300000)); // 5 min cache
            // Fetch endpoints for newly expanded HTTPSource
            const httpSourceKeys = keys.filter(key =>
              key in store.requests
              && store.requests[key].Kind === database.Kind.HTTPSource
              && (!(key in endpointCache) || Date.now() - endpointCache[key].lastFetch > 300000)); // 5 min cache
            await Promise.all([
              ...sqlSourceKeys.map(key => fetchTables(key)),
              ...httpSourceKeys.map(key => fetchEndpoints(key)),
            ]);
            updateTree(store.requestsTree.value); // Re-render after fetch
          },
          drop: drag,
          context_menu: (option: TreeOption, event: MouseEvent) => {
            showContextMenu(option.key, event);
          },
          click: (v: TreeOption) => {
            const id = v.key;
            if (id.startsWith("virtual:")) {
              const parts = id.split(":");
              if (parts.length !== 4)
                return;
              const [, type, sourceID, identifier] = parts;

              switch (type) {
              case "table":
                if (!(identifier in tableCache[sourceID].tables))
                  return;
                const tableInfo = tableCache[sourceID].tables[identifier];
                store.openTableViewer(sourceID, identifier, tableInfo);
                break;
              case "endpoint":
                const endpointIndex = parseInt(identifier, 10);
                if (!(sourceID in endpointCache) || endpointIndex >= endpointCache[sourceID].endpoints.length)
                  return;

                // Open virtual endpoint viewer (not real HTTP request)
                const endpoint = endpointCache[sourceID].endpoints[endpointIndex];
                store.openEndpointViewer(sourceID, endpointIndex, endpoint);
                break;
              }
            } else if (v.disabled !== true) {
              store.selectRequest(id);
            }
          },
        },
        render: (option: TreeOption, _level: number, _expanded: boolean): DOMNode => {
          if (option.children !== undefined && !(option.key in store.requests)) // Directory
            return m("span", {class: treeLabelClass}, option.label);

          // Request
          const isVirtual = option.key.startsWith("virtual:");
          if (!isVirtual && !(option.key in store.requests))
            return null;

          if (isVirtual) {
            const parts = option.key.split(":");
            if (parts.length === 4) {
              const [, type] = parts;
              switch (type) {
              case "table": // Virtual table item
                return m("span", {
                  style: {fontStyle: "italic"},
                },
                NTag({
                  type: "info",
                  style: {width: "4em", justifyContent: "center", color: "grey", fontStyle: "italic"},
                  size: "small",
                }, "TABLE"),
                option.label);
              case "endpoint": // Virtual endpoint item
                const [, , sourceID, index] = parts;
                const endpointIndex = parseInt(index, 10);
                if (sourceID in endpointCache && endpointIndex < endpointCache[sourceID].endpoints.length) {
                  const endpoint = endpointCache[sourceID].endpoints[endpointIndex];
                  return m("span", {
                    style: {fontStyle: "italic"},
                  },
                  NTag({
                    type: "success",
                    style: {width: "4em", justifyContent: "center", color: "grey", fontStyle: "italic"},
                    size: "small",
                  }, endpoint.method),
                  option.label);
                }
                // Fallback if endpoint not found in cache
                return m("span", {
                  style: {fontStyle: "italic"},
                },
                NTag({
                  type: "success",
                  style: {width: "4em", justifyContent: "center", color: "grey", fontStyle: "italic"},
                  size: "small",
                }, "ENDPT"),
                option.label);
              }
            }
          }

          const req = store.requests[option.key];
          const [method, color] = badge(req);
          const isSQLSource = req.Kind === database.Kind.SQLSource;
          const isHTTPSource = req.Kind === database.Kind.HTTPSource;

          return [
            NTag({
              type: (req.Kind === database.Kind.HTTP ? "success" : "info") as "success" | "info" | "warning",
              style: {
                minWidth: "4em",
                justifyContent: "center",
                display: "flex",
                backgroundColor: "#2a2a2a",
                padding: "4px",
                color,
                fontWeight: "bold",
              },
              size: "small",
            }, method),
            m("span", {
              class: treeLabelClass,
              style: {flex: "1", minWidth: "0"},
              onclick: (e: MouseEvent) => {
                e.stopPropagation();
                store.selectRequest(option.key);
              },
            }, option.label),
            ...((isSQLSource || isHTTPSource) ?  [m("button", {
              onclick: e => {
                e.stopPropagation();
                if (isSQLSource) {
                  fetchTables(option.key).then(() => {
                    updateTree(store.requestsTree.value); // Re-render
                  });
                } else if (isHTTPSource) {
                  fetchEndpoints(option.key).then(() => {
                    updateTree(store.requestsTree.value); // Re-render
                  });
                }
              },
              style: {fontSize: "12px", width: "1.5em", height: "1.5em"},
              title: isSQLSource ? "Refresh tables" : "Refresh endpoints",
            }, "↻")] : []),
          ];
        },
      }),
    ));
  }
  store.requestsTree.sub(function*() {while (true) { updateTree(yield); }}());
  expandedKeysSignal.sub(function*() {while (true) { updateTree(store.requestsTree.value); yield; }}());

  const new_select = NSelect<database.Kind>({
    on: {update: (value: database.Kind) => {
      newRequestKind.update(() => value);
      new_select.reset();
    }},
    placeholder: "New",
    options: Kinds.map((kind: database.Kind) => ({label: kind.toUpperCase(), value: kind})),
  });

  // TODO: whole history in reverse order
  const history = [] as HistoryEntry[];

  const el_aside = m("aside", {style: {
    color: "rgba(255, 255, 255, 0.82)",
    backgroundColor: "rgb(24, 24, 28)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    height: "100vh",
  }},
    NTabs({
      style: {minHeight: "0"},
      tabs: [
        {
          name: "Collection",
          class: "h100",
          style: {
            display: "flex",
            flexDirection: "column",
          },
          elem: [
            new_select.el,
            treeContainer,
          ],
        },
        {
          name: "History",
          style: {flexGrow: "1"},
          elem: (() => {
            if (store.requestID() === null)
              return NEmpty({description: "Not implemented"});
            if (history.length === 0)
              return NEmpty({description: "No history yet"});
            return [
              NList(history.map(r =>
                NListItem({
                  class: ["history-card", "card"].join(" "),
                  // on: {click: () => selectRequest(r.request.id)},
                }, [
                  m("span", {style: {color: "grey"}, class: "date"}, fromNow(r.sent_at)),
                ]),
              )),
            ];
          })(),
        },
      ],
    }),
    collapseButton,
  );
  sidebarHidden.sub(function*() {
    while (true) {
      const sidebarHidden = yield;
      el_aside.style.gridTemplateRows = sidebarHidden ? "1fr" : "95% 5%";
      setDisplay(el_aside.children[0] as HTMLElement, !sidebarHidden);
    }
  }());

  collapseButton.onclick = () => sidebarHidden.update(v => !v);

  return {
    el: el_aside,
  };
}
