import m from "mithril";
import {api, type RequestData, type HistoryEntry} from "./api";
import {app} from '../wailsjs/go/models';
import { ComponentItemConfig, GoldenLayout, LayoutConfig, ResolvedComponentItemConfig, ResolvedRowOrColumnItemConfig, ResolvedStackItemConfig } from "golden-layout";

// TODO: <NNotificationProvider :max="1" placement="bottom-right">
export function useNotification() {
  const notify = (...args: readonly unknown[]): void => {
    alert(JSON.stringify({title: "Error", content: args.map(arg => String(arg)).join("\n")}));
  };
  return {
    error: notify,
  };
}
export const notification = useNotification();

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
    layoutConfig = LayoutConfig.fromResolved(JSON.parse(oldTabs));
  }
})();
export function updateLocalstorageTabs() {
  const dump = JSON.stringify(store.layout?.saveLayout());
  localStorage.setItem("tabs", dump);
}

export function handleCloseTab(id: string) {
  console.log("handleCloseTab", id);
  // const v = store.tabs.value;
  // if (v === null) {
  //   return;
  // }
  // if (v.map.list.length === 1) {
  //   store.clearTabs();
  //   return;
  // }

  // // adjust index
  // const idx = v.map.index(id);
  // if (idx === null) {
  //   return;
  // }
  // if (idx <= v.index) {
  //   v.index = Math.max(v.index - 1, 0);
  // }
  // v!.map.remove(id);
  // store.tabs.value = {map: v.map, index: v.index};
  // store.selectRequest(v.map.list[v.index]);
  // updateLocalstorageTabs();
}

export function useStore() {
  const notify = notification.error;

  const load = () => {
    // if (!tabs.value) {
    //   return;
    // }

    // const indexesToRemove = tabs.value.map.list
    //   .map((id: string, i: number) => [id, i] as [string, number])
    //   .filter(([id]: readonly [string, number]) => !requests.hasOwnProperty(id))
    //   .map(([, i]: readonly [string, number]) => i);
    // if (indexesToRemove.length === 0) {
    //   return;
    // }

    // for (const i of indexesToRemove) {
    //   tabs.value.map.removeAt(i);
    //   if (tabs.value.index === i && tabs.value.index > 0) {
    //     tabs.value.index--;
    //   }
    // }
  };

  return {
    requestsTree : new app.Tree({IDs: [], Dirs: {}}) as app.Tree,
    requests : {} as Record<string, app.requestPreview>,
    requests2: {} as Record<string, UseRequest<any, any>>,
    load,
    layoutConfig,
    layout: undefined as GoldenLayout | undefined,
    clearTabs() {
      this.layout?.clear();
    },
    requestID(): string | null {
      // const tabsValue = tabs.value;
      // if (tabsValue === null) {
        return null;
      // }
      // const {map: requestIDs, index} = tabsValue;
      // return requestIDs.list[index] ?? null;
    },
    selectRequest(id: string): void {
      type ConfigNode = ResolvedRowOrColumnItemConfig | ResolvedStackItemConfig | ResolvedComponentItemConfig;
      function* dfs(c: ConfigNode): Generator<string, void, void> {
        if (c.type === "component") {
          yield (c.componentState! as {id: string}).id;
        } else {
          for (const child of c.content) {
            yield* dfs(child);
          }
        }
      }
      if (this.layout?.layoutConfig.root && dfs(this.layout?.layoutConfig.root).find((tabID) => tabID === id)) {
        return;
      }
      this.layout?.addItem(panelka(id));
      this.fetch();
    },
    async fetch(): Promise<void> {
      const json = await api.collectionRequests();
      if (json.kind === "err") {
        notification.error(`Could not fetch requests: ${json.value}`);
        return;
      }

      const res = json.value;
      this.requestsTree = res.Tree;

      const currentRequestId = this.requestID();

      for (const id in res.Requests) {
        if (id !== currentRequestId) {
          this.requests[id] = res.Requests[id];
        }
      }
      for (const id in this.requests) {
        if (!res.Requests.hasOwnProperty(id)) {
          delete this.requests[id];
        }
      }
    },
    async createRequest(id: string, kind: RequestData["kind"]): Promise<void> {
      const res = await api.requestCreate(id, kind);
      if (res.kind === "err") {
        notify(`Could not create request: ${res.value}`);
        return;
      }

      await this.fetch();
    },
    async duplicate(id: string): Promise<void> {
      const res = await api.requestDuplicate(id);
      if (res.kind === "err") {
        notify(`Could not duplicate: ${res.value}`);
        return;
      }

      await this.fetch();
    },
    async deleteRequest(id: string): Promise<void> {
      const res = await api.requestDelete(id);
      if (res.kind === "err") {
        notify(`Could not delete request: ${res.value}`);
        return;
      }
      if (this.requests.hasOwnProperty(id)) {
        delete this.requests[id];
      }
      await this.fetch();
    },
    async rename(id: string, newID: string): Promise<void> {
      console.log("rename", id, newID);
      const res = await api.rename(id, newID);
      if (res.kind === "err") {
        notify(`Could not rename request: ${res.value}`);
        return;
      }

      this.requests[newID] = Object.assign({}, this.requests[id]);
      // tabs.value?.map.rename(id, newID);
      await this.fetch();
    },
  };
}

