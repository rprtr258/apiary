import {ComponentContainer, Tab} from "golden-layout";
import {database} from "../wailsjs/go/models.ts";
import {Kinds, HistoryEntry, Request} from "./types.ts";
import {m, setDisplay, Signal, signal} from "./utils.ts";
import {
  StateRequest, StateHTTPSourceEndpoint, StateSQLSourceTable,
  Store,
  get_request, handleCloseTab, updateLocalstorage, update_request, send, last_history_entry,
  store,
} from "./store.ts";
import notification from "./notification.ts";
import layout from "./layout.ts";
import {NInput} from "./components/input.ts";
import {NModal, NSplit} from "./components/layout.ts";
import {NIcon, NResult, NTag} from "./components/dataview.ts";
import {Eye, EyeClosed} from "./components/icons.ts";
import {CommandPalette, Item} from "./components/CommandPalette.ts";
import RequestTableViewer from "./components/TableView.ts";
import EndpointViewer from "./components/EndpointViewer.ts";
import {badge, sidebar, globalDropdown, newRequestKind, newRequestName, renameID, renameInit, renameValue, sidebarHidden} from "./Sidebar.ts";
import RequestHTTP from "./RequestHTTP.ts";
import RequestSQL from "./RequestSQL.ts";
import RequestGRPC from "./RequestGRPC.ts";
import RequestJQ from "./RequestJQ.ts";
import RequestRedis from "./RequestRedis.ts";
import RequestMD from "./RequestMD.ts";
import {css} from "./styles.ts";
import RequestSQLSource from "./RequestSQLSource.ts";
import RequestHTTPSource from "./RequestHTTPSource.ts";

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
  const newName = renameValue.value;
  switch (true) {
    case fromID === undefined && newName === undefined:
      notification.error({title: "Invalid request", content: "No request to rename"});
      return;
    case newName === undefined:
      notification.error({title: "Invalid request", content: "No new name"});
      return;
    case fromID === undefined:
      notification.error({title: "Invalid request", content: `No request to rename to ${newName}`});
      return;
  }

  store.rename(fromID, newName);
  renameCancel();
}

// TODO: fix editing request headers

const command_bar_new_request_kind_visible = signal(false);
const commandBarVisible = signal(false);
const command_bar_open_visible = signal(false);

function getCommandPaletteItems(): Item[] {
  const currentID = store.requestID();
  return [
    {
      label: "Requests",
      items: [
        {
          label: "Create new",
          shortcut: ["Ctrl", "N"],
          perform: () => {
            command_bar_new_request_kind_visible.update(() => true);
          },
        },
        {
          label: "Open",
          shortcut: ["Ctrl", "P"],
          perform: () => {
            command_bar_open_visible.update(() => true);
          },
        },
        ...(currentID !== null ? [
        {
          label: "Run",
          shortcut: ["Ctrl", "Enter"],
          perform: () => {
            send(currentID);
          },
        },
        {
          label: `Rename current (${store.requestNames[currentID]})`,
          shortcut: ["Ctrl", "R"],
          perform: () => {
            renameInit(currentID);
          },
        },
        {
          label: `Duplicate current (${store.requestNames[currentID]})`,
          perform: () => {
            store.duplicate(currentID);
          },
        },
        {
          label: `Delete current (${store.requestNames[currentID]})`,
          perform: () => {
            store.deleteRequest(currentID);
          },
        }] : []),
      ],
    },
    ...(currentID !== null ? [{
      label: "Tabs",
      items: [
        {
          label: "Next tab",
          shortcut: ["Ctrl", "PgDown"],
          perform: () => {
            store.navigateToNextTab();
          },
        },
        {
          label: "Previous tab",
          shortcut: ["Ctrl", "PgUp"],
          perform: () => {
            store.navigateToPreviousTab();
          },
        },
        {
          label: "Close tab",
          shortcut: ["Ctrl", "W"],
          perform: () => {
            const currentID = store.requestID();
            if (currentID === null) return;
            handleCloseTab(currentID);
          },
        },
        {
          label: "Move tab right",
          shortcut: ["Ctrl", "Shift", "PgDown"],
          perform: () => {
            store.moveTabRight();
          },
        },
        {
          label: "Move tab left",
          shortcut: ["Ctrl", "Shift", "PgUp"],
          perform: () => {
            store.moveTabLeft();
          },
        },
      ],
    }] : []),
    {
      items: [
        {
          label: "Command Palette",
          shortcut: ["Ctrl", "Shift", "P"],
          perform: () => {
            // TODO: implement
          },
        },
        {
          label: "Create new directory",
          perform: () => {
            // TODO: implement
          },
        },
      ],
    },
  ].flatMap(group => group.items
    .map(item => ({
      label: item.label,
      shortcut: item.shortcut,
      perform: item.perform,
      group: group.label,
    })),
  );
}

