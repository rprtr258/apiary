import {none, Option, some} from "@/option.ts";
import {clamp, m, setDisplay} from "../lib/utils.ts";
import {JSONValue} from "@/types.ts";
import type {ComponentContainer, ItemConfig, LayoutConfig, Tab} from "./types.ts";
import {cls} from "./styles.ts";

type Hit =
  | {kind: "stack", stack: Stack}
  | {kind: "rowcol", rc: RowCol}
  | {kind: "tab", stack: Stack, tabEl: HTMLElement | undefined}
;

export class Container implements ComponentContainer {
  readonly element: HTMLElement;
  private tabCbs: ((tab: Tab) => void)[] = [];
  private showCbs: (()=>void)[] = [];
  private destroyCbs: (()=>void)[] = [];
  constructor(element: HTMLElement) {
    this.element = element;
  }
  on<E extends "tab" | "show" | "destroy">(event: E, cb: E extends "tab" ? (tab: Tab) => void : () => void): void {
    switch (event) {
    case "tab":
      this.tabCbs.push(cb);
      break;
    case "show":
      this.showCbs.push(cb as () => void);
      break;
    case "destroy":
      this.destroyCbs.push(cb as () => void);
      break;
    }
  }
  emitTab(tab: TabImpl): void {
    for (const cb of this.tabCbs) {
      cb(tab);
    }
  }
  emitShow(): void {
    for (const cb of this.showCbs) {
      cb();
    }
  }
  emitDestroy(): void {
    for (const cb of this.destroyCbs) {
      cb();
    }
  }
}

export class TabImpl implements Tab {
  readonly element: HTMLElement;
  readonly componentItem: ComponentItem;
  private readonly titleEl: HTMLElement;
  readonly closeEl: HTMLElement;

  constructor(item: ComponentItem, title: string) {
    this.componentItem = item;
    this.titleEl = m("div", {class: cls.tabTitle}, title);
    this.closeEl = m("div", {class: cls.tabClose}, "×");
    this.element = m("div", {class: `${cls.tab} ${cls.tabHover}`}, this.titleEl, this.closeEl);
  }

  setTitle(title: string): void {
    this.titleEl.textContent = title;
    this.componentItem.title = title;
  }
}

export class ComponentItem {
  readonly componentType: string;
  title: string;
  readonly state: JSONValue | undefined;
  parent: Stack | undefined;
  readonly element: HTMLElement;
  readonly container: Container;
  tab!: TabImpl; // set once on first placement
  hasTab = false;
  readonly manager: LayoutManager;
  readonly contentItems: readonly ComponentItem[] = [];
  factoryInvoked = false;

  constructor(
    manager: LayoutManager,
    parent: Stack,
    type: string,
    title: string,
    state: JSONValue | undefined,
  ) {
    this.manager = manager;
    this.parent = parent;
    this.componentType = type;
    this.title = title;
    this.state = state;
    this.element = m("div", {class: cls.item});
    setDisplay(this.element, false);
    this.container = new Container(this.element);
  }

  toConfig(): ItemConfig & {type: "component"} {
    return {
      type: "component",
      title: this.title,
      componentType: this.componentType,
      componentState: this.state,
    };
  }

  remove(): void {
    this.manager.removeItem(this);
  }

  close(): void {
    this.remove();
  }
}

export class Stack {
  parent: RowCol | null;
  readonly element: HTMLElement;
  readonly header: HTMLElement;
  readonly itemsEl: HTMLElement;
  children: ComponentItem[] = [];
  activeIndex = 0;
  readonly manager: LayoutManager;

  constructor(manager: LayoutManager) {
    this.manager = manager;
    this.parent = null;
    this.element = m("div", {class: cls.stack});
    this.header = m("div", {class: cls.header});
    this.itemsEl = m("div", {class: cls.items});
    this.element.append(this.header, this.itemsEl);
    this.manager.registerHit(this.element, {kind: "stack", stack: this});
    this.manager.registerHit(this.header, {kind: "tab", stack: this, tabEl: undefined});
  }

  get contentItems(): ComponentItem[] {
    return this.children;
  }

  addChild(item: ComponentItem, index: number = this.children.length): void {
    const clamped = clamp(index, 0, this.children.length);
    this.children.splice(clamped, 0, item);
    item.parent = this;
    this.manager.placeTab(item, this, clamped);
    this.itemsEl.append(item.element);
    this.manager.invokeFactory(item);
    if (this.children.length === 1) {
      this.activeComponentItem = item;
    }
    this.manager.notifyChanged();
  }