const panelka = (id: string): ComponentItemConfig => ({
  type: "component",
  title: id,
  componentType: "MyComponent",
  componentState: {id: id} // as panelkaState,
});

type UseRequest<Request extends object, Response extends object> = {
  request: Request | null,
  history: HistoryEntry[],
  response: Response | null,
  is_loading: boolean,
  update_request: (patch: Partial<Request>) => Promise<void>,
  send: () => Promise<void>,
};
export function use_request<
  Request extends object,
  Response extends object,
>(request_id: string): UseRequest<Request, Response> {
  const notify = notification.error;

  store.requests2[request_id] = store.requests2[request_id] ?? {
    request: null,
    history: [],
    response: null,
    is_loading: true,
    send: async () => {
      if (store.requests2[request_id].request === null || store.requests2[request_id].is_loading) return;

      store.requests2[request_id].is_loading = true;
      const res = await api.requestPerform(request_id);
      store.requests2[request_id].is_loading = false;
      if (res.kind === "err") {
        notify(`Could not perform request ${request_id}: ${res.value}`);
        return;
      }

      store.requests2[request_id].history.push(res.value);
      store.requests2[request_id].response = res.value.response as Response;
    },
    update_request: async (patch: Partial<Request>) => {
      if (store.requests2[request_id].request === null || store.requests2[request_id].is_loading) return;

      store.requests2[request_id].is_loading = true;
      const old_request = store.requests2[request_id].request;
      const new_request = {...store.requests2[request_id].request, ...patch} as RequestData;
      store.requests2[request_id].request = new_request as Request; // NOTE: optimistic update
      const res = await api.request_update(request_id, new_request.kind, new_request);
      store.requests2[request_id].is_loading = false;
      if (res.kind === "err") {
        store.requests2[request_id].request = old_request; // NOTE: undo change
        notify(`Could not save current request: ${res.value}`);
        return;
      }
    },
  };
  const fetchData = async () => {
    store.requests2[request_id].is_loading = true;
    const res = await api.get(request_id);
    store.requests2[request_id].is_loading = false;
    if (res.kind === "err") {
      notify("load request", request_id, res.value);
      return;
    }

    store.requests2[request_id].request = res.value.Request as Request;
    store.requests2[request_id].history = res.value.History ?? [] as unknown as HistoryEntry[];
    store.requests2[request_id].response = store.requests2[request_id].history[store.requests2[request_id].history.length - 1]?.response as Response ?? null;
  };

  if (store.requests2[request_id].is_loading) {
    fetchData().then(m.redraw);
  }
  // const stopWatch = watch(() => request_id, fetchData, {immediate: true});
  // onUnmounted(() => {
  //   stopWatch();
  // });

  return store.requests2[request_id];
}

export const store = useStore();
(async () => {
  await store.fetch()
})().then(m.redraw);
