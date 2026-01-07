import {ComponentContainer, GoldenLayout, Tab} from "golden-layout";
import {NDropdown, NInput, NSelect} from "./components/input.ts";
import {NModal, NScrollbar, NTabs, NSplit} from "./components/layout.ts";
import {TreeOption, NTree, NList, NListItem, NIcon, NTag, NEmpty, NResult} from "./components/dataview.ts";
import {DoubleLeftOutlined, DoubleRightOutlined, DownOutlined, Eye, EyeClosed} from "./components/icons.ts";
import RequestHTTP from "./RequestHTTP.ts";
import RequestSQL from "./RequestSQL.ts";
import RequestGRPC from "./RequestGRPC.ts";
import RequestJQ from "./RequestJQ.ts";
import RequestRedis from "./RequestRedis.ts";
import RequestMD from "./RequestMD.ts";
import {get_request, store, notification, handleCloseTab, updateLocalstorageTabs, update_request, send, last_history_entry, Store} from "./store.ts";
import {Method, Kinds, Database, HistoryEntry, Request} from "./api.ts";
import {app, database} from "../wailsjs/go/models.ts";
import Command from "./components/CommandPalette.ts";
import {DOMNode, m, Signal, signal} from "./utils.ts";

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

function useLocalStorage<T>(key: string, init: T): T {
  const value = localStorage.getItem(key);
  if (value === null) {
    localStorage.setItem(key, JSON.stringify(init));
    return init;
  }
  return JSON.parse(value) as T;
}

type Kind = typeof Kinds[number];
let newRequestKind: Kind | undefined = undefined;
let newRequestName: string | undefined = undefined;
function create() {
  newRequestName = new Date().toUTCString();

  const kind = newRequestKind!;
  const name = newRequestName;
  store.createRequest(name, kind);
  createCancel();
  // TODO: show new request in list
}
function createCancel() {
  newRequestKind = undefined;
  newRequestName = undefined;
}

let renameID : string | undefined = undefined;
let renameValue : string | undefined = undefined;
function renameInit(id: string) {
  renameID = id;
  renameValue = id;
}
function renameCancel() {
  renameID = undefined;
  renameValue = undefined;
}
function rename() {
  const fromID = renameID;
  if (fromID === undefined) {
    notification.error({title: "Invalid request", content: `No request to rename: ${renameID} -> ${renameValue}`});
    return;
  }

  const toID = renameValue;
  if (toID === undefined) {
    notification.error({title: "Invalid request", content: "No new name"});
    return;
  }

  if (toID === fromID) {
    return;
  }

  store.rename(fromID, toID);
  renameCancel();
}

// TODO: fix editing request headers

let expandedKeys = useLocalStorage<string[]>("expanded-keys", []);
function dirname(id: string): string {
  return id.split("/").slice(0, -1).join("/");
}
function basename(id: string): string {
  return id.split("/").pop() ?? "";
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
  case database.Kind.SQL:       return [Database[req.SubKind as keyof typeof Database], "bluewhite"];
  case database.Kind.GRPC:      return ["GRPC", "cyan"];
  case database.Kind.JQ:        return ["JQ", "violet"];
  case database.Kind.REDIS:     return ["REDIS", "red"];
  case database.Kind.MD:        return ["MD", "blue"];
  case database.Kind.SQLSource: return ["SQL Source", "blue"];
  }
}
function renderSuffix(info: {option: TreeOption}): DOMNode {
  const option = info.option;
  const id = option.key;
  return NDropdown({
    trigger: "click", // "hover",
    on: {select: (key: string | number) => {
      console.log(key);
      // message.info(String(key))
    }},
    options: [
      {
        label: "Rename",
        key: "rename",
        icon: NIcon({component: "EditOutlined"}),
        on: {
          // onclick: () => renameInit(id),
        },
      },
      {
        label: "Duplicate",
        key: "duplicate",
        icon: NIcon({component: "CopySharp"}),
        on: {
          click: () => {
            store.duplicate(id);
          },
        },
      },
      {
        label: "Copy as curl",
        key: "copy-as-curl",
        icon: NIcon({component: "ContentCopyFilled"}),
        show: store.requests[id]?.Kind === database.Kind.HTTP,
        on: {
          click: () => {
            // api.get(id).then((r) => {
            //   if (r.kind === "err") {
            //     useNotification().error({title: "Error", content: `Failed to load request: ${r.value}`});
            //     return;
            //   }

            //   const req = r.value as unknown as database.HTTPRequest; // TODO: remove unknown cast
            //   const httpToCurl = ({url, method, body, headers}: database.HTTPRequest) => {
            //     const headersStr = headers?.length > 0 ? " " + headers.map(({key, value}) => `-H "${key}: ${value}"`).join(" ") : "";
            //     const bodyStr = (body) ? ` -d '${body}'` : "";
            //     return `curl -X ${method} ${url}${headersStr}${bodyStr}`;
            //   };
            //   navigator.clipboard.writeText(httpToCurl(req));
            // });
          },
        },
      },
      {
        label: "Delete",
        key: "delete",
        icon: NIcon({color: "red", component: "DeleteOutlined"}),
        on: {
          click: () => {
            store.deleteRequest(id);
          },
        },
      },
    ],
  }, [NIcon({component: DownOutlined})]);
}

