import {
  ComponentContainer, GoldenLayout, LayoutConfig, JsonValue,
  ContentItem, ComponentItem, Stack,
} from "golden-layout";

function* dfs_node(c: ContentItem): Generator<ComponentItem, void, void> {
  if (((c): c is ComponentItem => c.isComponent)(c)) {
    yield c;
    return;
  }

  for (const child of c.contentItems) {
    yield* dfs_node(child);
  }
}

let instance: GoldenLayout | undefined = undefined;

export default (() => ({
  init(
    el: HTMLElement,
    layoutConfig: LayoutConfig,
    factories: Record<string, (container: ComponentContainer, state: unknown) => void>,
    onstatechanged: () => void,
  ) {
    if (instance !== undefined) {
      throw new Error("Layout already initialized");
    }

    const gl: GoldenLayout = new GoldenLayout(el);
    gl.resizeWithContainerAutomatically = true;
    gl.resizeDebounceInterval = 0;
    for (const [type, fn] of Object.entries(factories)) {
      gl.registerComponentFactoryFunction(type, fn);
    }
    gl.loadLayout(layoutConfig);
    gl.on("stateChanged", onstatechanged);
    instance = gl;
  },
  get instance(): GoldenLayout | undefined {
    return instance;
  },
  get isEmpty(): boolean {
    return instance?.rootItem === undefined;
  },
  tabs(): Generator<ComponentItem, void, void> {
    const rootItem = instance?.rootItem;
    if (rootItem === undefined) {
      return function*(){}();
    }

    return dfs_node(rootItem);
  },
  addItem(type: string, title: string, state: unknown): void {
    instance?.addItem({
        type: "component",
        title: title,
        componentType: type,
        componentState: state as JsonValue,
      });
  },
  focus(tab: ComponentItem) {
    const root = instance?.rootItem;
    if (((root): root is Stack => root?.isStack === true)(root))
      root.setActiveComponentItem(tab, true);
    else
      console.error("Cannot focus tab: root is not a Stack:", root);
  },
  move(tab: ComponentItem, fn: (index: number) => number) {
    const parent = tab.parent;
    if (parent?.isStack !== true) return;

    const currentIndex = parent.contentItems.indexOf(tab);
    if (currentIndex === -1) return;
    const newIndex = fn(currentIndex);
    if (newIndex < 0 || newIndex >= parent.contentItems.length) return;

    parent.removeChild(tab, true);
    parent.addChild(tab, newIndex);
    this.focus(tab);
  },
  clear(): void {
    instance?.clear();
  },
}))();
