import {ComponentContainer, LayoutConfig, Tab} from "./layout/types.ts";
import * as t from "@/types.ts";
import {Kinds, Request} from "@/types.ts";
import {clamp, m, setDisplay, signal} from "./lib/utils.ts";
import notification from "./lib/notification.ts";
import {
  get_request, updateLocalstorage, update_request, send,
  StateRequest, Store, store,
} from "./store.ts";
import layout from "./layout.ts";
import {css} from "./lib/styles.ts";
import {cls} from "./layout/styles.ts";
import {NInput} from "./components/input.ts";
import {NModal, NSplit} from "./components/layout.ts";
import {NEmpty, NIcon, NTag} from "./components/dataview.ts";
import {Eye, EyeClosed} from "./components/icons.ts";
import {CommandPalette, Item} from "./components/CommandPalette.ts";
import {sidebar, globalDropdown, newRequestKind, newRequestName, renameID, renameInit, renameValue, sidebarHidden} from "./Sidebar.ts";
import {plugins, pluginsByKind} from "./plugins/index.ts";
import {sourceBadge} from "./plugins/source.ts";

function create() {
  const kind = newRequestKind.value!;
  const name = newRequestName.value!;
  store.createRequest(name, kind);
  createCancel();
  // TODO: show new request in list
}
function createCancel() {
  newRequestKind.value = undefined;
  newRequestName.value = undefined;
}

function renameCancel() {
  renameID.value = undefined;
  renameValue.value = undefined;
}
function rename() {
  const fromID = renameID.value;
  const newName = renameValue.value;
  switch (true) {
    case fromID === undefined && newName === undefined:
      notification("error", "Invalid request", {content: "No request to rename"});
      return;
    case newName === undefined:
      notification("error", "Invalid request", {content: "No new name"});
      return;
    case fromID === undefined:
      notification("error", "Invalid request", {content: `No request to rename to ${newName}`});
      return;
  }

  store.rename(fromID, newName);
  renameCancel();
}

const command_bar_new_request_kind_visible = signal(false);
const command_bar_draft_kind_visible = signal(false);
const commandBarVisible = signal(false);
const command_bar_open_visible = signal(false);

// Pale-gray tab title while the tab's request is a draft; applied to the tab
// element with a descendant selector so eye/close buttons keep their normal colors
const draftTabClass = css.raw(` .${cls.tabTitle} { color: #74747a; }`);