// Create command palettes
const mainCommandPalette = CommandPalette({
  items: getCommandPaletteItems,
  placeholder: "Type a command or search...",
  on: {close: () => commandBarVisible.update(() => false)},
});
commandBarVisible.sub(function*() {
  while (true) mainCommandPalette.visible = yield;
}());

const newRequestKindPalette = CommandPalette({
  items: () => Kinds.map(kind => ({
    label: kind,
    perform: () => {
      newRequestKind.update(() => kind);
    },
  })),
  placeholder: "Enter kind of new request",
  on: {close: () => command_bar_new_request_kind_visible.update(() => false)},
});
command_bar_new_request_kind_visible.sub(function*() {
  while (true) newRequestKindPalette.visible = yield;
}());

// Function to compute open request items
const getOpenRequestItems = (): Item[] => Object
  .entries(store.requests)
  .map(([id, preview]) => [id, preview, badge(preview.Kind)] as const)
  .map(([id, preview, [method, color]]) => ({
    label: store.requestNames[id], // TODO: show full path, preload store.requests2, fix ebanij rot kazino
    group: preview.Kind,
    prefix: NTag({
      type: preview.Kind === database.Kind.HTTP ? "success" : "info",
      style: {
        minWidth: "4em",
        justifyContent: "center",
        display: "flex",
        alignItems: "center",
        color: color,
        fontWeight: "bold",
      },
    }, method),
    perform: () => store.selectRequest(id),
  }));

const openRequestPalette = CommandPalette({
  items: getOpenRequestItems,
  placeholder: "Type or search request id to open",
  on: {close: () => command_bar_open_visible.update(() => false)},
});
command_bar_open_visible.sub(function*() {
  while (true) openRequestPalette.visible = yield;
}());

type Panelka = {
  el: HTMLElement,
};

type Frame = {
  loaded(r: get_request): void,
  push_history_entry?(he: HistoryEntry): void, // show last history entry
  unmount(): void,
};

function createFrame(
  el: HTMLElement,
  kind: database.Kind,
  show_request: Signal<boolean>,
  on: {update: (patch: Partial<Request>) => Promise<void>, send: () => Promise<void>},
  eye: HTMLElement,
): Frame {
  switch (kind) {
    case database.Kind.HTTP: return RequestHTTP(el, show_request, on);
    case database.Kind.SQL: return RequestSQL(el, show_request, on);
    case database.Kind.GRPC: return RequestGRPC(el, show_request, on);
    case database.Kind.JQ: return RequestJQ(el, show_request, on);
    case database.Kind.REDIS: return RequestRedis(el, show_request, on);
    case database.Kind.MD: return RequestMD(el, show_request, on);
    case database.Kind.SQLSource:
      setDisplay(eye, false); // TODO: dont draw eye in the first place?
      return RequestSQLSource(el, {update: on.update});
    case database.Kind.HTTPSource:
      setDisplay(eye, false);
      return RequestHTTPSource(el, {update: on.update});
  }
}

