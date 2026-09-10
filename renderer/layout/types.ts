// Hand-rolled layout manager: config/serialization types + manager contract.
// ComponentContainer and Tab are simple interfaces (no variance issues).
// ContentItem/ComponentItem/Stack are concrete aliases of the manager's impl
// classes (re-exported below) to avoid strictFunctionTypes variance conflicts
// in the item/stack/rowcol hierarchy.

import {JSONValue} from "@/types.ts";
import {ComponentItem} from "./manager.ts";

export type ItemConfig =
  | {
    type: "component",
    title: string,
    componentType: string,
    componentState?: JSONValue,
    width?: number,
    height?: number,
  }
  | {
    type: "stack",
    content: (ItemConfig & {type: "component"})[],
    activeItemIndex?: number,
    width?: number,
    height?: number,
  }
  | {
    type: "row",
    content: ItemConfig[],
    width?: number,
    height?: number,
  }
  | {
    type: "column",
    content: ItemConfig[],
    width?: number,
    height?: number,
  }
;

export type LayoutConfig = {
  root?: ItemConfig,
};

// Simple interfaces safe to implement under strictFunctionTypes.
export type ComponentContainer = {
  readonly element: HTMLElement,
  on(event: "tab", cb: (tab: Tab) => void): void,
  on(event: "show", cb: () => void): void,
  on(event: "destroy", cb: () => void): void,
};

export type Tab = {
  readonly element: HTMLElement,
  readonly componentItem: ComponentItem,
  setTitle(title: string): void,
};
