import m, {ComponentTypes, VnodeDOM} from "mithril";
import {ComponentContainer, GoldenLayout, Tab} from "golden-layout";
import {VNodeChild} from "./components/dataview";
import {NDropdown, NInput, NSelect, NButton,} from "./components/input";
import {NModal, NScrollbar, NSpace, NTabs} from "./components/layout";
import {TreeOption, NTree, NList, NListItem, NIcon, NTag, NEmpty, NResult} from "./components/dataview";
import {DownOutlined, DoubleLeftOutlined, DoubleRightOutlined, Eye, EyeClosed} from "./components/icons";
import RequestHTTP from "./RequestHTTP";
import RequestSQL from "./RequestSQL";
import RequestGRPC from "./RequestGRPC";
import RequestJQ from "./RequestJQ";
import RequestRedis from "./RequestRedis";
import RequestMD from "./RequestMD";
import {store, notification, handleCloseTab, use_request, updateLocalstorageTabs} from "./store";
// import {useBrowserLocation, useLocalStorage, useMagicKeys} from "@vueuse/core";
import {Method, Kinds, Database} from "./api";
import {app, database} from "../wailsjs/go/models";
import Command from "./components/CommandPalette";

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
  return JSON.parse(value);
}

type Kind = typeof Kinds[number];
let newRequestKind: Kind | null = null;
let newRequestName: string | null = null;
function create() {
  newRequestName = new Date().toUTCString();

  const kind = newRequestKind!;
  const name = newRequestName!;
  store.createRequest(name, kind);
  createCancel();
}
function createCancel() {
  newRequestKind = null;
  newRequestName = null;
}