let command_bar_new_request_kind_visible = false;
let commandBarVisible = false;
let command_bar_open_visible = false;
const items = [
  {
    label: "Requests",
    items: [
      {
        label: "Create new",
        shortcut: ["Ctrl", "N"],
        perform: () => {
          commandBarVisible = false;
          command_bar_new_request_kind_visible = true;
        },
      },
      {
        label: "Rename current", // TODO: hide if no request selected
        // shortcut: ["Ctrl", "R"],
        perform: () => {
          commandBarVisible = false;

          const currentID = store.requestID();
          if (currentID === null) {return;}
          renameInit(currentID);
        },
      },
      {
        label: "Open",
        shortcut: ["Alt", "T"],
        perform: () => {
          commandBarVisible = false;
          command_bar_open_visible = true;
        },
      },
      {
        label: "Run",
        shortcut: ["Ctrl", "Enter"],
      },
      {
        label: "Duplicate",
      },
      {
        label: "Delete",
      },
    ],
  },
  {
    label: "Tabs",
    items: [
      {
        label: "Next tab",
        shortcut: ["Ctrl", "PgDown"],
      },
      {
        label: "Previous tab",
        shortcut: ["Ctrl", "PgUp"],
      },
      {
        label: "Close tab",
        shortcut: ["Ctrl", "W"],
        perform: () => {
          commandBarVisible = false;
          const currentID = store.requestID();
          if (currentID === null) {return;}
          handleCloseTab(currentID);
        },
      },
      {
        label: "Move tab right",
        shortcut: ["Ctrl", "Shift", "PgDown"],
      },
      {
        label: "Move tab left",
        shortcut: ["Ctrl", "Shift", "PgUp"],
      },
    ],
  },
  {
    label: "Other",
    items: [
      {
        label: "Create new directory",
      },
    ],
  },
];
const open_items = () => {
  return Object.entries(store.requests).map(([id, preview]) => ({
    id: id,
    kind: preview.Kind,
  }));
};
// const anyModalIsOpen = () => newRequestName !== null || renameID !== null;
// const keys = useMagicKeys();
// watch(keys['Alt+K'], (v) => {
//   if (!v || anyModalIsOpen()) {
//     return;
//   }
//   commandBarVisible = !commandBarVisible;
// });
// watch(keys['Alt+T'], (v) => {
//   if (!v || anyModalIsOpen()) {
//     return;
//   }
//   commandBarOpenVisible = !commandBarOpenVisible;
// });
// watch(keys['Escape'], (v) => {
//   if (!v) {
//     return;
//   }
//   renameCancel();
//   createCancel();
//   commandBarVisible = false;
//   commandBarNewRequestKindVisible = false;
//   commandBarOpenVisible = false;
// });

type Panelka = {
  el: HTMLElement,
};

type panelkaState = {id: string};

type Frame = {
  loaded(r: get_request): void,
  push_history_entry(he: HistoryEntry): void, // show last history entry
  unmount(): void,
};
const f = {
  [database.Kind.HTTP ]:     RequestHTTP,
  [database.Kind.SQL  ]:     RequestSQL,
  [database.Kind.GRPC ]:     RequestGRPC,
  [database.Kind.JQ   ]:     RequestJQ,
  [database.Kind.REDIS]:     RequestRedis,
  [database.Kind.MD   ]:     RequestMD,
  // [database.Kind.SQLSource]: RequestSQLSource,
} as {[key in database.Kind]: (
  el: HTMLElement,
  show_request: Signal<boolean>,
  on: {
    update: (patch: Partial<Request>) => Promise<void>,
    send: () => Promise<void>,
  },
) => Frame};
const panelkaFactory = (
  container: ComponentContainer,
  {id}: panelkaState,
): Panelka => {
  const el = container.element;
  const show_request = signal(true);
  let eye_unsub = () => {};
  let frame_unsub = () => {};
  container.on("tab", (tab: Tab): void => {
    const eye = m("span", {
      title: "Hide request",
      onclick: () => {
        show_request.update(b => !b);
      },
    }, NIcon({
      component: show_request.value ? Eye : EyeClosed,
      class: "highlight-red",
    }));

    eye_unsub = show_request.sub(value => {
      eye.title = value ? "Hide request" : "Show request";
      eye.replaceChildren(NIcon({
        component: value ? Eye : EyeClosed,
        class: "highlight-red",
      }));
    });

    tab.element.prepend(eye);
    container.on("destroy", () => {
      eye_unsub();
      frame_unsub();
    });
    // TODO: ebanij rot etogo kazino, we have to use timeout for now, since request is not yet loaded (???)
    setTimeout(() => {
      const req = store.requests2[id];
      if (req === undefined) {
        tab.componentItem.close();
        return;
      }
      tab.setTitle(req.request.path);
    }, 100);
  });
  if (store.requests[id] !== undefined) {
    const kind = store.requests[id].Kind;
    const frame = f[kind](
      el,
      show_request,
      {
        update: (patch: Partial<Request>) => update_request(id, patch),
        send: () => send(id).then(_ => {
          frame.push_history_entry(last_history_entry(store.requests2[id])!);
        }),
      },
    );
    frame_unsub = () => frame.unmount();
    get_request(id).then(r => r !== null && frame.loaded(r));
  }
  return {el};
};

