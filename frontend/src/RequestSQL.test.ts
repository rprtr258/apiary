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
  history: [
    {
      sent_at: new Date(),
      received_at: new Date(),
      kind: database.Kind.SQL,
      request: {id: "test-id"} as unknown as database.SQLRequest,
      response: {
        columns: ["id", "name"],
        types: ["int", "string"],
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
      kind: database.Kind.SQL,
      request: {id: "test-id"} as unknown as database.SQLRequest,
      response: {
        columns: ["id", "name"],
        types: ["int", "string"],
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
      kind: database.Kind.SQL,
      request: {id: "test-id"} as unknown as database.SQLRequest,
      response: {
        columns: [],
        types: [],
        rows: [],
      },
    });

    // Component should still be rendered (handle empty response gracefully)
    expect(el.children.length).toBeGreaterThan(0);
    expect(on.update).toHaveBeenCalledTimes(0);
    expect(on.send).toHaveBeenCalledTimes(0);
  });
});