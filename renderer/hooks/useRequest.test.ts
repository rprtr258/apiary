import {describe, test, expect, mock} from "bun:test";
import {useRequest, PersistRevertedError} from "./useRequest.ts";

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
      on: {update: async () => {}},
    });

    expect(request.requestSignal.value).toEqual(initialRequest);
    expect(request.loadingSignal.value).toBe(false);
  });

  test("updates request with update method", async () => {
    const updateMock = mock((_req) => Promise.resolve());
    const request = useRequest({
      initialRequest,
      on: {update: updateMock},
    });

    const patch = {method: "POST", body: "{\"test\": \"data\"}"};
    await request.update(patch);

    expect(request.requestSignal.value).toEqual({
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
    expect(request.loadingSignal.value).toBe(true);

    // Complete the update
    resolveUpdate!();
    await updatePromiseCall;

    // Should not be loading anymore
    expect(request.loadingSignal.value).toBe(false);
  });

  test("stays loading while updates are in flight", async () => {
    let resolveUpdate: () => void;
    const updatePromise = new Promise<void>((resolve) => {
      resolveUpdate = resolve;
    });
    const request = useRequest({
      initialRequest,
      on: {update: () => updatePromise},
    });

    const first = request.update({method: "POST"});
    const second = request.update({method: "PUT"});

    expect(request.loadingSignal.value).toBe(true);
    resolveUpdate!();
    await Promise.all([first, second]);
    expect(request.loadingSignal.value).toBe(false);
  });

  test("provides signal accessors", () => {
    const request = useRequest({
      initialRequest,
      on: {update: async () => {}},
    });

    expect(request.requestSignal.value).toEqual(initialRequest);
    expect(request.loadingSignal.value).toBe(false);
  });

  test("signals update when request changes", async () => {
    const updateMock = mock((_req) => Promise.resolve());
    const request = useRequest({
      initialRequest,
      on: {update: updateMock},
    });

    let requestSignalValue = request.requestSignal.value;
    let loadingSignalValue = request.loadingSignal.value;

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

    await request.update({method: "PUT"});

    expect(requestSignalValue.method).toBe("PUT");
    expect(loadingSignalValue).toBe(false); // Should be false after update completes
  });

  test("handles partial updates correctly", async () => {
    const updateMock = mock((_req) => Promise.resolve());
    const request = useRequest({
      initialRequest,
      on: {update: updateMock},
    });

    // Update only method
    await request.update({method: "POST"});
    expect(request.requestSignal.value).toEqual({
      ...initialRequest,
      method: "POST",
    });

    // Update only body
    await request.update({body: "{\"test\": true}"});
    expect(request.requestSignal.value).toEqual({
      ...initialRequest,
      method: "POST", // Should preserve previous update
      body: "{\"test\": true}",
    });

    // Update only headers
    const newHeaders = [{key: "Authorization", value: "Bearer token"}];
    await request.update({headers: newHeaders});
    expect(request.requestSignal.value).toEqual({
      ...initialRequest,
      method: "POST",
      body: "{\"test\": true}",
      headers: newHeaders,
    });
  });

  test("update rolls back request state when the update callback rejects", async () => {
    const request = useRequest({
      initialRequest,
      on: {update: () => Promise.reject(new Error("persist failed"))},
    });

    await request.update({method: "POST"}).catch(() => {});

    expect(request.requestSignal.value.method).toBe(initialRequest.method);
  });

  test("a failed earlier update does not roll back a newer successful one", async () => {
    let ok = false;
    const request = useRequest({
      initialRequest,
      on: {update: () => ok ? Promise.resolve() : Promise.reject(new Error("persist failed"))},
    });

    const first = request.update({method: "POST"}); // fails, but a newer update supersedes it
    ok = true;
    await request.update({method: "PUT"});
    await first.catch(() => {});

    // The stale failure must not revert the newer result.
    expect(request.requestSignal.value.method).toBe("PUT");
  });

  test("rolls back to the state reported by PersistRevertedError, not prevRequest", async () => {
    // Simulates the store: an older in-flight persist (POST) is still optimistic while the
    // newest persist (PUT) fails and the store reverts to its last persisted state (GET).
    const lastPersisted = {...initialRequest};
    let failOlder!: (err: unknown) => void;
    const request = useRequest({
      initialRequest,
      on: {update: req => {
        if (req.method === "POST") {
          return new Promise((_resolve, reject) => {
            failOlder = reject;
          });
        }
        return Promise.reject(new PersistRevertedError("persist failed", lastPersisted));
      }},
    });

    const first = request.update({method: "POST"}); // older optimistic persist, still in flight
    await request.update({method: "PUT"}).catch(() => {}); // newest persist fails
    failOlder(new Error("persist failed"));
    await first.catch(() => {});

    // prevRequest for the failing update is the older persist's never-persisted optimistic
    // state (POST); the hook must land on the store's reverted state instead.
    expect(request.requestSignal.value).toEqual(lastPersisted);
  });
});
