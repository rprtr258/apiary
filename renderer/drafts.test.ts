import {describe, expect, test, mock, beforeEach} from "bun:test";
import {ok, err} from "@/result.ts";
import {Kind, type ListResponse, type requestPreview} from "@/types.ts";
import {store} from "./store.ts";

let nextDraftID = "draft-new";
let draftResult: "ok" | "err" = "ok";
let previews: Record<string, requestPreview> = {};
let drafts: Record<string, number> = {};

const createDraft = mock((_kind: Kind, _data?: unknown) =>
  draftResult === "ok" ?
    Promise.resolve(ok(nextDraftID)) :
    Promise.resolve(err("boom")),
);
const requestDelete = mock((id: string) => {
  // Simulate the backend: Delete drops the record and its drafts entry
  previews = Object.fromEntries(Object.entries(previews).filter(([key]) => key !== id));
  drafts = Object.fromEntries(Object.entries(drafts).filter(([key]) => key !== id));
  return Promise.resolve(ok(undefined));
});

mock.module("./api.ts", () => ({api: {
  collectionRequests: (): Promise<ReturnType<typeof ok<ListResponse>>> => Promise.resolve(ok({
    Tree: {IDs: [], Dirs: {}},
    Requests: previews,
    Drafts: drafts,
  })),
  createDraft: createDraft,
  requestDelete: requestDelete,
}}));

type FakeTab = {
  componentType: string,
  componentState: unknown,
  toConfig: () => {type: "component", title: string, componentType: string, componentState: unknown},
  remove: () => void,
};

const fakeTabs = new Map<string, FakeTab>();
const removeTab = mock((id: string) => {
  fakeTabs.delete(id);
});

const fakeLayout = {
  instance: {
    tabs: (): FakeTab[] => Array.from(fakeTabs.values()),
    addItem: (title: string, type: string, state: {id: string}): void => {
      fakeTabs.set(state.id, {
        componentType: type,
        componentState: state,
        toConfig: () => ({type: "component", title, componentType: type, componentState: state}),
        remove: () => removeTab(state.id),
      });
    },
    focus: (_item: unknown): void => {},
  },
};
mock.module("./layout.ts", () => ({default: fakeLayout}));

function addTab(id: string): void {
  fakeLayout.instance.addItem(id, "MyComponent", {id});
}

describe("drafts store", () => {
  beforeEach(() => {
    mock.clearAllMocks();
    fakeTabs.clear();
    previews = {};
    drafts = {};
    store.requests = {};
    store.drafts = {};
    store.requests2 = {};
    store.activeComponentID = null;
    nextDraftID = "draft-new";
    draftResult = "ok";
  });

  test("createDraft calls the IPC, refreshes previews and opens the draft tab", async () => {
    previews = {dn: {path: "draft 1", kind: Kind.HTTP, subKind: "http"}};
    drafts = {dn: 1};
    nextDraftID = "dn";
    const data = {url: "http://x", method: "GET", body: "", headers: []};
    await store.createDraft(Kind.HTTP, data);
    expect(createDraft).toHaveBeenCalledWith(Kind.HTTP, data);
    expect(store.requests["dn"]).toBeDefined();
    expect(fakeTabs.has("dn")).toBe(true);
  });

  test("createDraft without data calls the IPC with no data and still opens the tab", async () => {
    previews = {dn: {path: "draft 1", kind: Kind.SQL, subKind: "sql"}};
    drafts = {dn: 1};
    nextDraftID = "dn";
    await store.createDraft(Kind.SQL);
    expect(createDraft).toHaveBeenCalledWith(Kind.SQL, undefined);
    expect(fakeTabs.has("dn")).toBe(true);
  });

  test("createDraft error opens no tab", async () => {
    draftResult = "err";
    await store.createDraft(Kind.HTTP);
    expect(fakeTabs.size).toBe(0);
    expect(store.activeComponentID).toBe(null);
  });

  test("watcher liveness comes from the previews map: draft tabs survive tree refreshes", () => {
    const draftPreview: requestPreview = {path: "draft 1", kind: Kind.HTTP, subKind: ""};
    const storedPreview: requestPreview = {path: "/stored", kind: Kind.HTTP, subKind: ""};
    previews = {d1: draftPreview, s1: storedPreview};
    drafts = {d1: 1};
    store.requests = {...previews};
    store.drafts = {...drafts};
    addTab("d1");
    addTab("s1");

    store.requestsTree.update(x => x, true);
    expect(removeTab).not.toHaveBeenCalled();

    // stored request disappears from previews -> its tab is closed
    store.requests = {d1: draftPreview};
    store.requestsTree.update(x => x, true);
    expect(removeTab.mock.calls.map(call => call[0])).toEqual(["s1"]);

    // draft disappears from previews -> its tab is closed too
    store.requests = {};
    store.requestsTree.update(x => x, true);
    expect(removeTab.mock.calls.map(call => call[0])).toEqual(["s1", "d1"]);
  });

  test("isDraft distinguishes draft previews from stored requests and unknown ids", () => {
    store.requests = {
      d1: {path: "draft 1", kind: Kind.HTTP, subKind: ""},
      s1: {path: "/stored", kind: Kind.HTTP, subKind: ""},
    };
    store.drafts = {d1: 1};
    expect(store.isDraft("d1")).toBe(true);
    expect(store.isDraft("s1")).toBe(false);
    expect(store.isDraft("nope")).toBe(false);
  });

  test("cleanupDrafts deletes orphaned drafts through Delete and evicts their cached data", async () => {
    previews = {
      d1: {path: "draft 1", kind: Kind.HTTP, subKind: ""},
      d2: {path: "draft 2", kind: Kind.SQL, subKind: ""},
      s1: {path: "/stored", kind: Kind.HTTP, subKind: ""},
    };
    drafts = {d1: 1, d2: 2};
    store.requests = {...previews};
    store.drafts = {...drafts};
    store.requests2 = {d2: {request: {id: "d2", path: "draft 2", kind: Kind.SQL, dsn: "", database: "postgres", query: ""}}};

    await store.cleanupDrafts(["d1"]);

    expect(requestDelete).toHaveBeenCalledWith("d2");
    expect(store.requests["d2"]).toBeUndefined();
    expect(store.requests["d1"]).toBeDefined();
    expect(store.requests["s1"]).toBeDefined();
    expect(store.requests2["d2"]).toBeUndefined();
    expect(store.drafts["d2"]).toBeUndefined();
    expect(store.drafts["d1"]).toBe(1);
  });
});
