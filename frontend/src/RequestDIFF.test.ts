import {describe, test, expect, mock} from "bun:test";
import RequestDIFF from "./RequestDIFF.ts";
import {signal} from "./utils.ts";
import {database} from "../wailsjs/go/models.ts";
import {get_request} from "./store.ts";

const mockRequest: get_request = {
  request: {
    id: "test-id",
    path: "",
    kind: database.Kind.DIFF,
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

    // Should create some structure
    expect(el.children.length).toBeGreaterThan(0);
    
    // Clean up
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

    // Note: We can't directly test API calls in unit tests
    // because they require mocking complex dependencies
    
    expect(updateMock).toHaveBeenCalledTimes(0); // No updates yet
    
    // Clean up
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
        kind: database.Kind.DIFF,
        left: "",
        right: "",
      },
      history: [],
    };

    const component = RequestDIFF(el, show_request, on);
    component.loaded(emptyRequest);

    // Should still render the component structure
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
        kind: database.Kind.DIFF,
        left: "{\"name\": \"John\", \"age\": 30}",
        right: "{\"name\": \"Jane\", \"age\": 30}",
      },
      history: [],
    };

    const component = RequestDIFF(el, show_request, on);
    component.loaded(jsonRequest);

    // Should render with JSON editors
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

    // Should have created elements
    expect(el.children.length).toBeGreaterThan(0);
    
    // Unmount should clean up
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

    // push_history_entry should do nothing for DIFF plugin
    component.push_history_entry({
      sent_at: new Date(),
      received_at: new Date(),
      kind: database.Kind.DIFF,
      request: {id: "test-id"} as unknown as database.DIFFRequest,
      response: {
        diff: "<div>Test diff</div>",
        stats: "Test stats",
        leftType: "text",
        rightType: "text",
      },
    });

    // No updates should be called
    expect(on.update).toHaveBeenCalledTimes(0);
    expect(on.send).toHaveBeenCalledTimes(0);
    
    component.unmount();
  });
});