import {ComponentItem, LayoutConfig, ResolvedLayoutConfig} from "golden-layout";
import {database, app} from "../wailsjs/go/models.ts";
import {api} from "./api.ts";
import {type RequestData, type HistoryEntry, Request} from "./types.ts";
import {signal, Signal} from "./utils.ts";
import layout from "./layout.ts";
import notification from "./notification.ts";

export type StateRequest = {
  id: string,
};
export type StateSQLSourceTable = {
  sqlSourceID: string,
  tableName: string,
  tableInfo: database.TableInfo,
};
export type StateHTTPSourceEndpoint = {
  sourceID: string,
  endpointIndex: number,
  endpointInfo: database.EndpointInfo,
};
export type State = StateRequest | StateSQLSourceTable | StateHTTPSourceEndpoint;

const localStorageKey = "tabs";
const layoutConfig: LayoutConfig = (() => {
  const oldTabs = localStorage.getItem(localStorageKey);
  if (oldTabs !== null) {
    return LayoutConfig.fromResolved(JSON.parse(oldTabs) as ResolvedLayoutConfig);
  }
  return {
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
})();
export function updateLocalstorage() {
  const dump = JSON.stringify(layout.instance?.saveLayout());
  localStorage.setItem(localStorageKey, dump);
}

function findExistingTab<T>(
  componentType: string,
  predicate?: (state: T) => boolean,
): ComponentItem | undefined {
  return layout
    .tabs()
    .filter(t => t.componentType === componentType)
    .find(t => predicate?.(t.toConfig().componentState as T) ?? true);
}

export function handleCloseTab(id: string) {
  // Find the component with the given ID
  const tab = findExistingTab<StateRequest>("MyComponent", t => t.id === id);
  if (tab === undefined) {
    notification.error({title: "Component not found", id});
    return;
  }

  tab.remove();
  updateLocalstorage();
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
  get activeComponentID(): string | null,
  set activeComponentID(value: string | null),
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
};

export const store = ((): Store => {
  let activeComponentID: string | null = null;
  type RequestTab = {id: string, item: ComponentItem};
  function getAllOpenTabs(): RequestTab[] {
    return layout
      .tabs()
      .filter(item => item.componentType === "MyComponent")
      .map(item => ({
        id: (item.toConfig().componentState as StateRequest).id,
        item,
      }))
      .toArray();
  }
  function activateTab({id, item}: RequestTab): void {
    layout.focus(item);
    activeComponentID = id;
  }
  function getActiveComponentItem(): ComponentItem | undefined {
    const activeID = activeComponentID;
    if (activeID === null) return undefined;

    return findExistingTab<StateRequest>("MyComponent", t => t.id === activeID);
  }
  return {
    requestsTree : signal(new app.Tree({IDs: {}, Dirs: {}})),
    requests : {} as Record<string, app.requestPreview>,
    requests2: {} as Record<string, get_request>,
    requestNames: {} as Record<string, string>,
    layoutConfig,
    get activeComponentID(): string | null {
      return activeComponentID;
    },
    set activeComponentID(value: string | null) {
      activeComponentID = value;
    },
    clearTabs() {
      layout.clear();
      activeComponentID = null;
    },
    requestID(): string | null {
      // Return the tracked active component ID if available
      if (this.activeComponentID !== null)
        return this.activeComponentID;

      // Fallback, find the first component if no active component is tracked
      const c = findExistingTab("MyComponent")?.toConfig().componentState;
      return (c as StateRequest | undefined)?.id ?? null;
    },
    selectRequest(id: string): void {
      const tab = findExistingTab<StateRequest>("MyComponent", t => t.id === id);
      if (tab !== undefined) {
        activateTab({id, item: tab});
        return;
      }
      layout.addItem("MyComponent", id, {id});
      this.fetch().catch(e => notification.error({title: "Failed to fetch requests", error: e}));
    },
    async fetch(): Promise<void> {
      const json = await api.collectionRequests();
      if (json.kind === "err") {
        notification.error({title: "Could not fetch requests", error: json.value});
        return;
      }

      const res = json.value;

      for (const id in res.Requests) {
        this.requests[id] = res.Requests[id];
      }
      for (const id in this.requests) {
        if (!(id in res.Requests)) {
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
      if (id in this.requests) {
        delete this.requests[id];
      }
      if (id in this.requests2) {
        delete this.requests2[id];
      }
      await this.fetch();
    },
    async rename(id: string, newName: string): Promise<void> {
      const res = await api.rename(id, newName);
      if (res.kind === "err") {
        notification.error({title: "Could not rename request", error: res.value});
        return;
      }

      // Update tab title for the renamed request
      const component = findExistingTab<StateRequest>("MyComponent", t => t.id === id);
      component?.tab.setTitle(newName);
      await this.fetch();
    },
    openTableViewer(sqlSourceID: string, tableName: string, tableInfo: database.TableInfo): void {
      if (findExistingTab<StateSQLSourceTable>("TableViewer", t => t.sqlSourceID === sqlSourceID && t.tableName === tableName) !== undefined)
        return;

      const sourceName = this.requestNames[sqlSourceID] ?? sqlSourceID;
      layout.addItem("TableViewer", `${sourceName}/${tableName}`, {sqlSourceID, tableName, tableInfo});
    },
    openEndpointViewer(sourceID: string, endpointIndex: number, endpointInfo: database.EndpointInfo): void {
      if (findExistingTab<StateHTTPSourceEndpoint>("EndpointViewer", t => t.sourceID === sourceID && t.endpointIndex === endpointIndex) !== undefined)
        return;

      const sourceName = this.requestNames[sourceID] ?? sourceID;
      layout.addItem("EndpointViewer", `${sourceName}/${endpointInfo.method} ${endpointInfo.path}`, {sourceID, endpointIndex, endpointInfo});
    },
    navigateToNextTab(): void {
      const allTabs = getAllOpenTabs();
      if (allTabs.length === 0) return;

      const currentID = this.requestID();
      if (currentID === null) {
        // If no tab is active, activate the first one
        activateTab(allTabs[0]);
        return;
      }

      const currentIndex = allTabs.findIndex(tab => tab.id === currentID);
      if (currentIndex === -1) return;

      const nextIndex = (currentIndex + 1) % allTabs.length;
      activateTab(allTabs[nextIndex]);
    },
    navigateToPreviousTab(): void {
      const allTabs = getAllOpenTabs();
      if (allTabs.length === 0) return;

      const currentID = this.requestID();
      if (currentID === null) {
        // If no tab is active, activate the last one
        activateTab(allTabs[allTabs.length - 1]);
        return;
      }

      const currentIndex = allTabs.findIndex(tab => tab.id === currentID);
      if (currentIndex === -1) return;

      const prevIndex = (currentIndex - 1 + allTabs.length) % allTabs.length;
      activateTab(allTabs[prevIndex]);
    },
    moveTabRight(): void {
      const activeItem = getActiveComponentItem();
      if (activeItem === undefined)
        return;

      layout.move(activeItem, i => i + 1);
      updateLocalstorage();
    },
    moveTabLeft(): void {
      const activeItem = getActiveComponentItem();
      if (activeItem === undefined)
        return;

      layout.move(activeItem, i => i - 1);
      updateLocalstorage();
    },
  };
})();

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

store.requestsTree.sub(function*(): Generator<undefined, never, app.Tree> {
  yield;

  while (true) {
    const requestTree = yield;
    const openTabIds = new Map<string, ComponentItem>();
    for (const c of layout.tabs().filter(c => c.componentType === "MyComponent"))
      openTabIds.set((c.toConfig().componentState as StateRequest).id, c);

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
