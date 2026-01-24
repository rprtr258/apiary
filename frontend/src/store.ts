import {database, app} from "../wailsjs/go/models.ts";
import {ComponentItem, ComponentItemConfig, ContentItem, GoldenLayout, LayoutConfig, ResolvedComponentItemConfig, ResolvedLayoutConfig, ResolvedRowOrColumnItemConfig, ResolvedStackItemConfig, Stack} from "golden-layout";
import {api} from "./api.ts";
import {type RequestData, type HistoryEntry, Request} from "./types.ts";
import {signal, Signal} from "./utils.ts";


// TODO: <NNotificationProvider :max="1" placement="bottom-right">
export function useNotification() {
  const notify = (args: Record<string, unknown>): void => {
    alert(Object.entries({title: "Error", ...args}).map(([k, arg]) => k+": "+String(arg)).join("\n"));
  };
  return {
    error: notify,
  };
}
export const notification = useNotification();

type ConfigNode = ResolvedRowOrColumnItemConfig | ResolvedStackItemConfig | ResolvedComponentItemConfig;

function* dfs<State>(c: ConfigNode): Generator<State, void, void> {
  if (c.type === "component") {
    yield (c.componentState! as State);
  } else {
    for (const child of c.content) {
      yield* dfs(child);
    }
  }
};

function findActiveComponentID(layout: GoldenLayout): string | null {
  // Fallback function to find the first component when no active component is tracked
  const rootItem = layout.rootItem;
  if (rootItem === undefined) {
    return null;
  }

  function traverse(item: ContentItem): ComponentItem | null {
    // Check if this is a component item
    if (((item): item is ComponentItem => item.isComponent)(item) && item.componentType === "MyComponent") {
      return item;
    } else if (!item.isComponent) {
      for (const child of item.contentItems) {
        const tmp = traverse(child);
        if (tmp !== null)
          return tmp;
      }
    }
    return null;
  }

  const item = traverse(rootItem);
  if (item === null)
    return null;

  // Return the first component's ID as a fallback
  return (item.toConfig().componentState as panelkaState).id;
}

export type viewerState = {
  sqlSourceID: string,
  tableName: string,
  tableInfo: database.TableInfo,
};
export type EndpointViewerState = {
  sourceID: string,
  endpointIndex: number,
  endpointInfo: database.EndpointInfo,
};
export type panelkaState = {id: string};

let layoutConfig: LayoutConfig = {
  header: {
    show: "top",
    close: "close",
    maximise: "maximise",
  },
  root: {
    type: "stack",
    content: [],
  },
};
(() => {
  const oldTabs = localStorage.getItem("tabs");
  if (oldTabs !== null) {
    layoutConfig = LayoutConfig.fromResolved(JSON.parse(oldTabs) as ResolvedLayoutConfig);
  }
})();
export function updateLocalstorageTabs() {
  const dump = JSON.stringify(store.layout?.saveLayout());
  localStorage.setItem("tabs", dump);
}

export function handleCloseTab(id: string) {
  const layout = store.layout;
  if (layout?.rootItem === undefined) {
    return;
  }

  // Find the component with the given ID
  function findComponent(item: ContentItem): ComponentItem | null {
    // Type guard to check if item is a ComponentItem
    const isComponentItem = (item: ContentItem): item is ComponentItem => item.isComponent;

    if (isComponentItem(item) && item.componentType === "MyComponent") {
      const componentState = item.toConfig().componentState as panelkaState;
      if (componentState.id === id) {
        return item;
      }
    } else if (!item.isComponent) {
      for (const child of item.contentItems) {
        const tmp = findComponent(child);
        if (tmp !== null) return tmp;
      }
    }
    return null;
  }
  const componentItemToRemove = findComponent(layout.rootItem);
  if (componentItemToRemove === null) {
    notification.error({title: "Component not found", id});
    return;
  }

  // Remove the component - using the same pattern as in the load function
  componentItemToRemove.remove();

  // Update local storage
  updateLocalstorageTabs();
}

