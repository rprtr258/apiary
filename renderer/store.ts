import {z} from "zod";
import * as t from "@/types.ts";
import {api} from "./api.ts";
import {signal, Signal} from "./lib/utils.ts";
import {PersistRevertedError} from "./hooks/useRequest.ts";
import layout from "./layout.ts";
import {ItemConfig, LayoutConfig} from "./layout/types.ts";
import {ComponentItem, Stack} from "./layout/manager.ts";
import notification from "./lib/notification.ts";

export type StateRequest = {
  id: string,
};

// Identity part of persisted source-item viewer states ({sourceID, itemKey},
// see dedup in openViewer); plugin files extend it with component data.
export type ViewerState = {
  sourceID: string,
  itemKey: string,
};

const localStorageKey = "tabs";
function defaultLayoutConfig(): LayoutConfig {
  return {
    root: {
      type: "stack",
      content: [],
    },
  };
}

// Recursive item config schema: stack holds components only, row/column hold items.
// passthrough() keeps unvalidated keys (componentState, width, activeItemIndex, ...)
// intact, since the parsed config is stored and re-serialized as-is.
const componentSchema = z.object({
  type: z.literal("component"),
  title: z.string(),
  componentType: z.string(),
}).loose();
const itemSchema = z.lazy((): z.ZodType<ItemConfig> => z.union([
  componentSchema,
  z.object({
    type: z.literal("stack"),
    content: z.array(componentSchema),
  }).loose(),
  z.object({
    type: z.literal("row"),
    content: z.array(itemSchema),
  }).loose(),
  z.object({
    type: z.literal("column"),
    content: z.array(itemSchema),
  }).loose(),
]));
const layoutConfigSchema = z.object({
  root: itemSchema.optional(),
}).loose();

const layoutConfig: LayoutConfig = (() => {
  const oldTabs = localStorage.getItem(localStorageKey);
  if (oldTabs === null) {
    return defaultLayoutConfig();
  }
  try {
    return layoutConfigSchema.parse(JSON.parse(oldTabs));
  } catch {
    // Corrupt/legacy stored layout: fall through to the pristine default.
  }
  return defaultLayoutConfig();
})();
export function updateLocalstorage() {
  const dump = JSON.stringify(layout.instance?.layout);
  localStorage.setItem(localStorageKey, dump);
}

function findExistingTab<T>(
  componentType: string,
  predicate?: (state: T) => boolean,
): ComponentItem | undefined {
  return layout
    .instance
    ?.tabs()
    .filter(t => t.componentType === componentType)
    .find(t => predicate?.(t.toConfig().componentState as T) ?? true);
}

export type get_request = {
  request: t.Request,
  history: t.HistoryEntry[],
};
export function last_history_entry(request: get_request): t.HistoryEntry | undefined {
  return request.history[request.history.length - 1];
}

export type Store = {
  requestsTree : Signal<t.Tree>,
  requests : Record<string, t.requestPreview>,
  requests2: Record<string, get_request>,
  layoutConfig: LayoutConfig,
  get activeComponentID(): string | null,
  set activeComponentID(value: string | null),
  requestID(): string | null,
  selectRequest(id: string): void,
  fetch(): Promise<void>,
  createRequest(id: string, kind: t.RequestData["kind"]): Promise<void>,
  duplicate(id: string): Promise<void>,
  deleteRequest(id: string): Promise<void>,
  rename(id: string, newID: string): Promise<void>,
  openViewer<S extends ViewerState>(componentType: string, titlePart: string, state: S): void,
  // Tab navigation methods
  navigateToTab(direction: "next" | "prev"): void,
  selectTabByIndex(index: number): void,
  selectPaneByIndex(index: number): void,
  moveTab(direction: "right" | "left"): void,
  movePane(direction: "right" | "left" | "up" | "down"): void,
};

