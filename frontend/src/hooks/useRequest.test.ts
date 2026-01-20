import {describe, test, expect, mock} from "bun:test";
import {useRequest} from "./useRequest.ts";

describe("useRequest", () => {
  const initialRequest = {
    url: "https://api.example.com",
    method: "GET",
    body: "",
    headers: [{key: "Content-Type", value: "application/json"}],
  };

  test("initializes with provided request", () => {
    const request = useRequest({
      initialRequest,
      on: {},
    });

    expect(request.request).toEqual(initialRequest);
    expect(request.loading).toBe(false);
    expect(request.error).toBe(null);
  });

  test("updates request with update method", async () => {
    const updateMock = mock((_req) => Promise.resolve());
    const request = useRequest({
      initialRequest,
      on: {update: updateMock},
    });

    const patch = {method: "POST", body: "{\"test\": \"data\"}"};
    await request.update(patch);

    expect(request.request).toEqual({
      ...initialRequest,
      ...patch,
    });
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({
      ...initialRequest,
      ...patch,
    });
  });

  test("sets loading state during update", async () => {
    let resolveUpdate: () => void;
    const updatePromise = new Promise<void>((resolve) => {
      resolveUpdate = resolve;
    });

    const updateMock = mock(async () => {
      await updatePromise;
    });

    const request = useRequest({
      initialRequest,
      on: {update: updateMock},
    });

    // Start update
    const updatePromiseCall = request.update({method: "PUT"});

    // Should be loading
    expect(request.loading).toBe(true);

    // Complete the update
    resolveUpdate!();
    await updatePromiseCall;

    // Should not be loading anymore
    expect(request.loading).toBe(false);
  });

  test("handles update errors", async () => {
    const error = new Error("Update failed");
    const updateMock = mock((): Promise<void> => {
      return Promise.reject(error);
    });

    const request = useRequest({
      initialRequest,
      on: {update: updateMock},
    });

    try {
      await request.update({method: "DELETE"});
    } catch (err) {
      expect(err).toBe(error);
    }

    expect(request.error).toBe(error);
    expect(request.loading).toBe(false);
  });

  test("clears error on successful update after previous error", async () => {
    let shouldThrow = true;
    const updateMock = mock((): Promise<void> => {
      if (shouldThrow) {
        return Promise.reject(new Error("First attempt failed"));
      }
      return Promise.resolve();
    });

    const request = useRequest({
      initialRequest,
      on: {update: updateMock},
    });

    // First update fails
    try {
      await request.update({method: "PATCH"});
    } catch {
      // Expected
    }

    expect(request.error).toBeInstanceOf(Error);

    // Second update succeeds
    shouldThrow = false;
    await request.update({method: "GET"});

    expect(request.error).toBe(null);
  });

  test("resets to initial state", async () => {
    const updateMock = mock((_req) => Promise.resolve());
    const request = useRequest({
      initialRequest,
      on: {update: updateMock},
    });

    // Make some changes
    await request.update({method: "POST", body: "test"});
    expect(request.request.method).toBe("POST");
    expect(request.request.body).toBe("test");

    // Reset
    request.reset();

    expect(request.request).toEqual(initialRequest);
    expect(request.loading).toBe(false);
    expect(request.error).toBe(null);
  });

  test("resets clears error and loading state", async () => {
    const updateMock = mock((): Promise<void> => {
      return Promise.reject(new Error("Test error"));
    });

    const request = useRequest({
      initialRequest,
      on: {update: updateMock},
    });

    // Cause an error
    try {
      await request.update({method: "POST"});
    } catch {
      // Expected
    }

    expect(request.error).toBeInstanceOf(Error);

    // Reset
    request.reset();

    expect(request.error).toBe(null);
    expect(request.loading).toBe(false);
    expect(request.request).toEqual(initialRequest);
  });

  test("provides signal accessors", () => {
    const request = useRequest({
      initialRequest,
      on: {},
    });

    expect(request.requestSignal.value).toEqual(initialRequest);
    expect(request.loadingSignal.value).toBe(false);
    expect(request.errorSignal.value).toBe(null);
  });

  test("signals update when request changes", async () => {
    const updateMock = mock((_req) => Promise.resolve());
    const request = useRequest({
      initialRequest,
      on: {update: updateMock},
    });

    let requestSignalValue = request.requestSignal.value;
    let loadingSignalValue = request.loadingSignal.value;
    let errorSignalValue = request.errorSignal.value;

    request.requestSignal.sub(function*() {
      yield;
      while (true) {
        requestSignalValue = yield;
      }
    }());

    request.loadingSignal.sub(function*() {
      yield;
      while (true) {
        loadingSignalValue = yield;
      }
    }());

    request.errorSignal.sub(function*() {
      yield;
      while (true) {
        errorSignalValue = yield;
      }
    }());

    await request.update({method: "PUT"});

    expect(requestSignalValue.method).toBe("PUT");
    expect(loadingSignalValue).toBe(false); // Should be false after update completes
    expect(errorSignalValue).toBe(null);
  });

  test("handles partial updates correctly", async () => {
    const updateMock = mock((_req) => Promise.resolve());
    const request = useRequest({
      initialRequest,
      on: {update: updateMock},
    });

    // Update only method
    await request.update({method: "POST"});
    expect(request.request).toEqual({
      ...initialRequest,
      method: "POST",
    });

    // Update only body
    await request.update({body: "{\"test\": true}"});
    expect(request.request).toEqual({
      ...initialRequest,
      method: "POST", // Should preserve previous update
      body: "{\"test\": true}",
    });

    // Update only headers
    const newHeaders = [{key: "Authorization", value: "Bearer token"}];
    await request.update({headers: newHeaders});
    expect(request.request).toEqual({
      ...initialRequest,
      method: "POST",
      body: "{\"test\": true}",
      headers: newHeaders,
    });
  });

  test("update callback is optional", async () => {
    const request = useRequest({
      initialRequest,
      on: {},
    });

    // Should not throw when no update callback provided
    await request.update({method: "POST"});
    expect(request.request.method).toBe("POST");
  });
});