import * as t from "@/types.ts";
import {DOMNode, Signal} from "../lib/utils.ts";
import type {Item} from "./source.ts";
import {ComponentContainer, Tab} from "../layout/types.ts";

export type ItemBadge = {
  label: string,
  color: string,
  background?: string,
};

type FrameArgs = {
  el: HTMLElement,
  show_request: Signal<boolean>,
  on: {
    update: (patch: Partial<t.Request>) => Promise<void>,
    send: () => Promise<void>,
  },
};

// A mounted request pane: what panelkaFactory needs to drive the frame after
// mounting. Factories mirror the Request<Kind> modules: request kinds toggle
// their editor via show_request (the eye added by their tabModifiers); source
// kinds only take update.
type Frame = {
  loaded(r: t.Request): void,
  push_history_entry?(he: t.HistoryEntry): void, // show the performed response
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

// Panelka context handed to tab modifiers; show_request drives the editor
// pane visibility (request kinds) and is what the shared eye toggles.
type TabModifierArgs = {
  show_request: Signal<boolean>,
};

// Decorates the request tab: called once when the tab attaches, returns
// cleanup run on pane destroy.
export type TabModifier = (tab: Tab, args: TabModifierArgs) => () => void;

// Same bivariance reasoning as SourceCache above.
export type Plugin = {
  kind: t.Kind,
  frame(args: FrameArgs): Frame,
  // Tab decorations (e.g. the shared eye toggle for performable kinds); a
  // kind without a tab affordance (source kinds) declares none
  tabModifiers?: TabModifier[],
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