  removeChild(item: ComponentItem): void {
    const idx = this.children.indexOf(item);
    if (idx === -1) {
      return;
    }
    this.children.splice(idx, 1);
    this.manager.unregisterHit(item.tab.element);
    item.tab.element.remove();
    item.element.remove();
    item.container.emitDestroy();

    if (this.children.length === 0) {
      this.manager.removeEmpty(this);
      return;
    }
    if (idx <= this.activeIndex) {
      this.activeIndex = Math.max(0, this.activeIndex - 1);
    }
    this.renderActive();
    this.manager.notifyChanged();
  }

  set activeComponentItem(item: ComponentItem) {
    const idx = this.children.indexOf(item);
    if (idx === -1) {
      return;
    }
    this.activeIndex = idx;
    this.renderActive();
    this.manager.focusedComponentItem = some(item);
    item.container.emitShow();
    this.manager.notifyChanged();
  }

  get activeComponentItem(): Option<ComponentItem> {
    return this.activeIndex >= 0 && this.activeIndex < this.children.length ? some(this.children[this.activeIndex]) : none;
  }

  renderActive(): void {
    for (let i = 0; i < this.children.length; i++) {
      const c = this.children[i];
      const active = i === this.activeIndex;
      setDisplay(c.element, active);
      c.tab.element.classList.toggle(cls.tabActive, active);
    }
  }

  toConfig(): ItemConfig {
    return {
      type: "stack",
      content: this.children.map(c => c.toConfig()),
      activeItemIndex: this.activeIndex,
    };
  }

  destroy(): void {
    this.manager.unregisterHit(this.element);
    this.manager.unregisterHit(this.header);
    for (const c of [...this.children]) {
      this.manager.unregisterHit(c.tab.element);
      c.container.emitDestroy();
    }
    this.children = [];
    this.element.remove();
  }
}

export class RowCol {
  parent: RowCol | null;
  readonly element: HTMLElement;
  children: ContentItem[] = [];
  readonly horizontal: boolean;
  weights: number[] = [];
  readonly manager: LayoutManager;

  constructor(manager: LayoutManager, horizontal: boolean) {
    this.manager = manager;
    this.parent = null;
    this.horizontal = horizontal;
    this.element = m("div", {class: horizontal ? cls.row : cls.column});
    this.manager.registerHit(this.element, {kind: "rowcol", rc: this});
  }

  get contentItems(): ContentItem[] {
    return this.children;
  }

  addChild(item: ContentItem, index: number = this.children.length, weight?: number): void {
    const clamped = clamp(index, 0, this.children.length);
    this.children.splice(clamped, 0, item);
    this.weights.splice(clamped, 0, weight ?? 1);
    (item as {parent: RowCol | null}).parent = this;
    this.render();
    this.manager.notifyChanged();
  }

  removeChild(item: ContentItem): void {
    const idx = this.children.indexOf(item);
    if (idx === -1) {
      return;
    }
    this.children.splice(idx, 1);
    this.weights.splice(idx, 1);
    this.manager.unregisterHit(item.element);
    if (this.children.length === 0) {
      this.manager.removeEmpty(this);
      return;
    }
    if (this.children.length === 1) {
      this.manager.collapse(this);
      return;
    }
    this.render();
    this.manager.notifyChanged();
  }

  render(): void {
    this.element.replaceChildren();
    const sum = this.weights.reduce((a, b) => a + b, 0);
    const total = sum === 0 ? 1 : sum;
    for (let i = 0; i < this.children.length; i++) {
      const child = this.children[i] as {element: HTMLElement};
      child.element.style.flex = `${this.weights[i] / total} 1 0`;
      this.element.append(child.element);
      if (i < this.children.length - 1) {
        this.element.append(this.makeSplitter(i));
      }
    }
  }

  private makeSplitter(index: number): HTMLElement {
    const splitter = m("div", {class: this.horizontal ? cls.splitter.v : cls.splitter.h});
    splitter.addEventListener("mousedown", e => {
      e.preventDefault();
      this.manager.startSplitterDrag(this, index, e, splitter);
    });
    return splitter;
  }