export type get_request = {
  request: Request,
  history: HistoryEntry[],
};
export function last_history_entry(request: get_request): HistoryEntry | undefined {
  return request.history[request.history.length - 1];
}

export type Store = {
  requestsTree : Signal<app.Tree>,
  requests : Record<string, app.requestPreview>,
  requests2: Record<string, get_request>,
  requestNames: Record<string, string>,
  layoutConfig: LayoutConfig,
  layout: GoldenLayout | undefined,
  activeComponentID: string | null,
  clearTabs(): void,
  requestID(): string | null,
  selectRequest(id: string): void,
  fetch(): Promise<void>,
  createRequest(id: string, kind: RequestData["kind"]): Promise<void>,
  duplicate(id: string): Promise<void>,
  deleteRequest(id: string): Promise<void>,
  rename(id: string, newID: string): Promise<void>,
  openTableViewer(sqlSourceID: string, tableName: string, tableInfo: database.TableInfo): void,
  openEndpointViewer(sourceID: string, endpointIndex: number, endpointInfo: database.EndpointInfo): void,
  // Tab navigation methods
  navigateToNextTab(): void,
  navigateToPreviousTab(): void,
  moveTabRight(): void,
  moveTabLeft(): void,
  // Helper methods for tab navigation
  getAllOpenTabs(): {id: string, item: ComponentItem}[],
  findComponentItem(id: string): ComponentItem | null,
  activateTab(tab: ComponentItem): void,
};

