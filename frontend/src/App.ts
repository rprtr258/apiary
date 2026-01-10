import {ComponentContainer, GoldenLayout, Tab} from "golden-layout";
import {NInput} from "./components/input.ts";
import {NModal, NSplit} from "./components/layout.ts";
import {NIcon, NResult} from "./components/dataview.ts";
import {Eye, EyeClosed} from "./components/icons.ts";
import RequestHTTP from "./RequestHTTP.ts";
import RequestSQL from "./RequestSQL.ts";
import RequestGRPC from "./RequestGRPC.ts";
import RequestJQ from "./RequestJQ.ts";
import RequestRedis from "./RequestRedis.ts";
import RequestMD from "./RequestMD.ts";
import {get_request, store, notification, handleCloseTab, updateLocalstorageTabs, update_request, send, last_history_entry, Store} from "./store.ts";
import {Kinds, HistoryEntry, Request} from "./api.ts";
import {database} from "../wailsjs/go/models.ts";
import Command from "./components/CommandPalette.ts";
import {m, setDisplay, signal} from "./utils.ts";
import RequestSQLSource from "./RequestSQLSource.ts";
import {globalDropdown, newRequestKind, newRequestName, renameID, renameInit, renameValue, Sidebar} from "./Sidebar.ts";

function create() {
  const kind = newRequestKind.value!;
  const name = newRequestName.value!;
  store.createRequest(name, kind);
  createCancel();
  // TODO: show new request in list
}
function createCancel() {
  newRequestKind.update(() => undefined);
  newRequestName.update(() => undefined);
}

function renameCancel() {
  renameID.update(() => undefined);
  renameValue.update(() => undefined);
}
function rename() {
  const fromID = renameID.value;
  if (fromID === undefined) {
    notification.error({title: "Invalid request", content: `No request to rename: ${renameID.value} -> ${renameValue.value}`});
    return;
  }

  const toID = renameValue.value;
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
          if (currentID === null) return;
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
          if (currentID === null) return;
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
  push_history_entry?(he: HistoryEntry): void, // show last history entry
  unmount(): void,
};
const panelkaFactory = (
  container: ComponentContainer,
  {id}: panelkaState,
): Panelka => {
  const el = container.element;
  const show_request = signal(true);
  let eye_unsub = () => {};
  let frame_unsub = () => {};
  const eye = m("span", {
    title: "Hide request",
    onclick: () => {
      show_request.update(b => !b);
    },
  }, NIcon({
    component: show_request.value ? Eye : EyeClosed,
    class: "highlight-red",
  }));

  container.on("tab", (tab: Tab): void => {
    eye_unsub = show_request.sub(value => {
      eye.title = value ? "Hide request" : "Show request";
      eye.replaceChildren(NIcon({
        component: value ? Eye : EyeClosed,
        class: "highlight-red",
      }));
    }, true);

    tab.element.prepend(eye);
    container.on("destroy", () => {
      eye_unsub();
      frame_unsub();
    });
    // TODO: ebanij rot etogo kazino, we have to use timeout for now, since request is not yet loaded (???)
    setTimeout(() => {
      if (!(id in store.requests2)) {
        tab.componentItem.close();
        return;
      }
      const req = store.requests2[id];
      tab.setTitle(req.request.path);
    }, 100);
  });
  if (id in store.requests) {
    const on = {
      update: (patch: Partial<Request>) => update_request(id, patch),
      send: () => send(id).then(_ => {
        frame.push_history_entry?.(last_history_entry(store.requests2[id])!);
      }),
    };
    const frame: Frame = (() => {
      switch (store.requests[id].Kind) {
        case database.Kind.HTTP: return RequestHTTP(el, show_request, on);
        case database.Kind.SQL: return RequestSQL(el, show_request, on);
        case database.Kind.GRPC: return RequestGRPC(el, show_request, on);
        case database.Kind.JQ: return RequestJQ(el, show_request, on);
        case database.Kind.REDIS: return RequestRedis(el, show_request, on);
        case database.Kind.MD: return RequestMD(el, show_request, on);
        case database.Kind.SQLSource:
          setDisplay(eye, false); // TODO: dont draw eye in the first place?
          return RequestSQLSource(el, {update: on.update});
      }
    })();
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

  const sidebarHidden = signal(false);
  const {el: el_aside} = Sidebar(sidebarHidden);
  sidebarHidden.sub(sidebarHidden => {
    app_container.style.gridTemplateColumns = sidebarHidden ? "3em 5px 1fr" : "300px 5px 1fr";
  }, false);

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

  const modalCreate = NModal({
    title: "Create request",
    text: {positive: "Create", negative: "Cancel"},
    on: {
      close: createCancel,
      positive_click: create,
      negative_click: createCancel,
    },
  }, NInput({
    value: newRequestName.value,
    on: {update: (value: string) => newRequestName.update(() => value)},
    style: {width: "100%", boxSizing: "border-box", padding: "0.5em"},
  }));
  const inputRename = NInput({
    value: renameValue.value,
    on: {update: (value: string) => renameValue.update(() => value)},
    style: {width: "100%", boxSizing: "border-box", padding: "0.5em"},
  });
  const modalRename = NModal({
    title: "Rename request",
    text: {positive: "Rename", negative: "Cancel"},
    on: {
      close: renameCancel,
      positive_click: rename,
      negative_click: renameCancel,
    },
  }, inputRename);
  const updateModals = () => {
    if (newRequestKind.value !== undefined) {
      if (newRequestName.value !== undefined) {
        newRequestName.update(() => new Date().toUTCString());
      }
      modalCreate.show();
    } else
      modalCreate.hide();
    if (renameID.value !== undefined) {
      inputRename.value = store.requestsTree.value.IDs[renameID.value];
      modalRename.show();
    } else
      modalRename.hide();
  };
  newRequestKind.sub(updateModals, false);
  renameID.sub(updateModals, false);
  updateModals();


  const el_main = m("div", {
    style: {
      color: "rgba(255, 255, 255, 0.82)",
      backgroundColor: "rgb(16, 16, 20)",
      overflow: "hidden",
    }}, [
      el_empty_state,
      el_layout,
    ]);
  const app_container = NSplit(el_aside, el_main, {direction: "horizontal", sizes: ["300px", "1fr"]}).element;

  document.body.appendChild(globalDropdown.el);

  root.append(m("div", {class: "h100", style: {
    width: "100%",
  }},
    modalCreate.element,
    modalRename.element,
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
              newRequestKind.update(() => kind);
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