  toConfig(): ItemConfig {
    const sum = this.weights.reduce((a, b) => a + b, 0);
    const total = sum === 0 ? 1 : sum;
    const content: ItemConfig[] = this.children.map((child, i) => {
      const cfg = child.toConfig();
      const pct = (this.weights[i] / total) * 100;
      if (this.horizontal) {
        cfg.width = pct;
      } else {
        cfg.height = pct;
      }
      return cfg;
    });
    return {type: this.horizontal ? "row" : "column", content};
  }

  destroy(): void {
    this.manager.unregisterHit(this.element);
    for (const child of [...this.children]) {
      (child as {destroy?: () => void}).destroy?.();
    }
    this.children = [];
    this.element.remove();
  }
}

export type ContentItem = Stack | RowCol | ComponentItem;

export class LayoutManager {
  private readonly host: HTMLElement;
  private readonly rootEl: HTMLElement;
  private root: ContentItem | undefined;
  private factories: Map<string, (container: ComponentContainer, state: JSONValue | undefined) => void>;
  private stateCbs: (() => void)[] = [];
  private hits = new WeakMap<HTMLElement, Hit>();
  focusedComponentItem: Option<ComponentItem> = none;
  private suppressNotify = false;

  private drag: {item: ComponentItem, proxy: HTMLElement} | undefined;
  private pendingDrag: {item: ComponentItem, x: number, y: number} | undefined;
  private overlay: HTMLElement;
  private splitterDrag: {
    rc: RowCol,
    index: number,
    start: number,
    w1: number,
    w2: number,
    total: number,
  } | undefined;
  private cursor: [number, number] = [0, 0];

  constructor(
    host: HTMLElement,
    factories: Record<string, (container: ComponentContainer, state: JSONValue | undefined) => void>,
    config: LayoutConfig,
  ) {
    this.host = host;
    this.rootEl = m("div", {class: cls.root});
    this.host.append(this.rootEl);
    this.overlay = m("div", {class: cls.drop});
    this.overlay.style.display = "none";
    this.rootEl.append(this.overlay);
    this.factories = new Map(Object.entries(factories));

    this.clear();
    if (config.root === undefined) {
      return;
    }
    this.suppressNotify = true;
    this.root = this.buildNode(config.root, null);
    this.rootEl.append(this.root.element);
    this.suppressNotify = false;
    this.emitInitialShow(this.root);
    this.notifyChanged();
  }

  invokeFactory(item: ComponentItem): void {
    if (item.factoryInvoked) {
      return;
    }
    item.factoryInvoked = true;
    const fn = this.factories.get(item.componentType);
    if (fn === undefined) {
      item.element.textContent = `Unknown component type: ${item.componentType}`;
      return;
    }
    try {
      fn(item.container, item.state);
    } catch (e) {
      item.element.textContent = `Component error: ${e instanceof Error ? e.message : String(e)}`;
    }
    // Fire "tab" after the factory has registered its tab listener.
    item.container.emitTab(item.tab);
  }

  registerHit(el: HTMLElement, hit: Hit): void {
    this.hits.set(el, hit);
  }
  unregisterHit(el: HTMLElement): void {
    this.hits.delete(el);
  }

  get rootItem(): ContentItem | undefined {
    return this.root;
  }

  on(_event: "stateChanged", cb: () => void): void {
    this.stateCbs.push(cb);
  }
  notifyChanged(): void {
    if (this.suppressNotify) {
      return;
    }
    this.syncCurrentHighlight();
    for (const cb of this.stateCbs) {
      cb();
    }
  }

  // Highlight the globally focused tab across all stacks. Each stack already
  // marks its own visible tab with `tabActive`; `tabCurrent` distinguishes the
  // one focused group.
  private syncCurrentHighlight(): void {
    const focused = this.focusedComponentItem;
    for (const stack of this.collectStacks(this.root)) {
      for (const child of stack.children) {
        child.tab.element.classList.toggle(cls.tabCurrent, focused.map(focused => child === focused).getOr(false));
      }
    }
  }

  // tab placement (preserves the Tab instance across moves)
  placeTab(item: ComponentItem, stack: Stack, index: number): void {
    if (!item.hasTab) {
      const tab = new TabImpl(item, item.title);
      item.tab = tab;
      item.hasTab = true;
      tab.element.addEventListener("mousedown", (e) => this.onTabMouseDown(e, item), true);
      tab.closeEl.addEventListener("click", (e) => {
        e.stopPropagation();
        item.remove();
      });
    }
    this.registerHit(item.tab.element, {kind: "tab", stack, tabEl: item.tab.element});
    stack.header.insertBefore(item.tab.element, stack.header.children[index] ?? null);
  }