export default function(root: HTMLElement) {
  void store.fetch().then(() => preApp(root, store));
}

function preApp(root: HTMLElement, store: Store) {
  const el_empty_state = NResult({
    status: "info",
    title: "Pick request",
    description: "Pick request to view it, edit, send and do other fun things.",
  });

  const el_layout = m("div", {id: "layoutContainer", style: {height: "100%", width: "100%"}});

  const golden_layout: GoldenLayout = new GoldenLayout(el_layout);
  golden_layout.resizeWithContainerAutomatically = true;
  golden_layout.resizeDebounceInterval = 0;
  golden_layout.registerComponentFactoryFunction("MyComponent", (container, state, _) => panelkaFactory(container, state as panelkaState));
  golden_layout.loadLayout(store.layoutConfig);
  golden_layout.on("stateChanged", () => {
    update_empty_state(golden_layout.saveLayout().root === undefined);
    updateLocalstorageTabs();
  });
  store.layout = golden_layout;
  const update_empty_state = (show: boolean) => {
    el_empty_state.style.display = show ? "flex" : "none";
  };
  update_empty_state(golden_layout.saveLayout().root === undefined);

  // TODO: whole history in reverse order
  const history = [] as HistoryEntry[];

  let sidebarHidden = false;
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
    },
  }, collapseButtonStates.get(sidebarHidden)!);

  const new_select = NSelect<database.Kind>({
    label: newRequestKind?.toUpperCase(),
    on: {update: (value: database.Kind) => {
      newRequestKind = value;
      create();
      new_select.reset();
    }},
    placeholder: "New",
    options: Kinds.map((kind: database.Kind) => ({label: kind.toUpperCase(), value: kind})),
  });

  const el_aside = m("aside", {
    style: {
      overflow: "auto",
      color: "rgba(255, 255, 255, 0.82)",
      backgroundColor: "rgb(24, 24, 28)",
      display: "grid",
      gridTemplateRows: "95% 5%",
      height: "100vh",
    },
  },
    NTabs({
      type: "card",
      size: "small",
      tabs: [
        {
          name: "Collection",
          style: {
            overflow: "auto",
            display: "grid",
            paddingTop: "0px",
            gridTemplateRows: "2em auto",
            height: "100%",
          },
          elem: [
            new_select.el,
            NScrollbar(
              NTree({
                "selected-keys": [/*(store.tabs.value ? store.tabs.value.map.list[store.tabs.value.index] : "")*/],
                data: ((): TreeOption[] => {
                  const mapper = (tree: app.Tree): TreeOption[] =>
                    Object.entries(tree.Dirs ?? {}).map(([k, v]) => ({
                      key: k,
                      label: basename(k),
                      children: mapper(v),
                    } as TreeOption)).concat(Object.entries(tree.IDs).map(([id, basename]) => {
                      return {
                        key: id,
                        label: basename,
                      } as TreeOption;
                    }));
                  return mapper(store.requestsTree);
                })(),
                "default-expanded-keys": expandedKeys,
                on: {
                  "update:expanded-keys": (keys: string[]) => {expandedKeys = keys;},
                  drop: drag,
                },
                "node-props": ({option}: {option: TreeOption}): {onclick: () => void} => {
                  return {
                    onclick: () => {
                      const id = option.key;
                      if (option.children === undefined && !(option.disabled ?? false)) {
                        store.selectRequest(id);
                      }
                    },
                  };
                },
                "render-prefix": (info: {option: TreeOption, checked: boolean, selected: boolean}): DOMNode => {
                  const option = info.option;
                  if (option.key === undefined) {
                    return null;
                  }
                  const req = store.requests[option.key];
                  if (req === undefined) {
                    return null;
                  }
                  const [method, color] = badge(req);
                  return NTag({
                    type: (req.Kind === database.Kind.HTTP ? "success" : "info") as "success" | "info" | "warning",
                    style: {width: "4em", justifyContent: "center", color},
                    size: "small",
                  }, method);
                },
                "render-suffix": renderSuffix,
              }),
            ),
          ],
        },
        {
          name: "History",
          style: {flexGrow: "1"},
          elem: (() => {
            if (store.requestID() === null)
              return NEmpty({
                description: "Not implemented",
                class: "h100",
                style: {justifyContent: "center"},
              });
            if (history.length === 0)
              return NEmpty({
                description: "No history yet",
                class: "h100",
                style: {justifyContent: "center"},
              });
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
  const el_main = m("div", {
    style: {
      color: "rgba(255, 255, 255, 0.82)",
      backgroundColor: "rgb(16, 16, 20)",
      overflow: "hidden",
    }}, [
      el_empty_state,
      el_layout,
    ]);
  const {element: app_container} = NSplit(el_aside, el_main, {direction: "horizontal", sizes: ["300px", "1fr"]});

  collapseButton.onclick = () => { // TODO: inline to props
    sidebarHidden = !sidebarHidden;
    app_container.style.gridTemplateColumns = sidebarHidden ? "3em 5px 1fr" : "300px 5px 1fr";
    if (sidebarHidden) {
      el_aside.style.gridTemplateRows = "1fr";
      (el_aside.children[0] as HTMLElement).style.display = "none";
    } else {
      el_aside.style.gridTemplateRows = "95% 5%";
      (el_aside.children[0] as HTMLElement).style.display = "block";
    }
    collapseButton.replaceChildren(...collapseButtonStates.get(sidebarHidden)!);
  };

  root.append(m("div", {style: {
    height: "100%",
    width: "100%",
  }},
    NModal({
      show: newRequestKind !== undefined,
      preset: "dialog",
      title: "Create request",
      text: {positive: "Create", negative: "Cancel"},
      on: {
        close: createCancel,
        positive_click: create,
        negative_click: createCancel,
      },
    }, NInput({
      value: newRequestName,
      on: {update: (value: string) => newRequestName = value},
    })),
    NModal({
      show: renameID !== undefined,
      preset: "dialog",
      title: "Rename request",
      text: {positive: "Rename", negative: "Cancel"},
      on: {
        close: renameCancel,
        positive_click: rename,
        negative_click: renameCancel,
      },
    }, NInput({
      value: renameValue,
      on: {update: (value: string) => renameValue = value},
    })),
    Command.Dialog({
      visible: commandBarVisible,
      on: {close: () => commandBarVisible = false},
      header: Command.Input({placeholder: "Type a command or search..."}),
      body: Command.List([
        Command.Empty({description: "No results found."}),
        ...items.map(group =>
          Command.Group({heading: group.label}, group.items.map(item =>
            Command.Item({
              value: item.label,
              shortcut: item.shortcut,
              on: {select: item.perform},
            }, [
              m("div", {}, item.label),
              m("div", {
                class: "hidden",
                style: {
                  color: "var(--gray10)",
                  alignItems: "center",
                  display: item.shortcut !== undefined ? "block" : "none",
                },
              }, item.shortcut?.flatMap((k, i) => [
                i !== 0 ? m("div", {style: {padding: "0px 2px"}}, "+") : null,
                m("kbd", {}, k),
              ]) ?? []),
            ])),
          ),
        ),
      ]),
      footer: Command.Footer,
    }),
    Command.Dialog({
      visible: command_bar_new_request_kind_visible,
      on: {close: () => command_bar_new_request_kind_visible = false},
      header: Command.Input({placeholder: "Enter kind of new reqeust"}),
      body: Command.List([
        Command.Empty({description: "No kinds found."}),
        ...Kinds.map(kind =>
          Command.Item({
            value: kind,
            on: {select: () => {
              newRequestKind = kind;
              command_bar_new_request_kind_visible = false;
            }},
          }, kind),
        ),
      ]),
      footer: Command.Footer,
    }),
    Command.Dialog({
      visible: command_bar_open_visible,
      on: {close: () => command_bar_open_visible = false},
      header: Command.Input({placeholder: "Type or search request id to open"}),
      body: Command.List([
        Command.Empty({description: "No requests found."}),
        ...open_items().map(item =>
          Command.Item({
            value: item.id,
            on: {select: () => {
              command_bar_open_visible = false;
              store.selectRequest(item.id);
            }},
          }, m("div", {}, `[${item.kind}] ${item.id}`))),
      ]),
      footer: Command.Footer,
    }),
    app_container,
  ));
};