export function getCommandPaletteItems(): Item[] {
  const currentID = store.requestID();
  return [
    {
      label: "Requests",
      items: [
        {
          label: "Create new",
          shortcut: ["Ctrl", "N"],
          perform: () => {
            command_bar_new_request_kind_visible.value = true;
          },
        },
        {
          label: "Create new directory",
          perform: () => {
            // TODO: implement
          },
        },
        {
          label: "New draft",
          perform: () => {
            command_bar_draft_kind_visible.value = true;
          },
        },
        {
          label: "Open",
          shortcut: ["Ctrl", "P"],
          perform: () => {
            command_bar_open_visible.value = true;
          },
        },
        ...(currentID !== null ? (() => {
          const name = t.pathToName(store.requests[currentID].path);
          const isDraft = store.isDraft(currentID);
          return [
            {
              label: "Run",
              shortcut: ["Ctrl", "Enter"],
              perform: () => {
                activeFrameSend?.();
              },
            },
            {
              label: isDraft ? `Save current (${name})` : `Rename current (${name})`,
              shortcut: isDraft ? ["Ctrl", "S"] : ["Ctrl", "R"],
              perform: () => {
                renameInit(currentID);
              },
            },
            isDraft ? {
              label: "Duplicate current draft",
              perform: () => {
                if (!(currentID in store.requests2)) {
                  notification("error", "Duplicate failed", {content: "Draft data is not loaded"});
                  return;
                }
                const req = store.requests2[currentID].request;
                const {id: _id, path: _path, kind: _kind, ...data} = req;
                store.createDraft(req.kind, data);
              },
            } : {
              label: `Duplicate current (${name})`,
              perform: () => {
                store.duplicate(currentID);
              },
            },
            {
              label: isDraft ? "Delete current draft" : `Delete current (${name})`,
              perform: () => {
                store.deleteRequest(currentID);
              },
            },
          ];
        })() : []),
      ],
    },
    ...(currentID !== null ? [{
      label: "Tabs",
      items: [
        {
          label: "Next tab",
          shortcut: ["Ctrl", "PgDown"],
          perform: () => {
            store.navigateToTab("next");
          },
        },
        {
          label: "Previous tab",
          shortcut: ["Ctrl", "PgUp"],
          perform: () => {
            store.navigateToTab("prev");
          },
        },
        {
          label: "Close tab",
          shortcut: ["Ctrl", "W"],
          perform: () => {
            layout.instance?.closeFocused();
          },
        },
        {
          label: "Move tab right",
          shortcut: ["Ctrl", "Shift", "PgDown"],
          perform: () => {
            store.moveTab("right");
          },
        },
        {
          label: "Move tab left",
          shortcut: ["Ctrl", "Shift", "PgUp"],
          perform: () => {
            store.moveTab("left");
          },
        },
      ],
    }] : []),
    ...(currentID !== null ? [{
      label: "Layout",
      items: [
        {
          label: "Move pane to next group",
          shortcut: ["Alt", "→"],
          perform: () => {
            store.movePane("right");
          },
        },
        {
          label: "Move pane to previous group",
          shortcut: ["Alt", "←"],
          perform: () => {
            store.movePane("left");
          },
        },
        {
          label: "Move pane to group above",
          shortcut: ["Alt", "↑"],
          perform: () => {
            store.movePane("up");
          },
        },
        {
          label: "Move pane to group below",
          shortcut: ["Alt", "↓"],
          perform: () => {
            store.movePane("down");
          },
        },
      ],
    }] : []),
    {
      items: [
        {
          label: `${sidebarHidden.value ? "Show" : "Hide"} sidebar`,
          shortcut: ["Ctrl", "B"],
          perform: () => sidebarHidden.update(v => !v),
        },
        {
          label: "Command Palette",
          shortcut: ["Ctrl", "Shift", "P"],
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

const mainCommandPalette = CommandPalette({
  items: getCommandPaletteItems,
  placeholder: "Type a command or search...",
  on: {close: () => {commandBarVisible.value = false;}},
});
commandBarVisible.sub(function*() {
  while (true) mainCommandPalette.visible = yield;
}());

const newRequestKindPalette = CommandPalette({
  items: () => Kinds.map(kind => ({
    label: kind,
    perform: () => {
      newRequestKind.value = kind;
    },
  })),
  placeholder: "Enter kind of new request",
  on: {close: () => {command_bar_new_request_kind_visible.value = false;}},
});
command_bar_new_request_kind_visible.sub(function*() {
  while (true) newRequestKindPalette.visible = yield;
}());

const newDraftKindPalette = CommandPalette({
  items: () => [...t.DraftableKinds.values()].map(kind => ({
    label: kind,
    perform: () => {
      store.createDraft(kind);
    },
  })),
  placeholder: "Enter kind of new draft",
  on: {close: () => {command_bar_draft_kind_visible.value = false;}},
});
command_bar_draft_kind_visible.sub(function*() {
  while (true)
    newDraftKindPalette.visible = yield;
}());

export const getOpenRequestItems = (): Item[] => Object
  .entries(store.requests)
  .filter(([id]) => !store.isDraft(id))
  .map(([id, preview]) => [id, preview, sourceBadge(id)] as const)
  .map(([id, preview, tag]) => ({
    label: preview.path, // TODO: preload store.requests2, fix ebanij rot kazino
    group: preview.kind,
    prefix: NTag({
      label: tag.label,
      color: tag.color,
      style: {
        minWidth: "4em",
        justifyContent: "center",
        display: "flex",
        alignItems: "center",
        fontWeight: "bold",
      },
    }),
    perform: () => store.selectRequest(id),
  }));

const openRequestPalette = CommandPalette({
  items: getOpenRequestItems,
  placeholder: "Type or search request id to open",
  on: {close: () => {command_bar_open_visible.value = false;}},
});
command_bar_open_visible.sub(function*() {
  while (true)
    openRequestPalette.visible = yield;
}());

type Panelka = {
  el: HTMLElement,
};

// Track send handler for the active frame so keyboard shortcuts (Ctrl+Enter) also render results
let activeFrameSend: (() => Promise<void>) | undefined;

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

  let activeTab: Tab | undefined;
  // Send wrapper shared by the frame's Perform button, Ctrl+Enter and the
  // command palette "Run" item: performs and renders the result.
  const onSend = (): Promise<void> => send(id).then(he => {
    if (he !== undefined)
      frame.push_history_entry?.(he);
  });
  container.on("tab", (tab: Tab): void => {
    activeTab = tab;
    eye_unsub = show_request.sub(function*() {
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

    // Draft tabs carry a pale-gray title and delete their record when closed via
    // the close button. The previews watcher re-styles on every refresh so the
    // title returns to normal color once the draft is saved (renamed to a real
    // path). Deletion is bound to the close button, not the destroy event, so
    // programmatic closes (stale-request cleanup, app teardown) keep the record.
    const syncDraftStyle = () => {
      tab.element.classList.toggle(draftTabClass, store.isDraft(id));
    };
    syncDraftStyle();
    const draftStyle_unsub = store.requestsTree.sub(function*() {
      while (true) {
        yield;
        syncDraftStyle();
      }
    }());
    tab.componentItem.tab.closeEl.addEventListener("click", () => {
      if (!store.isDraft(id))
        return;
      store.deleteRequest(id).catch(e => console.error(`Failed to delete draft ${id}`, e));
    });

    container.on("show", () => {
      store.activeComponentID = id;
      activeFrameSend = onSend;
    });
    container.on("destroy", () => {
      draftStyle_unsub();
      eye_unsub();
      frame_unsub();
      if (store.activeComponentID === id) {
        store.activeComponentID = null;
        activeFrameSend = undefined;
      }
    });

  });
  const frame = pluginsByKind[store.requests[id].kind].frame({
    el,
    show_request,
    eye,
    on: {
      update: (patch: Partial<Request>) => update_request(id, patch),
      send: onSend,
    },
  });
  const frame_unsub = () => frame.unmount();
  get_request(id).then(r => {
    if (r === null) {
      activeTab?.componentItem.close();
      return;
    }
    activeTab?.setTitle(r.request.path); // TODO: remove, create with ready title straightaway
    frame.loaded(r);
  });
  return {el};
};

// Local type for layout config items with mutable content.
type LayoutConfigNode = {
  type: string,
  content?: LayoutConfigNode[], // TODO: remove this kostyl and do filtering before giving shit to the layout
  componentType?: string,
  componentState?: Record<string, unknown>,
  activeItemIndex?: number,
};

// Remove tabs from layout config whose underlying request/source no longer exists in the DB,
// and clamp stack activeItemIndex so the layout does not crash on load with an out-of-range index.
function stripStaleTabs(config: LayoutConfig, validIds: Set<string>): void {
  const root = config.root as LayoutConfigNode | undefined;
  if (root === undefined)
    return;
  if (!filterNode(root, validIds))
    config.root = undefined;
}

// Keep a component tab only if the request/source it references still exists.
// Request panes reference their request by id; item viewers (and any other
// component) reference their source request by sourceID.
function isComponentValid(node: LayoutConfigNode, validIds: Set<string>): boolean {
  const state = node.componentState;
  if (node.componentType === "MyComponent")
    return state === undefined || validIds.has(String(state["id"]));
  return state !== undefined && validIds.has(String(state["sourceID"]));
}

// Recursively drop stale component tabs and the containers left empty by dropping.
// Returns false when the node itself should be dropped from its parent.
function filterNode(node: LayoutConfigNode, validIds: Set<string>): boolean {
  if (node.type === "component")
    return isComponentValid(node, validIds);

  if (node.content !== undefined) {
    node.content = node.content.filter(child => filterNode(child, validIds));
  }
  if (node.type === "stack") {
    if (node.content === undefined || node.content.length === 0) {
      node.content = undefined;
      return false;
    }
    const idx = node.activeItemIndex ?? 0;
    node.activeItemIndex = clamp(idx, 0, node.content.length - 1);
  }
  return true;
}

export default function(root: HTMLElement) {
  store.fetch().then(() => preApp(root, store));
}

function preApp(root: HTMLElement, store: Store) {
  const el_empty_state = NEmpty({
    status: "info",
    title: "Pick request",
    description: "Pick request to view it, edit, send and do other fun things.",
  });

  const el_layout = m("div", {id: "layoutContainer", style: {height: "100%", width: "100%"}});

  const el_main = m("div", {
    style: {
      color: "rgba(255, 255, 255, 0.82)",
      backgroundColor: "rgb(16, 16, 20)",
      overflow: "hidden", // TODO: fix hiding layout element
    }}, [
      el_empty_state,
      el_layout,
    ]);
  const split = NSplit(sidebar, el_main, {direction: "horizontal", sizes: ["300px", "1fr"], snap: 100});
  const app_container = split.element;

  sidebarHidden.sub(function*() {
    yield;
    while (true) {
      const sidebarHidden = yield;
      split.leftVisible = !sidebarHidden;
    }
  }());

  stripStaleTabs(store.layoutConfig, new Set(Object.keys(store.requests)));

  layout.init(el_layout, store.layoutConfig, {
    "MyComponent": (container, state) => panelkaFactory(container, state as StateRequest),
    ...Object.fromEntries(plugins.flatMap(plugin => Object.entries(plugin.viewers))),
  }, () => {
    update_empty_state();
    updateLocalstorage();
  });

  // Draft tabs that survived restore; live drafts without one are orphans,
  // swept by store.cleanupDrafts right below
  const restoredDraftIDs = Array
    .from(layout.instance?.tabs() ?? [])
    .filter(item => item.componentType === "MyComponent")
    .map(item => (item.toConfig().componentState as StateRequest).id)
    .filter(id => store.isDraft(id));
  store.cleanupDrafts(restoredDraftIDs);
  const update_empty_state = () => {
    setDisplay(el_empty_state, layout.instance?.isEmpty ?? false);
  };
  update_empty_state();

  const inputCreate = NInput({
    on: {
      update: (value: string) => {newRequestName.value = value;},
      keydown: (e: KeyboardEvent) => {
        if (e.key === "Enter")
          create();
      },
    },
    style: {width: "100%", boxSizing: "border-box", padding: "0.5em"},
  });
  const modalCreate = NModal({
    title: "Create request",
    text: {positive: "Create", negative: "Cancel"},
    on: {
      close: createCancel,
      positive_click: create,
      negative_click: createCancel,
      show: () => {
        inputCreate.focus();
      },
    },
  }, inputCreate);
  const inputRename = NInput({
    on: {update: (value: string) => {renameValue.value = value;}},
    style: {width: "100%", boxSizing: "border-box", padding: "0.5em"},
  });
  const modalRename = NModal({
    title: "Rename request",
    text: {positive: "Rename", negative: "Cancel"},
    on: {
      close: renameCancel,
      positive_click: rename,
      negative_click: renameCancel,
      show: () => {
        inputRename.value = store.requests[renameID.value!].path;
        inputRename.focus();
      },
    },
  }, inputRename);
  newRequestKind.sub(function*() {
    while (true) {
      const newRequestKind = yield;
      if (newRequestKind === undefined) {
        modalCreate.display = false;
        continue;
      }

      if (!modalCreate.display) {
        const newName = new Date().toUTCString();
        inputCreate.value = newName;
        newRequestName.value = newName;
        modalCreate.display = true;
      }
    }
  }());
  renameID.sub(function*() {
    while (true) {
      const renameID = yield;
      if (renameID === undefined) {
        modalRename.display = false;
        continue;
      }

      inputRename.value = store.requests[renameID].path;
      modalRename.display = true;
    }
  }());

  document.body.appendChild(globalDropdown.el);

  const anyModalIsOpen = () =>
    newRequestName.value !== undefined ||
    renameID.value !== undefined ||
    commandBarVisible.value ||
    command_bar_new_request_kind_visible.value ||
    command_bar_draft_kind_visible.value ||
    command_bar_open_visible.value;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    if (e.key === "P" && !e.altKey && e.ctrlKey && e.shiftKey && !e.metaKey) {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      commandBarVisible.update(v => !v);
      return;
    }

    if (e.key === "p" && !e.altKey && e.ctrlKey && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      command_bar_open_visible.update(v => !v);
      return;
    }

    if (e.key === "n" && !e.altKey && e.ctrlKey && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      command_bar_new_request_kind_visible.value = true;
      return;
    }

    if (e.key === "b" && e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      sidebarHidden.update(v => !v);
      return;
    }

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

    if (e.key === "s" && e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      const currentID = store.requestID();
      if (currentID === null || !(currentID in store.requests) || !store.isDraft(currentID)) {
        return;
      }
      // Saving a draft is a rename: the backend demotes it to a stored request
      renameInit(currentID);
    }

    if (e.key === "Escape") {
      e.preventDefault();
      if (commandBarVisible.value || command_bar_new_request_kind_visible.value || command_bar_draft_kind_visible.value || command_bar_open_visible.value) {
        return;
      }

      if (newRequestName.value === undefined && renameID.value === undefined) {
        return;
      }
      renameCancel();
      createCancel();
    }

    if (e.key === "Enter" && e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      const currentID = store.requestID();
      if (currentID === null) {
        return;
      }
      activeFrameSend?.();
    }

    if (e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey && e.key >= "1" && e.key <= "9") {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      store.selectPaneByIndex(Number(e.key) - 1);
      return;
    }

    if (e.key === "w" && e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      // Same contract as the tab close button: closing a focused draft deletes it
      const focused = layout.instance?.focusedComponentItem;
      if (focused !== undefined && focused.isSome() && focused.value.componentType === "MyComponent") {
        const {id} = focused.value.toConfig().componentState as StateRequest;
        if (store.isDraft(id)) {
          store.deleteRequest(id).catch(err => console.error(`Failed to delete draft ${id}`, err));
          return;
        }
      }
      layout.instance?.closeFocused();
    }

    if (e.key === "PageDown" && e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      store.navigateToTab("next");
      return;
    }

    if (e.key === "PageUp" && e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      store.navigateToTab("prev");
      return;
    }

    if (e.key === "PageDown" && e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      store.moveTab("right");
      return;
    }

    if (e.key === "PageUp" && e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey) {
      e.preventDefault();
      if (anyModalIsOpen()) {
        return;
      }
      store.moveTab("left");
      return;
    }

    if (e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
      if (e.key >= "1" && e.key <= "9") {
        e.preventDefault();
        if (anyModalIsOpen()) {
          return;
        }
        store.selectTabByIndex(Number(e.key) - 1);
        return;
      }

      if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(e.key))
        return;

      e.preventDefault();
      if (anyModalIsOpen())
        return;

      store.movePane(({
        "ArrowRight": "right",
        "ArrowLeft": "left",
        "ArrowUp": "up",
        "ArrowDown": "down",
      } as Record<string, "right" | "left" | "up" | "down">)[e.key]);
    }
  };

  document.addEventListener("keydown", handleKeyDown);

  root.append(m("div", {class: "h100", style: {
    width: "100%",
  }},
    modalCreate.element,
    modalRename.element,
    mainCommandPalette.el,
    newRequestKindPalette.el,
    newDraftKindPalette.el,
    openRequestPalette.el,
    app_container,
  ));
};