  get layout(): LayoutConfig {
    return {
      root: this.root?.toConfig(),
    };
  }

  private buildNode(cfg: ItemConfig, parent: RowCol | null): ContentItem {
    switch (cfg.type) {
    case "component": {
      const stack = new Stack(this);
      stack.parent = parent;
      const comp = new ComponentItem(this, stack, cfg.componentType, cfg.title, cfg.componentState);
      stack.addChild(comp);
      return stack;
    }
    case "stack": {
      const stack = new Stack(this);
      stack.parent = parent;
      for (const c of cfg.content) {
        const comp = new ComponentItem(this, stack, c.componentType, c.title, c.componentState);
        stack.addChild(comp);
      }
      stack.activeIndex = clamp(cfg.activeItemIndex ?? 0, 0, stack.children.length - 1);
      stack.renderActive();
      return stack;
    }
    default: {
      const rc = new RowCol(this, cfg.type === "row");
      rc.parent = parent;
      const total = cfg.content.length;
      for (const child of cfg.content) {
        const node = this.buildNode(child, rc);
        const weight = (rc.horizontal ? child.width : child.height) ?? (100 / Math.max(total, 1));
        rc.addChild(node, rc.children.length, weight);
      }
      return rc;
    }
    }
  }

  private emitInitialShow(item: ContentItem): void {
    if (item instanceof Stack) {
      const active = item.activeComponentItem;
      if (active.isSome()) {
        this.focusedComponentItem = active;
        active.value.container.emitShow();
      }
      return;
    }
    for (const child of item.contentItems) {
      this.emitInitialShow(child);
    }
  }

  clear(): void {
    if (this.root !== undefined) {
      (this.root as {destroy: () => void}).destroy();
      this.root = undefined;
    }
    this.focusedComponentItem = none;
    this.notifyChanged();
  }

  addItem(type: string, title: string, state: unknown): void {
    const config = {
      type: "component",
      title: title,
      componentType: type,
      componentState: state as JSONValue,
    };
    let targetStack: Stack;
    if (this.root === undefined) {
      targetStack = new Stack(this);
      this.root = targetStack;
      this.rootEl.append(targetStack.element);
    } else if (this.root instanceof Stack) {
      targetStack = this.root;
    } else {
      targetStack = this.firstStack(this.root).getOr(this.makeRootStack());
    }
    const comp = new ComponentItem(this, targetStack, config.componentType, config.title, config.componentState);
    targetStack.addChild(comp);
    targetStack.activeComponentItem = comp;
  }

  private makeRootStack(): Stack {
    const stack = new Stack(this);
    (this.root as RowCol).addChild(stack);
    return stack;
  }

  private firstStack(item: ContentItem): Option<Stack> {
    if (item instanceof Stack) {
      return some(item);
    }
    for (const child of item.contentItems) {
      const found = this.firstStack(child);
      if (found.isSome()) {
        return found;
      }
    }
    return none;
  }

  // Move `item` into the next group (depth-first order). If its group is the
  // last one, split a new group to the right and move it there. Mirrors VS
  // Code's workbench.action.moveEditorToNextGroup.
  moveToNextGroup(item: ComponentItem): boolean {
    const source = item.parent;
    if (source === undefined) {
      return false;
    }
    const stacks = this.collectStacks(this.root);
    const idx = stacks.indexOf(source);
    const next = idx >= 0 && idx < stacks.length - 1 ? some(stacks[idx + 1]) : none;
    return this.moveOrSplit(item, source, next, true, false);
  }
  moveToPreviousGroup(item: ComponentItem): boolean {
    const source = item.parent;
    if (source === undefined) {
      return false;
    }
    const stacks = this.collectStacks(this.root);
    const idx = stacks.indexOf(source);
    const prev = idx > 0 ? some(stacks[idx - 1]) : none;
    return this.moveOrSplit(item, source, prev, true, true);
  }

  // Move `item` into the group spatially above; split a new group above if none.
  moveAbove(item: ComponentItem): boolean {
    const source = item.parent;
    if (source === undefined) {
      return false;
    }
    return this.moveOrSplit(item, source, this.neighbor(source, false, false), false, true);
  }

  // Move `item` into the group spatially below; split a new group below if none.
  moveBelow(item: ComponentItem): boolean {
    const source = item.parent;
    if (source === undefined) {
      return false;
    }
    return this.moveOrSplit(item, source, this.neighbor(source, false, true), false, false);
  }

