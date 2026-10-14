import {describe, test, expect, mock} from "bun:test";
import * as t from "@/types.ts";
import {Result, ok, err} from "@/result.ts";
import {signal} from "../../lib/utils.ts";
import {get_request} from "../../store.ts";

// Hoisted by bun to run before the viewer import below.
const explainCalls: string[] = [];
const mockPlan: t.SQLPlan = {
  root: {
    title: "Project",
    kind: "project",
    details: [],
    metrics: {},
    children: [
      {title: "Seq Scan on users", kind: "scan", table: "users", details: ["Filter: id = 1"], metrics: {"rows": "10"}, children: []},
    ],
  },
};
let explainResult: Result<t.SQLExplain> = ok({raw: "Project\n  -> Seq Scan on users", plan: mockPlan});
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
};

const sqlResponse = (rows: unknown[][]): t.HistoryEntry => ({
  sent_at: new Date(),
  received_at: new Date(),
  kind: t.Kind.SQL,
  request: {dsn: "", database: "postgres", query: ""},
  response: {
    columns: ["id", "name"],
    typenames: [t.ColumnType.NUMBER, t.ColumnType.STRING],
    types: [t.ColumnType.NUMBER, t.ColumnType.STRING],
    rows,
  },
} as unknown as t.HistoryEntry);

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

    expect(el.children.length).toBeGreaterThan(0);

    component.push_history_entry(sqlResponse([[1, "test"], [2, "test2"]]));

    const initialDataContainer = el.querySelector("[data-testid=\"data-container\"]");
    expect(initialDataContainer).not.toBeNull();

    component.push_history_entry(sqlResponse([[3, "new-test"], [4, "new-test2"]]));

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

    expect(el.children.length).toBeGreaterThan(0);

    component.push_history_entry(sqlResponse([]));

    expect(el.children.length).toBeGreaterThan(0);
    expect(on.update).toHaveBeenCalledTimes(0);
    expect(on.send).toHaveBeenCalledTimes(0);
  });

  test("plan tabs fetch the plan once and render diagram + raw text", async () => {
    explainCalls.length = 0;
    explainResult = ok({raw: "SCAN users\nFILTER id = 1", plan: mockPlan});
    const el = document.createElement("div");
    const show_request = signal(true);
    const component = RequestSQL(el, show_request, {
      update: mock(() => Promise.resolve()),
      send: mock(() => Promise.resolve()),
    });
    component.loaded({...mockRequest, request: {...mockRequest.request, kind: t.Kind.SQL, database: "sqlite"} as t.Request});

    const tabButton = (name: string) => [...el.querySelectorAll("button")].find(b => b.textContent === name)!;
    expect(tabButton("Plan")).toBeDefined();
    expect(tabButton("Plan (raw)")).toBeDefined();

    tabButton("Plan").click();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(explainCalls).toEqual(["test-id"]);
    // The diagram draws the parsed tree into its SVG node group.
    const nodes = el.querySelector("#plan-nodes");
    expect(nodes).not.toBeNull();
    expect(nodes!.textContent).toContain("Seq Scan on users");

    // The raw tab shows the backend text without refetching.
    tabButton("Plan (raw)").click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(explainCalls).toEqual(["test-id"]);
    const pre = el.querySelector("pre");
    expect(pre?.textContent).toContain("SCAN users");

    // A successful fetch stays cached across hide/show: no new round trip.
    tabButton("Data").click();
    tabButton("Plan").click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(explainCalls).toEqual(["test-id"]);
  });

  test("plan tab falls back to a hint when the plan does not parse", async () => {
    explainCalls.length = 0;
    explainResult = ok({raw: "unparseable"});
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
    expect(el.querySelector("#plan-nodes")).toBeNull();
    expect(el.textContent).toContain("Could not parse the plan");
  });

  test("plan tab retries a failed fetch when shown again", async () => {
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

    // Hiding the tab ("Data") and showing it again retries the failed EXPLAIN.
    explainResult = ok({raw: "SCAN users", plan: mockPlan});
    tabButton("Data").click();
    tabButton("Plan").click();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(explainCalls).toEqual(["test-id", "test-id"]);
    expect(el.querySelector("#plan-nodes")?.textContent).toContain("Seq Scan on users");

    // Switching to a different request fetches its own plan.
    component.loaded({...mockRequest, request: {...mockRequest.request, id: "other-id", kind: t.Kind.SQL, database: "sqlite"} as t.Request});
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(explainCalls).toEqual(["test-id", "test-id", "other-id"]);
  });
});