export const store = ((): Store => {
  return {
    requestsTree : signal(new app.Tree({IDs: {}, Dirs: {}})),
    requests : {} as Record<string, app.requestPreview>,
    requests2: {} as Record<string, get_request>,
    requestNames: {} as Record<string, string>,
    layoutConfig,
    layout: undefined as GoldenLayout | undefined,
    activeComponentID: null,
    clearTabs() {
      this.layout?.clear();
      this.activeComponentID = null;
    },
    requestID(): string | null {
      // Return the tracked active component ID if available
      if (this.activeComponentID !== null) {
        return this.activeComponentID;
      }

      // Fall back to finding the first component if no active ID is tracked
      if (this.layout === undefined)
        return null;

      return findActiveComponentID(this.layout);
    },
    selectRequest(id: string): void {
      const cfg = this.layout!.saveLayout();
      if (cfg.root !== undefined && dfs<panelkaState>(cfg.root).find(t => t.id === id) !== undefined) {
        this.activateTab(this.findComponentItem(id)!);
      } else {
        this.layout?.addItem(panelka(id));
        this.fetch().catch(notification.error);
      }
    },
    async fetch(): Promise<void> {
      const json = await api.collectionRequests();
      if (json.kind === "err") {
        notification.error({title: "Could not fetch requests", error: json.value});
        return;
      }

      const res = json.value;

      const currentRequestID = this.requestID();

      for (const id in res.Requests) {
        if (id !== currentRequestID) {
          this.requests[id] = res.Requests[id];
        }
      }
      for (const id in this.requests) {
        if (!res.Requests.hasOwnProperty(id)) {
          delete this.requests[id];
        }
      }

      this.requestsTree.update(() => res.Tree);

      function* mapper(tree: app.Tree): Generator<[string, string]> {
        yield* Object.entries(tree.IDs);
        for (const subtree of Object.values(tree.Dirs))
          yield* mapper(subtree);
      };
      this.requestNames = Object.fromEntries(mapper(res.Tree));
    },
    async createRequest(id: string, kind: RequestData["kind"]): Promise<void> {
      const res = await api.requestCreate(id, kind);
      if (res.kind === "err") {
        notification.error({title: "Could not create request", error: res.value});
        return;
      }

      await this.fetch();
    },
    async duplicate(id: string): Promise<void> {
      const res = await api.requestDuplicate(id);
      if (res.kind === "err") {
        notification.error({title: "Could not duplicate", error: res.value});
        return;
      }

      await this.fetch();
    },
    async deleteRequest(id: string): Promise<void> {
      const res = await api.requestDelete(id);
      if (res.kind === "err") {
        notification.error({title: "Could not delete request", error: res.value});
        return;
      }
      if (this.requests.hasOwnProperty(id)) {
        delete this.requests[id];
      }
      if (this.requests2.hasOwnProperty(id)) {
        delete this.requests2[id];
      }
      await this.fetch();
    },
    async rename(id: string, newID: string): Promise<void> {
      const res = await api.rename(id, newID);
      if (res.kind === "err") {
        notification.error({title: "Could not rename request", error: res.value});
        return;
      }

      this.requests[newID] = Object.assign({}, this.requests[id]);
      // tabs.value?.map.rename(id, newID);
      await this.fetch();
    },
    openTableViewer(sqlSourceID: string, tableName: string, tableInfo: database.TableInfo): void {
      const cfg = this.layout!.saveLayout();
      if (cfg.root !== undefined && dfs<viewerState>(cfg.root).find(t => t.sqlSourceID === sqlSourceID && t.tableName === tableName) !== undefined)
        return;

      const sourceName = this.requestNames[sqlSourceID] ?? sqlSourceID;
      this.layout?.addItem({
        type: "component",
        title: `${sourceName}/${tableName}`,
        componentType: "TableViewer",
        componentState: {sqlSourceID, tableName, tableInfo},
      });
    },
    openEndpointViewer(sourceID: string, endpointIndex: number, endpointInfo: database.EndpointInfo): void {
      const cfg = this.layout!.saveLayout();
      if (cfg.root !== undefined && dfs<EndpointViewerState>(cfg.root).find(t => t.sourceID === sourceID && t.endpointIndex === endpointIndex) !== undefined)
        return;

      const sourceName = this.requestNames[sourceID] ?? sourceID;
      this.layout?.addItem({
        type: "component",
        title: `${sourceName}/${endpointInfo.method} ${endpointInfo.path}`,
        componentType: "EndpointViewer",
        componentState: {sourceID, endpointIndex, endpointInfo},
      });
    },
    navigateToNextTab(): void {
      const allTabs = this.getAllOpenTabs();
      if (allTabs.length === 0) return;

      const currentID = this.requestID();
      if (currentID === null) {
        // If no tab is active, activate the first one
        this.activateTab(allTabs[0].item);
        return;
      }

      const currentIndex = allTabs.findIndex(tab => tab.id === currentID);
      if (currentIndex === -1) return;

      const nextIndex = (currentIndex + 1) % allTabs.length;
      this.activateTab(allTabs[nextIndex].item);
    },
    navigateToPreviousTab(): void {
      const allTabs = this.getAllOpenTabs();
      if (allTabs.length === 0) return;

      const currentID = this.requestID();
      if (currentID === null) {
        // If no tab is active, activate the last one
        this.activateTab(allTabs[allTabs.length - 1].item);
        return;
      }

      const currentIndex = allTabs.findIndex(tab => tab.id === currentID);
      if (currentIndex === -1) return;

      const prevIndex = (currentIndex - 1 + allTabs.length) % allTabs.length;
      this.activateTab(allTabs[prevIndex].item);
    },
    moveTabRight(): void {
      notification.error({title: "Not implemented."}); // TODO: implement
    },
    moveTabLeft(): void {
      notification.error({title: "Not implemented."}); // TODO: implement
    },
    // Helper methods
    getAllOpenTabs(): {id: string, item: ComponentItem}[] {
      if (this.layout?.rootItem === undefined) return [];

      const tabs: {id: string, item: ComponentItem}[] = [];
      function collectTabs(item: ContentItem): void {
        if (((item): item is ComponentItem => item.isComponent)(item) && item.componentType === "MyComponent") {
          const componentState = item.toConfig().componentState as panelkaState;
          tabs.push({id: componentState.id, item});
        } else if (!item.isComponent) {
          for (const child of item.contentItems) {
            collectTabs(child);
          }
        }
      }

      collectTabs(this.layout.rootItem);
      return tabs;
    },
    findComponentItem(id: string): ComponentItem | null {
      if (this.layout?.rootItem === undefined) return null;

      function findItem(item: ContentItem): ComponentItem | null {
        if (((item): item is ComponentItem => item.isComponent)(item) && item.componentType === "MyComponent") {
          const componentState = item.toConfig().componentState as panelkaState;
          if (componentState.id === id) {
            return item;
          }
        } else if (!item.isComponent) {
          for (const child of item.contentItems) {
            const found = findItem(child);
            if (found !== null) return found;
          }
        }
        return null;
      }

      return findItem(this.layout.rootItem);
    },
    activateTab(tab: ComponentItem): void {
      if (tab.componentType !== "MyComponent") return;
      const id = (tab.toConfig().componentState as panelkaState).id;

      const root = this.layout?.rootItem;
      if (((root): root is Stack => root?.isStack === true)(root))
        root.setActiveComponentItem(tab, true);

      this.activeComponentID = id;
    },
  };
})();

