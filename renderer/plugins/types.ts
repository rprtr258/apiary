import * as t from "@/types.ts";
import {get_request} from "../store.ts";
import {DOMNode, Signal} from "../lib/utils.ts";
import {SourceCache} from "./cache.ts";
import type {ComponentContainer} from "../layout/types.ts";
import type {TagType} from "../components/dataview.ts";

export type KindTag = {
  text: string,
  color: string,
  type?: TagType,
};

export type TagData = {
  text: string,
  type: TagType,
  style?: Partial<CSSStyleDeclaration>,
};

export type FrameArgs = {
  el: HTMLElement,
  show_request: Signal<boolean>,
  eye: HTMLElement,
  on: {
    update: (patch: Partial<t.Request>) => Promise<void>,
    send: () => Promise<void>,
  },
};

// A mounted request pane: what panelkaFactory needs to drive the frame after
// mounting. Factories mirror the Request<Kind> modules: request kinds toggle
// their editor via show_request (the eye in the tab); source kinds hide the
// eye and only take update.
export type Frame = {
  loaded(r: get_request): void,
  push_history_entry?(he: t.HistoryEntry): void, // show last history entry
  unmount(): void,
};

export type MenuOption = {
  label: string,
  key: string,
  icon?: DOMNode,
  on: {
    click: () => void,
  },
};

// Everything needed to mount a source item's viewer pane: the layout
// componentType (persistence + dedup key, see store.openViewer) and the
// component factory. Viewer states extend ViewerState ({sourceID, itemKey},
// store.ts) with the item data their component needs; the state types live in
// the plugin files.
export type Viewer = {
  componentType: string,
  factory: (container: ComponentContainer, state: unknown) => void,
};

// Same bivariance reasoning as SourceCache above.
export type Plugin<Item = unknown> = {
  kind: t.Kind,
  kindTag: KindTag,
  frame(args: FrameArgs): Frame,
  menuEntries?(id: t.RequestID): MenuOption[],
  cache?: SourceCache<Item>,
  // Sidebar tree key; "/" nests items into virtual folder nodes the same way
  // request id paths nest into directories (e.g. MCP: "Tools/<tool name>")
  itemKey?(item: Item): string,
  label?(item: Item): string,
  tag?(item: Item): TagData,
  onOpen?(id: string, item: Item, itemKey: string): void,
  childrenOf?(item: Item): Promise<Item[]>,
  // Tab variants registered once at init (renderer/App.ts); items pick a
  // variant via its componentType in their onOpen closures
  viewers?: Record<string, (container: ComponentContainer, state: unknown) => void>,
};