const panelkaFactory = (
  container: ComponentContainer,
  {id}: StateRequest,
): Panelka => {
  const el = container.element;
  const show_request = signal(true);
  let eye_unsub = () => {};
  const eye = m("span", {
    title: "Hide request",
    onclick: () => {
      show_request.update(b => !b);
    },
  });

  container.on("tab", (tab: Tab): void => {
    eye_unsub = show_request.sub(function*(): Generator<undefined, never, boolean> {
      while (true) {
        const value = yield;
        eye.title = value ? "Hide request" : "Show request";
        eye.replaceChildren(NIcon({
          component: value ? Eye : EyeClosed,
          class: "highlight-red",
        }));
      }
    }());

    tab.element.prepend(eye);

    // Track when this tab becomes active
    container.on("show", () => {
      store.activeComponentID = id;
    });
    container.on("destroy", () => {
      eye_unsub();
      frame_unsub();
      // Clear active component ID if this was the active component
      if (store.activeComponentID === id) {
        store.activeComponentID = null;
      }
    });

    // TODO: ebanij rot etogo kazino, we have to use timeout for now, since request is not yet loaded (???)
    setTimeout(() => {
      if (!(id in store.requests2)) {
        tab.componentItem.close();
        return;
      }
      const req = store.requests2[id];
      tab.setTitle(req.request.path);
    }, 1000);
  });
  const frame: Frame = createFrame(
    el,
    store.requests[id].Kind,
    show_request,
    {
      update: (patch: Partial<Request>) => update_request(id, patch),
      send: () => send(id).then(_ => {
        frame.push_history_entry?.(last_history_entry(store.requests2[id])!);
      }),
    },
    eye,
  );
  const frame_unsub = () => frame.unmount();
  get_request(id).then(r => r !== null && frame.loaded(r));
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

  const el_layout = m("div", {
    id: "layoutContainer",
    class: css(`
      height: 100%;
      width: 100%;
    `),
  });

  const el_main = m("div", {
    class: css(`
      color: var(--color-text-primary);
      background-color: var(--color-bg-primary);
      overflow: hidden; /* TODO: fix hiding golden-layout element */
      height: 100%;
    `),
  }, [
    el_empty_state,
    el_layout,
  ]);

  const app_container = NSplit(sidebar, el_main, {
    direction: "horizontal",
    sizes: ["var(--sidebar-width)", "1fr"],
    snap: 100,
  }).element;

  sidebarHidden.sub(function*(): Generator<undefined, never, boolean> {
    yield;
    while (true) {
      const sidebarHidden = yield;
      app_container.style.gridTemplateColumns = sidebarHidden
        ? "var(--sidebar-width-collapsed) 5px 1fr"
        : "var(--sidebar-width) 5px 1fr";
    }
  }());

  layout.init(el_layout, store.layoutConfig, {
    "MyComponent": (container, state) => panelkaFactory(container, state as StateRequest),
    "TableViewer": (container, state) => RequestTableViewer(container, state as StateSQLSourceTable),
    "EndpointViewer": (container, state) => EndpointViewer(container, state as StateHTTPSourceEndpoint),
  }, () => {
    update_empty_state();
    updateLocalstorage();
  });
  const update_empty_state = () => {
    setDisplay(el_empty_state, layout.isEmpty);
  };
  update_empty_state();

  const inputCreate = NInput({
    on: {update: (value: string) => newRequestName.update(() => value)},
    style: {
      width: "100%",
      boxSizing: "border-box",
      padding: "var(--spacing-sm)",
      backgroundColor: "var(--color-bg-surface)",
      color: "var(--color-text-primary)",
      border: "1px solid var(--color-border)",
      borderRadius: "var(--border-radius-md)",
    },
  });
  const modalCreate = NModal({
    title: "Create request",
    text: {positive: "Create", negative: "Cancel"},
    on: {
      close: createCancel,
      positive_click: create,
      negative_click: createCancel,
      show: () => {
        // Focus the input when modal is shown
        inputCreate.focus();
      },
    },
  }, inputCreate);
  const inputRename = NInput({
    on: {update: (value: string) => renameValue.update(() => value)},
    style: {
      width: "100%",
      boxSizing: "border-box",
      padding: "var(--spacing-sm)",
      backgroundColor: "var(--color-bg-surface)",
      color: "var(--color-text-primary)",
      border: "1px solid var(--color-border)",
      borderRadius: "var(--border-radius-md)",
    },
  });
  const modalRename = NModal({
    title: "Rename request",
    text: {positive: "Rename", negative: "Cancel"},
    on: {
      close: renameCancel,
      positive_click: rename,
      negative_click: renameCancel,
      show: () => {
        inputRename.value = store.requestNames[renameID.value!];
        // Focus the input when modal is shown
        inputRename.focus();
      },
    },
  }, inputRename);
  newRequestKind.sub(function*(): Generator<undefined, never, database.Kind | undefined> {
    let shown = true; // NOTE: to trigger first call to set it to false
    while (true) {
      const newRequestKind = yield;
      if (newRequestKind === undefined) {
        if (shown) {
        modalCreate.hide();
        shown = false;
        }
        continue;
      }

      if (!shown) {
        const newName = new Date().toUTCString();
        inputCreate.value = newName;
        newRequestName.update(() => newName);
        modalCreate.show();
        shown = true;
      }
    }
  }());
  renameID.sub(function*(): Generator<undefined, never, string | undefined> {
    let shown = true; // NOTE: to trigger first call to set it to false
    while (true) {
      const renameID = yield;
      if (renameID === undefined) {
        if (shown) {
          modalRename.hide();
          shown = false;
        }
        continue;
      }

      inputRename.value = store.requestsTree.value.IDs[renameID];
      if (!shown) {
        modalRename.show();
        shown = true;
      }
    }
  }());

  document.body.appendChild(globalDropdown.el);

  // Check if any modal is open
  const anyModalIsOpen = () =>
    newRequestName.value !== undefined ||
    renameID.value !== undefined ||
    commandBarVisible.value ||
    command_bar_new_request_kind_visible.value ||
    command_bar_open_visible.value;

  // Global keyboard event handling
  const handleKeyDown = (e: KeyboardEvent) => {
    // Don't handle keyboard events if user is typing in an input or textarea
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Check for Ctrl+Shift+P - Toggle command palette
    if (e.key === "P" && !e.altKey && e.ctrlKey && e.shiftKey && !e.metaKey) {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      commandBarVisible.update(v => !v);
      return;
    }

    // Check for Ctrl+P - Open request palette
    if (e.key === "p" && !e.altKey && e.ctrlKey && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      command_bar_open_visible.update(v => !v);
      return;
    }

    // Check for Ctrl+N - Create new request
    if (e.key === "n" && !e.altKey && e.ctrlKey && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      command_bar_new_request_kind_visible.update(() => true);
      return;
    }

    // Check for Ctrl+R - Rename current request
    if (e.key === "r" && e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      const currentID = store.requestID();
      if (currentID === null) {
        return;
      }
      renameInit(currentID);
    }

    // Check for Escape - Close all modals
    if (e.key === "Escape") {
      e.preventDefault();
      // Don't handle Escape if command palette is open - let it handle its own Escape
      if (commandBarVisible.value || command_bar_new_request_kind_visible.value || command_bar_open_visible.value) {
        // Command palette will handle its own Escape key
        return;
      }

      // Close other modals (rename, create)
      if (newRequestName.value === undefined && renameID.value === undefined) {
        return;
      }
      renameCancel();
      createCancel();
    }

    // Check for Ctrl+Enter - Run current request
    if (e.key === "Enter" && e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      const currentID = store.requestID();
      if (currentID === null) {
        return;
      }
      send(currentID);
    }

    // Check for Ctrl+W - Close tab
    if (e.key === "w" && e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      const currentID = store.requestID();
      if (currentID === null) {
        return;
      }
      handleCloseTab(currentID);
    }

    // Check for Ctrl+PgDown - Next tab
    if (e.key === "PageDown" && e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      store.navigateToNextTab();
      return;
    }

    // Check for Ctrl+PgUp - Previous tab
    if (e.key === "PageUp" && e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      store.navigateToPreviousTab();
      return;
    }

    // Check for Ctrl+Shift+PgDown - Move tab right
    if (e.key === "PageDown" && e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      store.moveTabRight();
      return;
    }

    // Check for Ctrl+Shift+PgUp - Move tab left
    if (e.key === "PageUp" && e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      store.moveTabLeft();
      return;
    }
  };

  // Add global keyboard event listener
  document.addEventListener("keydown", handleKeyDown);

  root.append(m("div", {class: "h100", style: {
    width: "100%",
  }},
    modalCreate.element,
    modalRename.element,
    mainCommandPalette.el,
    newRequestKindPalette.el,
    openRequestPalette.el,
    app_container,
  ));
};
