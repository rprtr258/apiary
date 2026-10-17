import {describe, expect, test, mock, beforeEach} from "bun:test";
import {ok} from "@/result.ts";
import {Kind, type ListResponse, type requestPreview} from "@/types.ts";
import {getCommandPaletteItems, getOpenRequestItems} from "./App.ts";
import {store} from "./store.ts";

const createDraft = mock((_kind: Kind, _data?: unknown) => Promise.resolve(ok("dn")));
const notify = mock((_type: string, _title: string, _args: Record<string, unknown>) => {});

mock.module("./api.ts", () => ({api: {
  collectionRequests: (): Promise<ReturnType<typeof ok<ListResponse>>> => Promise.resolve(ok({
    Tree: {IDs: [], Dirs: {}},
    Requests: {},
    Drafts: {},
  })),
  createDraft,
}}));

mock.module("./layout.ts", () => ({default: {
  instance: undefined,
}}));

mock.module("./lib/notification.ts", () => ({default: notify}));

const httpData = {url: "http://x", method: "GET", body: "", headers: []};

function setupPreviews(draft: number | undefined): void {
  const previews: Record<string, requestPreview> = {
    d1: {path: "draft 1", kind: Kind.HTTP, subKind: ""},
  };
  store.requests = previews;
  store.drafts = draft !== undefined ? {d1: draft} : {};
  store.requests2 = {
    d1: {request: {id: "d1", path: "draft 1", kind: Kind.HTTP, ...httpData}},
  };
  store.activeComponentID = "d1";
}

describe("draft palette", () => {
  beforeEach(() => {
    mock.clearAllMocks();
    store.requests = {};
    store.drafts = {};
    store.requests2 = {};
    store.activeComponentID = null;
  });

  test("draft tab gets draft-specific labels and keeps Run", () => {
    setupPreviews(1);
    const labels = getCommandPaletteItems().map(item => item.label);
    expect(labels).toContain("Run");
    expect(labels).toContain("Save current (draft 1)");
    expect(labels).toContain("Duplicate current draft");
    expect(labels).toContain("Delete current draft");
    expect(labels).not.toContain("Rename current (draft 1)");
    expect(labels).not.toContain("Duplicate current (draft 1)");
    expect(labels).not.toContain("Delete current (draft 1)");
  });

  test("Save current has the Ctrl+S shortcut", () => {
    setupPreviews(1);
    const item = getCommandPaletteItems().find(item => item.label === "Save current (draft 1)");
    expect(item?.shortcut).toEqual(["Ctrl", "S"]);
  });

  test("stored request keeps the existing labels", () => {
    setupPreviews(undefined);
    const labels = getCommandPaletteItems().map(item => item.label);
    expect(labels).toContain("Rename current (draft 1)");
    expect(labels).toContain("Duplicate current (draft 1)");
    expect(labels).toContain("Delete current (draft 1)");
    expect(labels).not.toContain("Save current (draft 1)");
  });

  test("New draft palette entry exists", () => {
    const labels = getCommandPaletteItems().map(item => item.label);
    expect(labels).toContain("New draft");
  });

  test("Duplicate current draft creates a new draft with the same data", async () => {
    setupPreviews(1);
    const item = getCommandPaletteItems().find(item => item.label === "Duplicate current draft");
    item?.perform();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(createDraft).toHaveBeenCalledWith(Kind.HTTP, httpData);
  });

  test("Duplicate current draft without loaded data notifies instead of silently doing nothing", () => {
    setupPreviews(1);
    store.requests2 = {};
    const item = getCommandPaletteItems().find(item => item.label === "Duplicate current draft");
    item?.perform();
    expect(createDraft).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith("error", "Duplicate failed", {content: "Draft data is not loaded"});
  });

  test("drafts are filtered out of the Open list", () => {
    setupPreviews(1);
    store.requests = {
      ...store.requests,
      s1: {path: "/group/stored", kind: Kind.HTTP, subKind: ""},
    };
    const labels = getOpenRequestItems().map(item => item.label);
    expect(labels).toEqual(["/group/stored"]);
  });
});
