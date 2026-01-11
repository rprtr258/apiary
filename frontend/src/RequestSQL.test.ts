import {describe, test, expect, mock} from "bun:test";
import RequestSQL from "./RequestSQL.ts";
import {signal} from "./utils.ts";
import {database} from "../wailsjs/go/models.ts";
import {get_request} from "./store.ts";

const mockRequest: get_request = {
  request: {
    id: "test-id",
    path: "",
    kind: database.Kind.SQL,
    database: database.Database.POSTGRES,
    dsn: "test-dsn",
    query: "SELECT * FROM test",
  },
  history: [],
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

    // Check that table is created
    const table = el.querySelector("table")!;
    const tbody = table.querySelector("tbody")!;
    expect(tbody.children.length).toBe(0); // No rows initially

    component.push_history_entry({
      sent_at: new Date(),
      received_at: new Date(),
      kind: database.Kind.SQL,
      request: {id: "test-id"} as unknown as database.SQLRequest,
      response: {
        columns: ["id", "name"],
        types: ["int", "string"],
        rows: [[1, "test"], [2, "test2"]],
      },
    });

    // Check table is the same element
    const newTable = el.querySelector("table");
    expect(newTable).toBe(table);

    // Check tbody has new rows
    expect(tbody.children.length).toBe(2);
    expect(tbody.children[0].children[0].textContent).toBe("1");
    expect(tbody.children[0].children[1].textContent).toBe("test");
    expect(on.update).toHaveBeenCalledTimes(0);
    expect(on.send).toHaveBeenCalledTimes(0);
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

    const table = el.querySelector("table")!;
    const tbody = table.querySelector("tbody")!;

    component.push_history_entry({
      sent_at: new Date(),
      received_at: new Date(),
      kind: database.Kind.SQL,
      request: {id: "test-id"} as unknown as database.SQLRequest,
      response: {columns: [], rows: [], types: []},
    });

    expect(tbody.children.length).toBe(0);
    expect(on.update).toHaveBeenCalledTimes(0);
    expect(on.send).toHaveBeenCalledTimes(0);
  });
});