  // If `target` exists, move the tab into it; otherwise split a new group off
  // `source` in the given orientation (`horizontal`) and placement (`before`),
  // then move the tab there. splitInto must run while `item` still lives in
  // `source` so the source stack is a valid split anchor.
  private moveOrSplit(item: ComponentItem, source: Stack, target: Option<Stack>, horizontal: boolean, before: boolean): boolean {
    let dest: Stack;
    if (target.isSome()) {
      dest = target.value;
    } else {
      dest = new Stack(this);
      this.splitInto(source, dest, horizontal, before);
    }
    this.detach(item);
    this.reinsert(dest, item, dest.children.length);
    dest.activeComponentItem = item;
    this.notifyChanged();
    return true;
  }

  // Spatial neighbor of `source` in a row/column tree. `horizontal` selects
  // axis (row=left/right, column=up/down); `forward` selects right/down vs
  // left/up. Returns the nearest stack of the adjacent sibling subtree.
  private neighbor(source: Stack, horizontal: boolean, forward: boolean): Option<Stack> {
    let node: ContentItem = source;
    let parent = source.parent;
    while (parent !== null) {
      if (parent.horizontal === horizontal) {
        const idx = parent.children.indexOf(node);
        if (forward) {
          if (idx < parent.children.length - 1) {
            return this.firstStack(parent.children[idx + 1]);
          }
        } else {
          if (idx > 0) {
            return this.lastStack(parent.children[idx - 1]);
          }
        }
      }
      node = parent;
      parent = parent.parent;
    }
    return none;
  }

  private collectStacks(node: ContentItem | undefined): Stack[] {
    if (node === undefined) {
      return [];
    }
    if (node instanceof Stack) {
      return [node];
    }
    const out: Stack[] = [];
    for (const child of node.contentItems) {
      out.push(...this.collectStacks(child));
    }
    return out;
  }

  private lastStack(item: ContentItem): Option<Stack> {
    if (item instanceof Stack) {
      return some(item);
    }
    for (let i = item.contentItems.length - 1; i >= 0; i--) {
      const found = this.lastStack(item.contentItems[i]);
      if (found.isSome()) {
        return found;
      }
    }
    return none;
  }

  removeItem(item: ComponentItem): void {
    const stack = item.parent!;
    const wasFocused = this.focusedComponentItem.isSome() && this.focusedComponentItem.value === item;
    stack.removeChild(item);
    if (!wasFocused) {
      return;
    }
    // Refocus a successor, VS Code-style: the new active tab of the same
    // group, or the active tab of the first remaining group if it emptied.
    const successor = stack.children.length > 0
      ? stack.activeComponentItem
      : this.root !== undefined ? this.firstStack(this.root).flatMap(s => s.activeComponentItem) : none;
    this.focusedComponentItem = successor;
    if (successor.isSome()) {
      successor.value.container.emitShow();
    }
    this.notifyChanged();
  }

  removeEmpty(item: ContentItem): void {
    const parent = (item as {parent: RowCol | null}).parent;
    if (parent === null) {
      if (item === this.root) {
        (item as unknown as {destroy: () => void}).destroy();
        this.root = undefined;
        this.focusedComponentItem = none;
        this.notifyChanged();
      }
      return;
    }
    parent.removeChild(item);
  }

  collapse(rc: RowCol): void {
    const only = rc.children[0];
    const parent = rc.parent;
    this.unregisterHit(rc.element);
    rc.children = [];
    if (parent === null) {
      (only as {parent: RowCol | null}).parent = null;
      this.root = only;
      this.rootEl.replaceChildren(this.overlay, only.element);
    } else {
      const idx = parent.children.indexOf(rc);
      parent.children[idx] = only;
      (only as {parent: RowCol}).parent = parent;
      parent.render();
    }
    rc.element.remove();
    this.notifyChanged();
  }