const panelka = (id: string): ComponentItemConfig => ({
  type: "component",
  title: id,
  componentType: "MyComponent",
  componentState: {id: id}, // as panelkaState,
});

export async function send(id: string): Promise<void> {
  const res = await api.requestPerform(id);
  if (res.kind === "err") {
    notification.error({title: "Could not perform request", id, error: res.value});
    return;
  }

  store.requests2[id].history.push(res.value);
}

export async function update_request(id: string, patch: Partial<Request>): Promise<void> {
  const old_request = store.requests2[id].request;
  const new_request = {...old_request, ...patch} as RequestData;
  store.requests2[id].request = new_request as Request; // NOTE: optimistic update
  const res = await api.request_update(id, new_request.kind, new_request);
  if (res.kind === "err") {
    store.requests2[id].request = old_request; // NOTE: undo change
    notification.error({title: "Could not save current request", error: res.value});
    return;
  }
}

export async function get_request(request_id: string): Promise<get_request | null> {
  if (request_id in store.requests2) {
    return store.requests2[request_id];
  }

  const res = await api.get(request_id);
  if (res.kind === "err") {
    notification.error({title: "load request", id: request_id, error: res.value});
    return null;
  }

  // TODO: fix typing/move to api.ts, generated one is wrong since database.Request implements MarshalJSON
  const request = res.value.Request as unknown as Request;
  const history = res.value.History as unknown as HistoryEntry[];
  store.requests2[request_id] = {request, history};
  return store.requests2[request_id];
}

store.requestsTree.sub(function*() {
  yield;

  while (true) {
    const requestTree = yield;
    const cfg = store.layout;
    if (cfg?.rootItem === undefined)
      continue;

    const openTabIds = new Map<string, ComponentItem>();
    function dfs(c: ContentItem): void {
      if (((c): c is ComponentItem => c.isComponent)(c) && c.componentType === "MyComponent") {
        openTabIds.set((c.toConfig().componentState as panelkaState).id, c);
      } else if (!c.isComponent) {
        for (const child of c.contentItems) {
          dfs(child);
        }
      }
    }
    dfs(cfg.rootItem);

    const treeIds = new Set<string>();
    function collectIds(tree: app.Tree): void {
      for (const id in tree.IDs) {
        treeIds.add(id);
      }
      for (const dir in tree.Dirs) {
        collectIds(tree.Dirs[dir]);
      }
    }
    collectIds(requestTree);

    for (const [id, item] of openTabIds.entries()) {
      if (treeIds.has(id))
        continue;
      item.remove();
    }
  }
}());
