import {describe, expect, test} from "bun:test";
import {m} from "../utils.ts";
import NRequestForm from "./NRequestForm.ts";
import type {HTTPRequest} from "../types.ts";

describe("NRequestForm", () => {
  test("renders with initial request", () => {
    const container = m("div", {});

    const initialRequest: HTTPRequest = {
      url: "https://api.example.com/test",
      method: "GET",
      body: "{}",
      headers: [{key: "Content-Type", value: "application/json"}],
    };

    const form = NRequestForm({
      initialRequest,
      on: {
        send: () => Promise.resolve(),
        update: () => Promise.resolve(),
      },
    });

    container.append(form.el);

    // Check that the form container is created
    expect(form.el).toBeDefined();
    expect(form.el.tagName).toBe("DIV");

    // Check that form methods are available
    expect(typeof form.update).toBe("function");
    expect(typeof form.send).toBe("function");
    expect(typeof form.reset).toBe("function");
    expect(typeof form.unmount).toBe("function");

    // Check initial state
    expect(form.request).toEqual(initialRequest);
    expect(form.loading).toBe(false);
    expect(form.sending).toBe(false);

    form.unmount();
  });

  test("handles send operation", async () => {
    let sendCalled = false;
    let updateCalled = false;

    const initialRequest: HTTPRequest = {
      url: "https://api.example.com/test",
      method: "POST",
      body: "{\"test\": \"data\"}",
      headers: [],
    };

    const form = NRequestForm({
      initialRequest,
      on: {
        send: (request) => {
          sendCalled = true;
          // The request should have the updated URL
          expect(request.url).toBe("https://api.example.com/updated");
          return Promise.resolve();
        },
        update: (request) => {
          updateCalled = true;
          expect(request.url).toBe("https://api.example.com/updated");
          return Promise.resolve();
        },
      },
    });

    // Test update
    await form.update({url: "https://api.example.com/updated"});
    expect(updateCalled).toBe(true);

    // Test send - should send the updated request
    await form.send();
    expect(sendCalled).toBe(true);

    form.unmount();
  });

  test("handles reset", () => {
    const initialRequest: HTTPRequest = {
      url: "https://api.example.com/test",
      method: "GET",
      body: "{}",
      headers: [],
    };

    const form = NRequestForm({
      initialRequest,
      on: {
        send: () => Promise.resolve(),
        update: () => Promise.resolve(),
      },
    });

    // Update the request
    form.update({url: "https://api.example.com/updated"}).catch(() => {});

    // Reset should restore initial state
    form.reset();
    expect(form.request.url).toBe("https://api.example.com/test");

    form.unmount();
  });
});