export const store = ((): Store => {
  let activeComponentID: string | null = null;
  type RequestTab = {id: string, item: ComponentItem};
  function activateTab({id, item}: RequestTab): void {
    layout.instance?.focus(item);
    activeComponentID = id;
  }
  function getActiveComponentItem(): ComponentItem | undefined {
    const activeID = activeComponentID;
    if (activeID === null) return undefined;

    return findExistingTab<StateRequest>("MyComponent", t => t.id === activeID);
  }
  return {
    requestsTree : signal({IDs: [], Dirs: {}}),
    requests : {},
    requests2: {},
    layoutConfig,
    get activeComponentID(): string | null {
      return activeComponentID;
    },
    set activeComponentID(value: string | null) {
      activeComponentID = value;
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
      layout.instance?.addItem("MyComponent", id, {id});
      this.fetch().catch(e => notification("error", "Failed to fetch requests", {error: e}));
    },
    async fetch(): Promise<void> {
      const json = await api.collectionRequests();
      if (json.kind === "err") {
        notification("error", "Could not fetch requests", {error: json.value});
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

      // paths in this.requests may change without the Tree structure changing (in-place rename),
      // so tree subscribers must be notified on every fetch
      this.requestsTree.update(() => res.Tree, true);
    },
    async createRequest(id: string, kind: t.RequestData["kind"]): Promise<void> {
      const res = await api.requestCreate(id, kind);
      if (res.kind === "err") {
        notification("error", "Could not create request", {error: res.value});
        return;
      }

      await this.fetch();
    },
    async duplicate(id: string): Promise<void> {
      const res = await api.requestDuplicate(id);
      if (res.kind === "err") {
        notification("error", "Could not duplicate", {error: res.value});
        return;
      }

      await this.fetch();
    },
    async deleteRequest(id: string): Promise<void> {
      const res = await api.requestDelete(id);
      if (res.kind === "err") {
        notification("error", "Could not delete request", {error: res.value});
        return;
      }
      if (id in this.requests) {
        delete this.requests[id];
      }
      if (id in this.requests2) {
        delete this.requests2[id];
      }
      persistSeqs.delete(id); // no in-flight persist can own a deleted request's state anymore
      lastPersisted.delete(id);
      lastPersistedSeqs.delete(id);
      await this.fetch();
    },
    async rename(id: string, newName: string): Promise<void> {
      const res = await api.rename(id, newName);
      if (res.kind === "err") {
        notification("error", "Could not rename request", {error: res.value});
        return;
      }

      // Update tab title for the renamed request
      const component = findExistingTab<StateRequest>("MyComponent", t => t.id === id);
      component?.tab.setTitle(newName);
      await this.fetch();
      // Refresh the undo target from the cached (last-known-persisted) request state; rename
      // does not change persisted data, this re-records the current object defensively.
      if (id in this.requests2) {
        lastPersisted.set(id, this.requests2[id].request);
      }
    },
    openViewer<S extends ViewerState>(componentType: string, titlePart: string, state: S): void {
      if (findExistingTab<S>(componentType, t => t.sourceID === state.sourceID && t.itemKey === state.itemKey) !== undefined)
        return;
      const sourceName = state.sourceID in this.requests
        ? t.pathToName(this.requests[state.sourceID].path) : state.sourceID;
      layout.instance?.addItem(componentType, `${sourceName}/${titlePart}`, state);
    },
    navigateToTab(direction: "next" | "prev"): void {
      const active = layout.instance?.activeTab();
      if (active === undefined || active.isNone())
        return;

      const parent = active.value.parent;
      if (!(parent instanceof Stack))
        return;

      const tabs = parent.contentItems;
      const currentIndex = tabs.indexOf(active.value);
      if (currentIndex === -1 || tabs.length <= 1)
        return;

      const nextTabIndex = {
        "next": (currentIndex + 1) % tabs.length,
        "prev": (currentIndex - 1 + tabs.length) % tabs.length,
      }[direction];
      this.selectTabByIndex(nextTabIndex);
    },
    selectTabByIndex(index: number): void {
      const active = layout.instance?.activeTab();
      if (active === undefined || active.isNone())
        return;

      const parent = active.value.parent;
      if (!(parent instanceof Stack))
        return;

      const tabs = parent.contentItems;
      if (index < 0 || index >= tabs.length)
        return;

      const tab = tabs[index];
      layout.instance?.focus(tab);
      activeComponentID = (tab.toConfig().componentState as Partial<StateRequest>).id ?? null;
    },
    selectPaneByIndex(index: number): void {
      const stacks = [...(layout.instance?.stacks() ?? [])];
      if (index < 0 || index >= stacks.length)
        return;

      const active = stacks[index].activeComponentItem;
      if (active.isNone())
        return;

      layout.instance?.focus(active.value);
      activeComponentID = (active.value.toConfig().componentState as Partial<StateRequest>).id ?? null;
    },
    moveTab(direction: "right" | "left"): void {
      const activeItem = getActiveComponentItem();
      if (activeItem === undefined)
        return;

      ({
        "right": () => layout.instance?.move(activeItem, i => i + 1),
        "left":  () => layout.instance?.move(activeItem, i => i - 1),
      })[direction]();
      updateLocalstorage();
    },
    movePane(direction: "right" | "left" | "up" | "down"): void {
      const active = layout.instance?.activeTab();
      if (active === undefined || active.isNone())
        return;

      const changed = {
        "right": () => layout.instance?.moveToNextGroup(active.value),
        "left":  () => layout.instance?.moveToPreviousGroup(active.value),
        "up":    () => layout.instance?.moveAbove(active.value),
        "down":  () => layout.instance?.moveBelow(active.value),
      }[direction]();
      if (changed ?? false)
        updateLocalstorage();
    },
  };
})();

export async function send(id: string): Promise<void> {
  const res = await api.requestPerform(id);
  if (res.kind === "err") {
    notification("error", "Could not perform request", {id, error: res.value});
    return;
  }

  store.requests2[id].history.push(res.value);
}

// Per-request persist sequence: incremented on entry; undo only while this call is still the
// newest persist. One hook update maps 1:1 onto one store update, so this mirrors useRequest's
// stale-token rule and both layers roll back together under concurrent failures (object identity
// would restore an older optimistic state when a newer persist's failure already reverted to it).
const persistSeqs = new Map<string, number>();
// Per-request last successfully persisted state: the undo target. Call-order old_request is not
// safe here — under overlapping persists it can be an earlier call's optimistic object whose IPC
// later failed, and undoing to it would silently resurrect a patch that never persisted.
const lastPersisted = new Map<string, t.Request>();
// Seq of the state currently recorded in lastPersisted. Successes are recorded only when they
// advance this (in-order successes and late out-of-order successes advance it; an even later
// success below the recorded seq must not regress the undo target below backend truth).
const lastPersistedSeqs = new Map<string, number>();

export async function update_request(id: string, patch: Partial<t.Request>): Promise<void> {
  const seq = (persistSeqs.get(id) ?? 0) + 1;
  persistSeqs.set(id, seq);
  const old_request = store.requests2[id].request;
  if (!lastPersisted.has(id)) {
    lastPersisted.set(id, old_request); // the pre-branch state is by definition the last persisted one
    lastPersistedSeqs.set(id, 0);
  }
  const {id: _id, path: _path, kind: _kind, ...old_data} = old_request;
  // patch may carry id/path/kind (full request from useRequest) — strip them from the merged result too,
  // otherwise they leak into the persisted Data and break Duplicate/Rename (stale ids in the copy).
  const {id: _sid, path: _spath, kind: _skind, ...new_data} = {...old_data, ...patch};
  const optimistic = {...old_request, ...new_data} as t.Request;
  store.requests2[id].request = optimistic; // NOTE: optimistic update, keeps id/path/kind from old_request
  const res = await api.request_update(id, old_request.kind, new_data as t.Request);
  if (res.kind === "err") {
    // Request deleted while the persist IPC was in flight: nothing to roll back (the maps
    // were cleared), and the stale-failure read below would dereference a missing entry.
    if (!(id in store.requests2)) {
      throw new PersistRevertedError(`Could not save current request: ${res.value}`, old_request);
    }
    // Undo only if no newer concurrent persist has started since (persistSeqs staleness rule).
    const is_newest = persistSeqs.get(id) === seq;
    const reverted = is_newest
      ? lastPersisted.get(id) ?? old_request // NOTE: undo to last persisted state
      : store.requests2[id].request; // stale failure: a newer persist owns the state
    if (is_newest) {
      store.requests2[id].request = reverted;
    }
    notification("error", "Could not save current request", {error: res.value});
    // Surface the failure plus the state we reverted to, so useRequest rolls its
    // optimistic state back to the same target instead of its own prevRequest
    // (which can be an older in-flight persist's never-persisted optimistic state).
    throw new PersistRevertedError(`Could not save current request: ${res.value}`, reverted);
  }
  // Record only successes newer than the last recorded one: an out-of-order (superseded)
  // success still becomes backend truth when its seq is above the recorded one (the newer
  // persist may still fail and roll back to it), but never regresses lastPersisted below
  // a newer success that already landed.
  if ((lastPersistedSeqs.get(id) ?? 0) < seq) {
    lastPersisted.set(id, optimistic);
    lastPersistedSeqs.set(id, seq);
  }
}

export async function get_request(request_id: string): Promise<get_request | null> {
  if (request_id in store.requests2) {
    return store.requests2[request_id];
  }

  const res = await api.get(request_id);
  if (res.kind === "err") {
    notification("error", "load request", {id: request_id, error: res.value});
    return null;
  }

  // Reshape raw IPC response into frontend types
  // The IPC Get function returns types.ts shapes ({ID, Path, Data, Responses}),
  // but components expect the flattened types.ts Request ({id, path, kind, ...fields})
  const raw = res.value;
  const kind = store.requests[request_id].kind;
  const requestData = raw.Request.Data;
  const responses = raw.History;

  const request = {
    id: raw.Request.ID,
    path: raw.Request.Path,
    kind,
    ...(requestData as Omit<t.Request, "id" | "path" | "kind">),
  } as t.Request;

  const history: t.HistoryEntry[] = responses.map(r => ({
    sent_at: new Date(r.sent_at),
    received_at: new Date(r.received_at),
    kind,
    request: requestData,
    response: r.response,
  } as t.HistoryEntry));

  store.requests2[request_id] = {request, history};
  return store.requests2[request_id];
}

store.requestsTree.sub(function*() {
  yield;

  while (true) {
    const requestTree = yield;
    const openTabIds = new Map<string, ComponentItem>();
    for (const c of (layout.instance?.tabs() ?? []).filter(c => c.componentType === "MyComponent"))
      openTabIds.set((c.toConfig().componentState as StateRequest).id, c);

    function* collectIds(tree: t.Tree): Generator<string> {
      yield* tree.IDs;
      for (const dir in tree.Dirs) {
        yield* collectIds(tree.Dirs[dir]);
      }
    }
    const treeIds = new Set(collectIds(requestTree)); // TODO: get straight from previews map

    for (const [id, item] of openTabIds.entries()) {
      if (treeIds.has(id))
        continue;
      item.remove();
    }
  }
}());
