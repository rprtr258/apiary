import {describe, test, expect, mock} from "bun:test";
import * as t from "@/types.ts";
import {ok, err} from "@/result.ts";
import {signal} from "../../lib/utils.ts";
import {get_request} from "../../store.ts";

// Hoisted by bun to run before the viewer import below.
const explainCalls: string[] = [];
let explainResult = ok({raw: "Project\n  -> Seq Scan on users"});
mock.module("../../api.ts", () => ({
  api: {
    requestExplainSQL: async (id: string) => {
      explainCalls.push(id);
      return explainResult;
    },
  },
}));

import RequestSQL from "./viewer.ts";

const mockRequest: get_request = {
  request: {
    id: "test-id",
    path: "",
    kind: t.Kind.SQL,
    database: "postgres",
    dsn: "test-dsn",
    query: "SELECT * FROM test",
  },
  history: [
    {
      sent_at: new Date(),
      received_at: new Date(),
      kind: t.Kind.SQL,
      request: {dsn: "", database: "postgres", query: ""},
      response: {
        columns: ["id", "name"],
        typenames: [t.ColumnType.NUMBER, t.ColumnType.STRING],
        types: [t.ColumnType.NUMBER, t.ColumnType.STRING],
        rows: [[1, "test"], [2, "test2"]],
      },
    },
  ],
};

describe("RequestSQL", () => {
  test("reuses table element on response updates", () => {
    const el = document.createElement("div");
    const show_request = signal(true);
    const on = {
      update: mock(() => Promise.resolve()),
      send: mock(() => Promise.resolve()),
    };

    const component = RequestSQL(el, show_request, on);
    component.loaded(mockRequest);

    // Check that data view is created (not a table, but a div with grid display)
    // The component should render something with data
    expect(el.children.length).toBeGreaterThan(0);

    // Get the initial data container
    const initialDataContainer = el.querySelector("[data-testid=\"data-container\"]");
    expect(initialDataContainer).not.toBeNull();

    component.push_history_entry({
      sent_at: new Date(),
      received_at: new Date(),
      kind: t.Kind.SQL,
      request: {dsn: "", database: "postgres", query: ""},
      response: {
        columns: ["id", "name"],
        typenames: [t.ColumnType.NUMBER, t.ColumnType.STRING],
        types: [t.ColumnType.NUMBER, t.ColumnType.STRING],
        rows: [[3, "new-test"], [4, "new-test2"]],
      },
    });

    // Check that data is still displayed (component should handle new response)
    const updatedDataContainer = el.querySelector("[style*=\"display: grid\"]");
    expect(updatedDataContainer).not.toBeNull();
  });

  test("handles empty response", () => {
    const el = document.createElement("div");
    const show_request = signal(true);
    const on = {
      update: mock(() => Promise.resolve()),
      send: mock(() => Promise.resolve()),
    };

    const component = RequestSQL(el, show_request, on);
    component.loaded(mockRequest);

    // Component should render something
    expect(el.children.length).toBeGreaterThan(0);

    component.push_history_entry({
      sent_at: new Date(),
      received_at: new Date(),
      kind: t.Kind.SQL,
      request: {dsn: "", database: "postgres", query: ""},
      response: {
        columns: [],
        typenames: [],
        types: [],
        rows: [],
      },
    });

    // Component should still be rendered (handle empty response gracefully)
    expect(el.children.length).toBeGreaterThan(0);
    expect(on.update).toHaveBeenCalledTimes(0);
    expect(on.send).toHaveBeenCalledTimes(0);
  });

  test("explain tab fetches the plan on open and renders it as text", async () => {
    explainCalls.length = 0;
    explainResult = ok({raw: "SCAN users\nFILTER id = 1"});
    const el = document.createElement("div");
    const show_request = signal(true);
    const component = RequestSQL(el, show_request, {
      update: mock(() => Promise.resolve()),
      send: mock(() => Promise.resolve()),
    });
    component.loaded({...mockRequest, request: {...mockRequest.request, kind: t.Kind.SQL, database: "sqlite"} as t.Request});

    const explainButton = [...el.querySelectorAll("button")].find(b => b.textContent === "Plan");
    expect(explainButton).toBeDefined();
    explainButton!.click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(explainCalls).toEqual(["test-id"]);
    const pre = el.querySelector("pre");
    expect(pre?.textContent).toContain("SCAN users");
  });

  test("explain tab keeps the plan while the request is unchanged and shows errors", async () => {
    explainCalls.length = 0;
    explainResult = err("postgres connection failed");
    const el = document.createElement("div");
    const show_request = signal(true);
    const component = RequestSQL(el, show_request, {
      update: mock(() => Promise.resolve()),
      send: mock(() => Promise.resolve()),
    });
    component.loaded({...mockRequest, request: {...mockRequest.request, kind: t.Kind.SQL, database: "sqlite"} as t.Request});

    const tabButton = (name: string) => [...el.querySelectorAll("button")].find(b => b.textContent === name)!;
    tabButton("Plan").click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(explainCalls).toEqual(["test-id"]);
    expect(el.querySelector("pre")?.textContent).toContain("postgres connection failed");

    // Same request: cached, no refetch.
    tabButton("Data").click();
    tabButton("Plan").click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(explainCalls).toEqual(["test-id"]);

    // Request switch resets the cache: the next open fetches again.
    component.loaded({...mockRequest, request: {...mockRequest.request, id: "other-id", kind: t.Kind.SQL, database: "sqlite"} as t.Request});
    tabButton("Plan").click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(explainCalls).toEqual(["test-id", "other-id"]);
  });
});