  startSplitterDrag(rc: RowCol, index: number, e: MouseEvent, el: HTMLElement): void {
    e.preventDefault();
    const rect = rc.element.getBoundingClientRect();
    const total = rc.horizontal ? rect.width : rect.height;
    el.classList.add(cls.splitter.active);
    this.splitterDrag = {
      rc, index,
      start: rc.horizontal ? e.clientX : e.clientY,
      w1: rc.weights[index],
      w2: rc.weights[index + 1],
      total,
    };
    const move = (ev: MouseEvent) => this.onSplitterMove(ev);
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      el.classList.remove(cls.splitter.active);
      this.splitterDrag = undefined;
      this.notifyChanged();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  private onSplitterMove({clientX, clientY}: MouseEvent): void {
    const d = this.splitterDrag;
    if (d === undefined) {
      return;
    }
    const pos = d.rc.horizontal ? clientX : clientY;
    const sum = d.w1 + d.w2;
    const deltaPct = ((pos - d.start) / d.total) * sum;
    let n1 = d.w1 + deltaPct;
    let n2 = d.w2 - deltaPct;
    const min = sum * 0.05;
    if (n1 < min) {n2 -= min - n1; n1 = min;}
    if (n2 < min) {n1 -= min - n2; n2 = min;}
    d.rc.weights[d.index] = n1;
    d.rc.weights[d.index + 1] = n2;
    d.rc.render();
  }

  onTabMouseDown(e: MouseEvent, item: ComponentItem): void {
    if (e.button !== 0) {
      return;
    }
    item.parent!.activeComponentItem = item;
    this.pendingDrag = {item, x: e.clientX, y: e.clientY};
    const move = (ev: MouseEvent) => this.onPendingDragMove(ev);
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      this.pendingDrag = undefined;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }

  private onPendingDragMove(e: MouseEvent): void {
    const p = this.pendingDrag;
    if (p === undefined) {
      return;
    }
    if (Math.abs(e.clientX - p.x) < 4 && Math.abs(e.clientY - p.y) < 4) {
      return;
    }
    this.pendingDrag = undefined;
    const proxy = m("div", {class: cls.proxy});
    proxy.textContent = p.item.title;
    document.body.append(proxy);
    this.drag = {item: p.item, proxy};
    const move = (ev: MouseEvent) => this.onDragMove(ev);
    const up = (ev: MouseEvent) => {
      this.onDragUp(ev);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    this.onDragMove(e);
  }

  private onDragMove(e: MouseEvent): void {
    this.cursor = [e.clientX, e.clientY];
    const d = this.drag;
    if (d === undefined) {
      return;
    }
    d.proxy.style.left = `${e.clientX + 8}px`;
    d.proxy.style.top = `${e.clientY + 8}px`;
    this.renderDropHint(this.hitTest(e.clientX, e.clientY));
  }

  private onDragUp(e: MouseEvent): void {
    this.cursor = [e.clientX, e.clientY];
    const d = this.drag;
    this.overlay.style.display = "none";
    if (d !== undefined) {
      d.proxy.remove();
      this.performDrop(d.item, this.hitTest(e.clientX, e.clientY));
    }
    this.drag = undefined;
  }

  private hitTest(x: number, y: number): Option<Hit> {
    const d = this.drag;
    if (d !== undefined) {
      d.proxy.style.display = "none";
    }
    let el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (d !== undefined) {
      d.proxy.style.display = "";
    }
    while (el !== null && el !== this.host) {
      const hit = this.hits.get(el);
      if (hit !== undefined) {
        return some(hit);
      }
      el = el.parentElement;
    }
    return none;
  }

  private tabIndex(stack: Stack, tabEl: HTMLElement | undefined): number {
    if (tabEl === undefined) {
      return stack.children.length;
    }
    const children = [...stack.header.children] as HTMLElement[];
    const i = children.indexOf(tabEl);
    return i === -1 ? stack.children.length : i;
  }

  private renderDropHint(hit: Option<Hit>): void {
    if (hit.isNone()) {
      this.overlay.style.display = "none";
      return;
    }
    const rootRect = this.rootEl.getBoundingClientRect();
    switch (hit.value.kind) {
    case "tab": {
      const headerRect = hit.value.stack.header.getBoundingClientRect();
      // Dropping on the empty header area (tabEl === undefined): highlight the
      // full header line so it's clear the tab will be appended here.
      if (hit.value.tabEl === undefined) {
        this.overlay.style.display = "";
        this.overlay.style.left = `${headerRect.left - rootRect.left}px`;
        this.overlay.style.top = `${headerRect.top - rootRect.top}px`;
        this.overlay.style.width = `${headerRect.width}px`;
        this.overlay.style.height = `${headerRect.height}px`;
        return;
      }
      const idx = this.tabIndex(hit.value.stack, hit.value.tabEl);
      const tabs = [...hit.value.stack.header.children] as HTMLElement[];
      let insertX: number;
      if (idx >= tabs.length) {
        insertX = headerRect.right;
      } else {
        insertX = tabs[idx].getBoundingClientRect().left;
      }
      this.overlay.style.display = "";
      this.overlay.style.left = `${insertX - rootRect.left - 1}px`;
      this.overlay.style.top = `${headerRect.top - rootRect.top}px`;
      this.overlay.style.width = "2px";
      this.overlay.style.height = `${headerRect.height}px`;
      return;
    }
    case "stack": {
      this.highlightEdge(hit.value.stack, rootRect);
      return;
    }
    case "rowcol": {
      // rowcol: resolve the stack under the cursor and highlight its edge zone.
      const stack = this.stackUnderPoint(hit.value.rc);
      if (stack === undefined) {
        this.overlay.style.display = "none";
        return;
      }
      this.highlightEdge(stack, rootRect);
      return;
    }
    }
  }

  private highlightEdge(stack: Stack, rootRect: DOMRect): void {
    const r = stack.itemsEl.getBoundingClientRect();
    const edge = this.edgeOf(stack);
    let {left, top, width, height} = r;
    switch (edge) {
    case "left":
      width = r.width / 2;
      break;
    case "right":
      left = r.left + r.width / 2;
      width = r.width / 2;
      break;
    case "top":
      height = r.height / 2;
      break;
    case "bottom":
      top = r.top + r.height / 2;
      height = r.height / 2;
      break;
    }
    // center: highlight the full pane (drop into this stack).
    this.overlay.style.display = "";
    this.overlay.style.left = `${left - rootRect.left}px`;
    this.overlay.style.top = `${top - rootRect.top}px`;
    this.overlay.style.width = `${width}px`;
    this.overlay.style.height = `${height}px`;
  }

  private edgeOf(stack: Stack): "left" | "right" | "top" | "bottom" | "center" {
    const r = stack.itemsEl.getBoundingClientRect();
    const [x, y] = this.cursor;
    const dx = (x - r.left) / r.width;
    const dy = (y - r.top) / r.height;
    return dx < 0.33 ? "left" :
           dx > 0.67 ? "right" :
           dy < 0.33 ? "top" :
           dy > 0.67 ? "bottom" :
                       "center";
  }

  private performDrop(dragged: ComponentItem, hit: Option<Hit>): void {
    if (hit.isNone()) {
      this.notifyChanged();
      return;
    }
    const oldStack = dragged.parent!;
    const wasFocused = this.focusedComponentItem.isSome() && this.focusedComponentItem.value === dragged;

    if (hit.value.kind === "tab") {
      const target = hit.value.stack;
      if (target === oldStack) {
        const oldIndex = oldStack.children.indexOf(dragged);
        this.detach(dragged);
        const targetIndex = this.tabIndex(target, hit.value.tabEl);
        const insertAt = oldIndex < targetIndex ? targetIndex - 1 : targetIndex;
        this.reinsert(oldStack, dragged, insertAt);
        oldStack.activeComponentItem = dragged;
        this.notifyChanged();
        return;
      }
      this.detach(dragged);
      this.reinsert(target, dragged, this.tabIndex(target, hit.value.tabEl));
      target.activeComponentItem = dragged;
      this.notifyChanged();
      return;
    }

    let targetStack: Stack | undefined;
    if (hit.value.kind === "stack") {
      targetStack = hit.value.stack;
    } else {
      targetStack = this.stackUnderPoint(hit.value.rc);
    }
    if (targetStack === undefined) {
      this.notifyChanged();
      return;
    }
    const edge = this.edgeOf(targetStack);
    if (edge === "center") {
      if (targetStack === oldStack) {
        this.notifyChanged();
        return;
      }
      this.detach(dragged);
      this.reinsert(targetStack, dragged, targetStack.children.length);
      targetStack.activeComponentItem = dragged;
      this.notifyChanged();
      return;
    }

    // Don't allow splitting the sole tab out of its own stack: detaching would
    // destroy the stack before splitInto can use it, making the pane disappear.
    // With 2+ tabs, splitting one out onto its own stack's edge is legitimate.
    if (targetStack === oldStack && oldStack.children.length <= 1) {
      this.notifyChanged();
      return;
    }

    this.detach(dragged);
    const newStack = new Stack(this);
    newStack.addChild(dragged);
    const horizontal = edge === "left" || edge === "right";
    const before = edge === "left" || edge === "top";
    this.splitInto(targetStack, newStack, horizontal, before);
    if (wasFocused) {
      newStack.activeComponentItem = dragged;
    }
    this.notifyChanged();
  }

  private stackUnderPoint(rc: RowCol): Stack | undefined {
    const [x, y] = this.cursor;
    let node: ContentItem | undefined = rc;
    while (node !== undefined && !(node instanceof Stack)) {
      let found: ContentItem | undefined;
      for (const child of node.contentItems) {
        const r = (child as {element: HTMLElement}).element.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
          found = child;
          break;
        }
      }
      node = found;
    }
    return node;
  }

  // Detach: remove from tree + DOM but preserve the Tab instance and its listeners.
  private detach(item: ComponentItem): void {
    const stack = item.parent!;
    const idx = stack.children.indexOf(item);
    if (idx === -1) {
      return;
    }
    stack.children.splice(idx, 1);
    item.tab.element.remove();
    item.element.remove();
    if (idx <= stack.activeIndex) {
      stack.activeIndex = Math.max(0, stack.activeIndex - 1);
    }
    if (stack.children.length === 0) {
      this.removeEmpty(stack);
    } else {
      stack.renderActive();
    }
  }

  private reinsert(stack: Stack, item: ComponentItem, index: number): void {
    const clamped = clamp(index, 0, stack.children.length);
    stack.children.splice(clamped, 0, item);
    item.parent = stack;
    this.placeTab(item, stack, clamped);
    stack.itemsEl.append(item.element);
    stack.renderActive();
  }

  private splitInto(target: Stack, newStack: Stack, horizontal: boolean, before: boolean): void {
    const parent = target.parent;
    if (parent !== null && parent.horizontal === horizontal) {
      const idx = parent.children.indexOf(target);
      parent.addChild(newStack, before ? idx : idx + 1, parent.weights[idx] ?? 1);
      return;
    }
    const rc = new RowCol(this, horizontal);
    rc.parent = parent;
    if (parent === null) {
      this.root = rc;
      this.rootEl.replaceChildren(this.overlay, rc.element);
    } else {
      const idx = parent.children.indexOf(target);
      parent.children[idx] = rc;
      (target as {parent: RowCol}).parent = rc;
    }
    rc.children = before ? [newStack, target] : [target, newStack];
    rc.weights = [1, 1];
    (rc.children[0] as {parent: RowCol}).parent = rc;
    (rc.children[1] as {parent: RowCol}).parent = rc;
    rc.render();
    if (parent !== null) {
      // rc replaced a child of an existing row/column with the perpendicular
      // orientation: re-render the parent so rc.element is mounted into the DOM.
      parent.render();
    }
  }
  *tabs(): Generator<ComponentItem> {
    const rootItem = this.rootItem;
    if (rootItem === undefined) {
      return;
    }

    function* dfs_node(c: ContentItem): Generator<ComponentItem> {
      if (c instanceof ComponentItem) {
        yield c;
        return;
      }

      for (const child of c.contentItems) {
        yield* dfs_node(child);
      }
    }

    yield* dfs_node(rootItem);
  }
  get isEmpty(): boolean {
    return this.rootItem === undefined;
  }
  focus(tab: ComponentItem) {
    const parent = tab.parent;
    if (parent instanceof Stack)
      parent.activeComponentItem = tab;
  }
  activeTab(): Option<ComponentItem> {
    if (this.focusedComponentItem.isSome())
      return this.focusedComponentItem;
    const root = this.rootItem;
    if (root instanceof Stack)
      return root.activeComponentItem;
    return none;
  }
  move(tab: ComponentItem, fn: (index: number) => number) {
    const parent = tab.parent;
    if (!(parent instanceof Stack))
      return;

    const currentIndex = parent.contentItems.indexOf(tab);
    if (currentIndex === -1)
      return;
    const newIndex = fn(currentIndex);
    if (newIndex < 0 || newIndex >= parent.contentItems.length)
      return;

    // detach/reinsert preserve the Tab instance and its listeners; removeChild + addChild would emitDestroy
    // (unmounting the live panel) while invokeFactory is skipped via factoryInvoked, leaving a blank panel.
    this.detach(tab);
    this.reinsert(parent, tab, newIndex);
    this.focus(tab);
  }
  closeFocused(): void {
    const item = this.focusedComponentItem;
    if (item.isNone())
      return;
    item.value.remove();
  }
}
