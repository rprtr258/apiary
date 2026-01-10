import {app, database} from "../wailsjs/go/models.ts";
import {NEmpty, NIcon, NList, NListItem, NTag, NTree, TreeOption} from "./components/dataview.ts";
import {ContentCopyFilled, CopySharp, DeleteOutlined, DoubleLeftOutlined, DoubleRightOutlined, DownOutlined, EditOutlined} from "./components/icons.ts";
import {NSelect} from "./components/input.ts";
import {NScrollbar, NTabs} from "./components/layout.ts";
import {api, HistoryEntry, Kinds, Method} from "./api.ts";
import {store, useNotification} from "./store.ts";
import {DOMNode, m, setDisplay, signal, Signal} from "./utils.ts";

function basename(id: string): string {
  return id.split("/").pop() ?? "";
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
function dirname(id: string): string {
  return id.split("/").slice(0, -1).join("/");
}
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
  case database.Kind.HTTP:      return [Method[req.SubKind as keyof typeof Method], "lime"];
  case database.Kind.SQL:       return ["SQL", "lightblue"];
  case database.Kind.GRPC:      return ["GRPC", "cyan"];
  case database.Kind.JQ:        return ["JQ", "violet"];
  case database.Kind.REDIS:     return ["REDIS", "red"];
  case database.Kind.MD:        return ["MD", "blue"];
  case database.Kind.SQLSource: return ["SQL Source", "blue"];
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

function render_suffix(id: string): DOMNode {
  return m("span", {
    style: {display: "inline-block", cursor: "pointer"},
    onclick: (e: Event) => {
      e.stopPropagation();
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
      const options = preOptions.filter(opt => opt.show === undefined || opt.show).map(opt => {
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
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      globalDropdown.el.replaceChildren(...options);
      globalDropdown.moveTo(rect.left, rect.bottom);
      globalDropdown.show();
    },
  }, NIcon({component: DownOutlined})); // TODO: instead, show on RMB click
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
  open.sub(v => setDisplay(el, v), true);
  document.addEventListener("click", e => {
    if (!el.contains(e.target as Node) && open.value)
      open.update(() => false);
  });

  return {
    el,
    show() {
      open.update(() => true);
      const x = clamp(parseFloat(cutEnd(el.style.left, "px")), 0, window.innerWidth - el.offsetWidth);
      const y = clamp(parseFloat(cutEnd(el.style.top, "px")), 0, window.innerHeight - el.offsetHeight);
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    },
    hide() {
      open.update(() => false);
    },
    moveTo(x: number, y: number) {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    },
  };
}

export const globalDropdown = Dropdown();

export function Sidebar(sidebarHidden: Signal<boolean>) {
  const collapseButtonStates: Map<boolean, (string | DOMNode & Node)[]> = new Map([
    [true, [
      NIcon({component: DoubleRightOutlined}),
    ]],
    [false, [
      NIcon({component: DoubleLeftOutlined}),
      "hide",
    ]],
  ]);
  const collapseButton = m("button", {
    id: "collapse-button",
    type: "button",
    class: "h100",
    style: {
      color: "black",
      display: "flex",
      gap: ".5em",
      justifyContent: "center",
      alignItems: "center",
      cursor: "w-resize",
    },
  }, collapseButtonStates.get(sidebarHidden.value)!);

  const updateCollapseButton = () => {
    collapseButton.replaceChildren(...collapseButtonStates.get(sidebarHidden.value)!);
    collapseButton.style.cursor = sidebarHidden.value ? "e-resize" : "w-resize";
  };

  const treeContainer = m("div", {style: {minHeight: "0"}});
  const updateTree = () => {
    const data = (() => {
      const mapper = (tree: app.Tree): TreeOption[] =>
        Object.entries(tree.Dirs).map(([k, v]): TreeOption => ({
          key: k,
          label: basename(k),
          children: mapper(v),
        })).concat(Object.entries(tree.IDs).map(([id, basename]) => ({
            key: id,
            label: basename,
        })));
      return mapper(store.requestsTree.value);
    })();
    treeContainer.replaceChildren(NScrollbar(
      NTree({
        defaultExpandedKeys: expandedKeys.value,
        data,
        on: {
          "update:expanded-keys": (keys: string[]) => {
            expandedKeys.value = keys;
          },
          drop: drag,
        },
        render: (option: TreeOption, _checked: boolean, _selected: boolean): DOMNode => {
          if (!(option.key in store.requests))
            return null;

          const req = store.requests[option.key];
          const [method, color] = badge(req);
          return [
            NTag({
              type: (req.Kind === database.Kind.HTTP ? "success" : "info") as "success" | "info" | "warning",
              style: {width: "4em", justifyContent: "center", color},
              size: "small",
            }, method),
            m("button", {
              onclick: () => {
                const id = option.key;
                if (option.children === undefined && option.disabled !== true) {
                  store.selectRequest(id);
                }
              },
            }, option.label),
            render_suffix(option.key),
          ];
        },
      }),
    ));
  };
  store.requestsTree.sub(updateTree, true);

  const new_select = NSelect<database.Kind>({
    label: newRequestKind.value?.toUpperCase(),
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
    display: "grid",
    gridTemplateRows: "95% 5%",
    height: "100vh",
  }},
    NTabs({
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

  collapseButton.onclick = () => {
    sidebarHidden.update(v => !v);
    el_aside.style.gridTemplateRows = sidebarHidden.value ? "1fr" : "95% 5%";
    setDisplay(el_aside.children[0] as HTMLElement, !sidebarHidden.value);
    updateCollapseButton();
  };

  return {
    el: el_aside,
  };
}
