import * as t from "@/types.ts";
import {get_request} from "../store.ts";
import {DOMNode, Signal} from "../lib/utils.ts";
import type {Item} from "./source.ts";
import type {ComponentContainer} from "../layout/types.ts";

export type ItemBadge = {
  label: string,
  color: string,
  background?: string,
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

// Same bivariance reasoning as SourceCache above.
export type Plugin = {
  kind: t.Kind,
  frame(args: FrameArgs): Frame,
  menuEntries?(id: t.RequestID): MenuOption[],
  // Tab variants registered once at init (renderer/App.ts); items pick a
  // variant via its componentType in their onOpen closures
  viewers: Record<string, (container: ComponentContainer, state: unknown) => void>,
  // Invisible root of the kind's source subtree (see source.ts): carries the
  // kind badge (sidebar request rows, command palette); the facade renders
  // root(id).children under the request row, root loading drives the row
  // pulse and root refresh the "Refresh" context-menu entry. Kinds without
  // source items return a badge-only root
  root(id: t.RequestID): Item,
};
