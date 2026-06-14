import {describe, test, expect, mock} from "bun:test";
import {sendHTTP} from "./http.ts";
import type {HTTPRequest, KV} from "@/types.ts";

// Mock global fetch
const mockFetch = mock((_0: string, _1: RequestInit) => new Promise(resolve => resolve(new Response("OK", {
  status: 200,
  statusText: "OK",
  headers: {"Content-Type": "text/plain", "X-Custom": "foobar"},
}))));
globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch;

function makeRequest(overrides?: Partial<HTTPRequest>): HTTPRequest {
  return {
    url: "https://example.com/api/users",
    method: "GET",
    body: "",
    headers: [],
    ...overrides,
  };
}

describe("sendHTTP", () => {
  test("sends a GET request and returns response", async () => {
    const result = await sendHTTP(makeRequest());

    expect(result.code).toBe(200);
    expect(result.body).toBe("OK");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/api/users",
      expect.objectContaining({method: "GET"}),
    );
  });

  test("sends custom headers", async () => {
    const headers: KV[] = [
      {key: "Authorization", value: "Bearer token123"},
      {key: "Accept", value: "application/json"},
    ];

    mockFetch.mockClear();
    await sendHTTP(makeRequest({headers}));

    const calls = mockFetch.mock.calls;
    expect(calls).toHaveLength(1);
    const [url, opts] = calls[0];
    expect(url).toBe("https://example.com/api/users");
    const hdrs = opts.headers as Headers;
    expect(hdrs.get("authorization")).toBe("Bearer token123");
    expect(hdrs.get("accept")).toBe("application/json");
  });

  test("sends body for POST requests", async () => {
    const body = JSON.stringify({name: "test"});

    await sendHTTP(makeRequest({
      method: "POST",
      body,
    }));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        body,
      }),
    );
  });

  test("does not send body for GET requests", async () => {
    await sendHTTP(makeRequest({method: "GET", body: "should-not-send"}));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "GET",
        body: undefined,
      }),
    );
  });

  test("does not send body for HEAD requests", async () => {
    await sendHTTP(makeRequest({method: "HEAD", body: "should-not-send"}));

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "HEAD",
        body: undefined,
      }),
    );
  });

  test("converts response headers to KV array", async () => {
    const result = await sendHTTP(makeRequest());

    const contentType = result.headers.find(h => h.key === "content-type");
    expect(contentType?.value).toBe("text/plain");
    const custom = result.headers.find(h => h.key === "x-custom");
    expect(custom?.value).toBe("foobar");
  });

  test("handles error status codes", async () => {
    mockFetch.mockImplementationOnce(async (_0: string, _1: RequestInit) => new Promise(resolve => resolve(new Response("Not Found", {
      status: 404,
      statusText: "Not Found",
    }))));

    const result = await sendHTTP(makeRequest());
    expect(result.code).toBe(404);
    expect(result.body).toBe("Not Found");
  });

  test("throws on network error", () => {
    mockFetch.mockImplementationOnce(async (_0: string, _1: RequestInit) => new Promise((_resolve, reject) => {
      reject(new Error("ECONNREFUSED"));
    }));

    expect(sendHTTP(makeRequest())).rejects.toThrow("ECONNREFUSED");
  });
});
