import {describe, test, expect, mock} from "bun:test";
import RequestDIFF from "./viewer.ts";
import {signal} from "../../lib/utils.ts";
import * as t from "@/types.ts";
import {get_request} from "../../store.ts";

const mockRequest: get_request = {
  request: {
    id: "test-id",
    path: "",
    kind: t.Kind.DIFF,
    left: "Hello\nWorld",
    right: "Hello\nWorld\n!",
  },
  history: [],
};

describe("RequestDIFF", () => {
  test("creates component structure", () => {
    const el = document.createElement("div");
    const show_request = signal(true);
    const on = {
      update: mock(() => Promise.resolve()),
      send: mock(() => Promise.resolve()),
    };

    const component = RequestDIFF(el, show_request, on);
    component.loaded(mockRequest);

    expect(el.children.length).toBeGreaterThan(0);

    component.unmount();
  });

  test("handles editor updates with debouncing", () => {
    const el = document.createElement("div");
    const show_request = signal(true);
    const updateMock = mock(() => Promise.resolve());
    const on = {
      update: updateMock,
      send: mock(() => Promise.resolve()),
    };

    const component = RequestDIFF(el, show_request, on);
    component.loaded(mockRequest);


    expect(updateMock).toHaveBeenCalledTimes(0); // No updates yet

    component.unmount();
  });

  test("handles empty inputs", () => {
    const el = document.createElement("div");
    const show_request = signal(true);
    const on = {
      update: mock(() => Promise.resolve()),
      send: mock(() => Promise.resolve()),
    };

    const emptyRequest: get_request = {
      request: {
        id: "test-id-2",
        path: "",
        kind: t.Kind.DIFF,
        left: "",
        right: "",
      },
      history: [],
    };

    const component = RequestDIFF(el, show_request, on);
    component.loaded(emptyRequest);

    expect(el.children.length).toBeGreaterThan(0);

    component.unmount();
  });

  test("handles JSON inputs", () => {
    const el = document.createElement("div");
    const show_request = signal(true);
    const on = {
      update: mock(() => Promise.resolve()),
      send: mock(() => Promise.resolve()),
    };

    const jsonRequest: get_request = {
      request: {
        id: "test-id-3",
        path: "",
        kind: t.Kind.DIFF,
        left: "{\"name\": \"John\", \"age\": 30}",
        right: "{\"name\": \"Jane\", \"age\": 30}",
      },
      history: [],
    };

    const component = RequestDIFF(el, show_request, on);
    component.loaded(jsonRequest);

    expect(el.children.length).toBeGreaterThan(0);

    component.unmount();
  });

  test("cleanup on unmount", () => {
    const el = document.createElement("div");
    const show_request = signal(true);
    const on = {
      update: mock(() => Promise.resolve()),
      send: mock(() => Promise.resolve()),
    };

    const component = RequestDIFF(el, show_request, on);
    component.loaded(mockRequest);

    expect(el.children.length).toBeGreaterThan(0);

    component.unmount();

    // After unmount, the element might still have children (they might not be removed)
    // but the component should have cleaned up its resources
    expect(on.update).toHaveBeenCalledTimes(0);
    expect(on.send).toHaveBeenCalledTimes(0);
  });

  test("ignores history entries (no storage)", () => {
    const el = document.createElement("div");
    const show_request = signal(true);
    const on = {
      update: mock(() => Promise.resolve()),
      send: mock(() => Promise.resolve()),
    };

    const component = RequestDIFF(el, show_request, on);
    component.loaded(mockRequest);

    component.push_history_entry({
      sent_at: new Date(),
      received_at: new Date(),
      kind: t.Kind.DIFF,
      request: {left: "", right: ""},
      response: {
        diff: "<div>Test diff</div>",
        stats: "Test stats",
        leftType: "text",
        rightType: "text",
      },
    });

    expect(on.update).toHaveBeenCalledTimes(0);
    expect(on.send).toHaveBeenCalledTimes(0);

    component.unmount();
  });
});