let renameID : string | null = null;
let renameValue : string | null = null;
function renameInit(id: string) {
  renameID = id;
  renameValue = id;
}
function renameCancel() {
  renameID = null;
  renameValue = null;
}
function rename() {
  const fromID = renameID;
  if (fromID === null) {
    notification.error({title: "Invalid request", content: `No request to rename: ${renameID} -> ${renameValue}`});
    return;
  }

  const toID = renameValue;
  if (toID === null) {
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

const location = {
  hash: document.location.hash,
};

function selectRequest(id: string) {
  store.selectRequest(id);
  location.hash = id;
}

let sidebarHidden = false;
let expandedKeys = useLocalStorage<string[]>("expanded-keys", []);
function dirname(id: string): string {
  return id.split("/").slice(0, -1).join("/");
}
function basename(id: string): string {
  return id.split("/").pop() ?? "";
}
const treeData = (): TreeOption[] => {
  const mapper = (tree: app.Tree): TreeOption[] =>
    Object.entries(tree.Dirs ?? {}).map(([k, v]) => ({
      key: k,
      label: basename(k),
      children: mapper(v),
    } as TreeOption)).concat(tree.IDs.map(id => {
      return {
        key: id,
        label: basename(id),
      } as TreeOption;
    }));
  return mapper(store.requestsTree);
};
function drag({node, dragNode, dropPosition}: {
  node: TreeOption,
  dragNode: TreeOption,
  dropPosition: "before" | "inside" | "after",
}): void  {
  const dir = (d: string): string => d === "" ? "" : d + "/";
  const oldID = dragNode.key as string;
  const into = node.key as string;
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
  case database.Kind.HTTP:  return [Method[req.SubKind as keyof typeof Method], "lime"];
  case database.Kind.SQL:   return [Database[req.SubKind as keyof typeof Database], "bluewhite"];
  case database.Kind.GRPC:  return ["GRPC", "cyan"];
  case database.Kind.JQ:    return ["JQ", "violet"];
  case database.Kind.REDIS: return ["REDIS", "red"];
  case database.Kind.MD:    return ["MD", "blue"];
  }
}
function renderSuffix(info: {option: TreeOption}): VNodeChild {
  const option = info.option;
  const id = option.key as string;
  return m(NDropdown, {
    trigger: "click", // "hover",
    on: {select: (key: string | number) => {
      console.log(key);
      // message.info(String(key))
    }},
    options: [
      {
        label: "Rename",
        key: "rename",
        icon: () => m(NIcon, {component: m("EditOutlined")}),
        props: {
          // onclick: () => renameInit(id),
        }
      },
      {
        label: "Duplicate",
        key: "duplicate",
        icon: () => m(NIcon, {component: m("CopySharp")}),
        props: {
          onclick: () => {
            store.duplicate(id);
          }
        }
      },
      {
        label: "Copy as curl",
        key: "copy-as-curl",
        icon: () => m(NIcon, {component: m("ContentCopyFilled")}),
        show: store.requests[id]?.Kind === "http",
        props: {
          onclick: () => {
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
          }
        }
      },
      {
        label: "Delete",
        key: "delete",
        icon: () => m(NIcon, {color: "red", component: m("DeleteOutlined")}),
        props: {
          onclick: () => {
            store.deleteRequest(id);
          },
        },
      },
    ],
  }, m(NIcon, {component: m(DownOutlined)}));
}

const CommandFooter = m("ul", {class: "command-palette-commands"}, [
  m("li", [
    m("kbd", {class: "command-palette-commands-key"},
      m("svg", {width: "15", height: "15", "aria-label": "Enter key", role: "img"},
        m("g", {
          fill: "none",
          stroke: "currentColor",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          "stroke-width": 1.2,
          },
          m("path", {d: "M12 3.53088v3c0 1-1 2-2 2H4M7 11.53088l-3-3 3-3"}),
        )
      )
    ),
    m("span", {class: "command-palette-Label"}, "to select"),
  ]),
  m("li", [
    m("kbd", {class: "command-palette-commands-key"},
      m("svg", {width: "15", height: "15", "aria-label": "Arrow down", role: "img"},
        m("g", {
          fill: "none",
          stroke: "currentColor",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          "stroke-width": 1.2,
          },
          m("path", {d: "M7.5 3.5v8M10.5 8.5l-3 3-3-3"}),
        )
      )
    ),
    m("kbd", {class: "command-palette-commands-key"},
      m("svg", {width: "15", height: "15", "aria-label": "Arrow up", role: "img"},
        m("g", {
          fill: "none",
          stroke: "currentColor",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          "stroke-width": 1.2,
          },
          m("path", {d: "M7.5 11.5v-8M10.5 6.5l-3-3-3 3"}),
        )
      )
    ),
    m("span", {class: "command-palette-Label"}, "to navigate"),
  ]),
  m("li", [
    m("kbd", {class: "command-palette-commands-key"},
      m("svg", {width: "15", height: "15", "aria-label": "Escape key", role: "img"},
        m("g", {
          fill: "none",
          stroke: "currentColor",
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          "stroke-width": 1.2,
          },
          m("path", {d: "M13.6167 8.936c-.1065.3583-.6883.962-1.4875.962-.7993 0-1.653-.9165-1.653-2.1258v-.5678c0-1.2548.7896-2.1016 1.653-2.1016.8634 0 1.3601.4778 1.4875 1.0724M9 6c-.1352-.4735-.7506-.9219-1.46-.8972-.7092.0246-1.344.57-1.344 1.2166s.4198.8812 1.3445.9805C8.465 7.3992 8.968 7.9337 9 8.5c.032.5663-.454 1.398-1.4595 1.398C6.6593 9.898 6 9 5.963 8.4851m-1.4748.5368c-.2635.5941-.8099.876-1.5443.876s-1.7073-.6248-1.7073-2.204v-.4603c0-1.0416.721-2.131 1.7073-2.131.9864 0 1.6425 1.031 1.5443 2.2492h-2.956"}),
        )
      )
    ),
    m("span", {class: "command-palette-Label"}, "to close"),
  ]),
]);

let commandBarNewRequestKindVisible = false;
let commandBarVisible = false;
let commandBarOpenVisible = false;
const items = [
  {
    label: "Requests",
    items: [
      {
        label: "Create new",
        shortcut: ["Ctrl", "N"],
        perform: () => {
          commandBarVisible = false;
          commandBarNewRequestKindVisible = true;
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
          commandBarOpenVisible = true;
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
const openItems = () => {
  return Object.entries(store.requests).map(([id, preview]) => ({
    id: id,
    kind: preview.Kind,
  }));
};
const anyModalIsOpen = () => newRequestName !== null || renameID !== null;
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
  el: HTMLElement;
}

type panelkaState = {id: string};

const f = {
  [database.Kind.HTTP ]: RequestHTTP,
  [database.Kind.SQL  ]: RequestSQL,
  [database.Kind.GRPC ]: RequestGRPC,
  [database.Kind.JQ   ]: RequestJQ,
  [database.Kind.REDIS]: RequestRedis,
  [database.Kind.MD   ]: RequestMD,
} as {[key in database.Kind]: (id: string, show: () => boolean) => ComponentTypes};
const panelkaFactory = (
  container: ComponentContainer,
  {id}: panelkaState,
): Panelka => {
  const el = container.element;
  let show_request = true;
  container.on("tab", (tab: Tab): void => {
    const eye = document.createElement("span");
    m.mount(eye, {view: () => m(NIcon, {
      component: show_request ? m(Eye) : m(EyeClosed),
      color: "grey",
    })});
    eye.onmouseover = () => eye.style.color = "#ff0000";
    eye.onmouseout = () => eye.style.color = "grey";
    eye.title = "Hide request";
    eye.onclick = () => {
      show_request = !show_request;
      eye.title = show_request ? "Hide request" : "Show request";
      m.redraw();
    };
    tab.element.prepend(eye);
  });
  if (store.requests[id]) {
    m.mount(el, f[store.requests[id].Kind](id, () => show_request));
  }
  return {el};
}

export default function() {
  let sidebarTab = "tab-nav-collection";
  // TODO: reverse history order
  const history = (() => {
    const id = store.requestID();
    return id ? use_request(id).history : [];
  })();

  let goldenLayout: GoldenLayout;

  return {
    onupdate(vnode: VnodeDOM<{}, any>) {
      if (goldenLayout) {
        return;
      }

      const layoutElement = vnode.dom.querySelector("#layoutContainer")!;
      goldenLayout = new GoldenLayout(layoutElement as HTMLElement);
      goldenLayout.resizeWithContainerAutomatically = true;
      goldenLayout.registerComponentFactoryFunction("MyComponent", (container, state, _) => panelkaFactory(container, state as panelkaState));
      goldenLayout.loadLayout(store.layoutConfig);
      goldenLayout.on("stateChanged", () => {
        updateLocalstorageTabs();
      })
      store.layout = goldenLayout;
    },
    view() {
      return m("div", {style: {height: "100%", width: "100%"}}, [
        m(Command.Dialog, {
          visible: commandBarVisible,
          theme: "algolia",
          on: {close: () => commandBarVisible = false},
          header: m(Command.Input, {placeholder: "Type a command or search..."}),
          body: m(Command.List, [
            m(Command.Empty, "No results found."),
            ...items.map(group =>
              m(Command.Group, {heading: group.label}, group.items.map(item =>
                m(Command.Item, {
                  value: item.label,
                  shortcut: item.shortcut,
                  on: {select: item.perform},
                }, [
                  m("div", item.label),
                  m("div", {
                    "command-linear-shortcuts": true,
                    class: "hidden",
                    style: {
                      color: "var(--gray10)",
                      "align-items": "center",
                      display: item.shortcut !== undefined ? "block" : "none",
                    },
                  }, item.shortcut?.flatMap((k, i) => [
                    i !== 0 && m("div", {style: {padding: "0px 2px"}}, "+"),
                    m("kbd", k),
                  ])),
                ]))
              ),
            ),
          ]),
          footer: CommandFooter,
        }),
        m(Command.Dialog, {
          visible: commandBarNewRequestKindVisible,
          theme: "algolia",
          on: {close: () => commandBarNewRequestKindVisible = false},
          header: m(Command.Input, {placeholder: "Enter kind of new reqeust"}),
          body: m(Command.List, [
            m(Command.Empty, "No kinds found."),
            ...Kinds.map(kind =>
              m(Command.Item, {
                value: kind,
                on: {select: () => {
                  newRequestKind = kind;
                  commandBarNewRequestKindVisible = false;
                }},
              }, kind),
            ),
          ]),
          footer: CommandFooter,
        }),
        m(Command.Dialog, {
          visible: commandBarOpenVisible,
          theme: "algolia",
          on: {close: () => commandBarOpenVisible = false},
          header: m(Command.Input, {placeholder: "Type or search request id to open"}),
          body: m(Command.List, [
            m(Command.Empty, "No requests found."),
            ...openItems().map(item =>
              m(Command.Item, {
                value: item.id,
                on: {select: () => {
                  commandBarOpenVisible = false;
                  selectRequest(item.id);
                }},
              }, m("div", `[${item.kind}] ${item.id}`))),
          ]),
          footer: CommandFooter,
        }),
        m("div", {
          class: "h100",
          style: {
            display: "grid",
            "grid-template-columns": `${sidebarHidden ? "3em" : "300px"} 6fr`,
          },
        }, [
          m("aside", {
            style: {
              overflow: "auto",
              color: "rgba(255, 255, 255, 0.82)",
              "background-color": "rgb(24, 24, 28)",
              display: "grid",
              "grid-template-rows": "auto 3em",
              height: "100%",
            },
          }, [
            sidebarHidden ? m("div") : m(NTabs, {
              value: sidebarTab,
              type: "card",
              size: "small",
              on: {update: id => sidebarTab = id},
              tabs: [
                {
                  id: "tab-nav-collection",
                  name: "Collection",
                  style: {
                    overflow: "auto",
                    display: "grid",
                    "padding-top": "0px",
                    "grid-template-rows": "2.5em auto",
                    height: "100%",
                  },
                  elem: [
                    m(NModal, {
                      show: newRequestKind !== null,
                      preset: "dialog",
                      title: "Create request",
                      text: {positive: "Create", negative: "Cancel"},
                      on: {
                        close: createCancel,
                        positive_click: create,
                        negative_click: createCancel,
                      },
                    }, [
                      m(NInput, {
                        value: newRequestName,
                        on: {update: (value: string) => newRequestName = value},
                      }),
                    ]),
                    m(NModal, {
                      show: renameID !== null,
                      preset: "dialog",
                      title: "Rename request",
                      text: {positive: "Rename", negative: "Cancel"},
                      on: {
                        close: renameCancel,
                        positive_click: rename,
                        negative_click: renameCancel,
                      },
                    }, [
                      m(NInput, {
                        value: renameValue,
                        on: {update: (value: string) => renameValue = value},
                      }),
                    ]),
                    m(NSelect, {
                      value: newRequestKind as string,
                      on: {update: (value: string /*Kind*/) => {
                        newRequestKind = value as Kind;
                        create();
                      }},
                      placeholder: "New",
                      clearable: true,
                      options: Kinds.map((kind: database.Kind) => ({label: kind.toUpperCase(), value: kind})),
                    }),
                    m(NScrollbar, {trigger: "none"}, [
                      m(NTree, {
                        "block-line": true,
                        "expand-on-click": true,
                        "selected-keys": [/*(store.tabs.value ? store.tabs.value.map.list[store.tabs.value.index] : "")*/],
                        "show-line": true,
                        data: treeData(),
                        draggable: true,
                        "default-expanded-keys": expandedKeys,
                        on: {
                          "update:expanded-keys": (keys: string[]) => {expandedKeys = keys},
                          drop: drag,
                        },
                        "node-props": ({option}: {option: TreeOption}): {onclick: () => void} => {
                          return {
                            onclick() {
                              const id = option.key;
                              if (!option.children && !option.disabled) {
                                selectRequest(id);
                              }
                            }
                          }
                        },
                        "render-prefix": (info: {option: TreeOption, checked: boolean, selected: boolean}): VNodeChild => {
                          const option = info.option;
                          if (option.key === undefined) {
                            return null;
                          }

                          const req = store.requests[option.key];
                          if (req === undefined) {
                            return null;
                          }
                          const [method, color] = badge(req);
                          return m(NTag, {
                            type: (req.Kind === "http" ? "success" : "info") as "success" | "info" | "warning",
                            style: {width: "4em", "justify-content": "center", color: color},
                            size: "small",
                          }, method)
                        },
                        "render-suffix": renderSuffix,
                      }),
                    ]),
                  ],
                },
                {
                  id: "tab-nav-history",
                  name: "History",
                  style: {flex: 1},
                  elem: (() => {
                    if (store.requestID() === null)
                    return m(NEmpty, {
                      description: "No request picked yet",
                      class: "h100",
                      style: {"justify-content": "center"},
                    });
                    if (history.length === 0)
                    return m(NEmpty, {
                      description: "No history yet",
                      class: "h100",
                      style: {"justify-content": "center"},
                    });
                    return m(NList, {hoverable: true, border: false}, history.map((r, i) =>
                      m(NListItem, {
                        key: i,
                        class: ["history-card", "card"].join(" "),
                        // on: {click: () => selectRequest(r.request.id)},
                      }, [
                        m("span", {style: {color: "grey"}, class: 'date'}, fromNow(r.sent_at)),
                      ]),
                    ));
                  })(),
                },
              ],
            }),
            !sidebarHidden ?
            m(NButton, {
              class: "h100",
              on: {click: () => {sidebarHidden = !sidebarHidden}},
              style: {display: "grid", "grid-template-columns": "1fr 1fr", "grid-column-gap": ".5em"},
            }, [
              m(NSpace, [
                m(NIcon, {component: m(DoubleLeftOutlined)}),
                "hide",
              ]),
            ]) :
            m(NButton, {
              class: "h100",
              on: {click: () => {sidebarHidden = !sidebarHidden}},
              style: {display: "grid", "grid-template-columns": "1fr 1fr", "grid-column-gap": ".5em"},
            }, [
              m(NSpace,
                m(NIcon, {component: m(DoubleRightOutlined)})
              ),
            ]),
          ]),
          m("div", {style: {color: "rgba(255, 255, 255, 0.82)", "background-color": "rgb(16, 16, 20)", overflow: "hidden", },}, [
            // (store.layoutConfig.root?.content ?? []).length === 0 ? m(NResult, {
            //   status: "info",
            //   title: "Pick request",
            //   description: "Pick request to see it, edit and send and do other fun things.",
            //   class: "h100",
            //   style: "align-content: center;",
            // }) :
            m("div", {id: "layoutContainer", style: {height: "100%", width: "100%"}}),
          ]),
        ]),
      ])
    },
  };
};
