import {describe, expect, test, mock} from "bun:test";
import {useRequestOperations} from "./useRequestOperations.ts";
import type {HTTPRequest, HTTPResponse} from "./useRequest.ts";
import {collectSignalValues} from "./test-helpers.ts";

describe("useRequestOperations", () => {
  const mockRequest: HTTPRequest = {
    method: "GET",
    url: "https://api.example.com/test",
    headers: [{key: "Content-Type", value: "application/json"}],
    body: "",
  };

  const mockResponse: HTTPResponse = {
    code: 200,
    body: JSON.stringify({message: "Success"}),
    headers: [{key: "Content-Type", value: "application/json"}],
  };

  function createMockResponseHook() {
    return {
      setLoading: mock(() => {}),
    };
  }

  test("should initialize with default state", () => {
    const onSend = mock(() => Promise.resolve(mockResponse));
    const onUpdate = mock(() => Promise.resolve());

    const hook = useRequestOperations({
      on: {send: onSend, update: onUpdate},
      response: createMockResponseHook(),
    });

    expect(hook.sending).toBe(false);
    expect(hook.updating).toBe(false);
    expect(hook.sendError).toBe(null);
    expect(hook.updateError).toBe(null);
  });

  test("should initialize with only send callback when update not provided", () => {
    const onSend = mock(() => Promise.resolve(mockResponse));

    const hook = useRequestOperations({
      on: {send: onSend},
      response: createMockResponseHook(),
    });

    expect(hook.sending).toBe(false);
    expect(hook.updating).toBe(false);
    expect(hook.sendError).toBe(null);
    expect(hook.updateError).toBe(null);
  });

  test("send should call onSend callback and return response", async () => {
    const onSend = mock(() => Promise.resolve(mockResponse));
    const onUpdate = mock(() => Promise.resolve());

    const hook = useRequestOperations({
      on: {send: onSend, update: onUpdate},
    });

    const response = await hook.send(mockRequest);

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith(mockRequest);
    expect(response).toEqual(mockResponse);
  });

  test("send should update sending state during operation", async () => {
    const onSend = mock(() => {
      expect(hook.sending).toBe(true);
      return Promise.resolve(mockResponse);
    });
    const onUpdate = mock(async () => {});
    const mockResponseHook = createMockResponseHook();

    const hook = useRequestOperations({response: mockResponseHook,
      on: {send: onSend, update: onUpdate},
    });

    expect(hook.sending).toBe(false);
    const promise = hook.send(mockRequest);
    expect(hook.sending).toBe(true);
    expect(mockResponseHook.setLoading).toHaveBeenCalledWith(true);

    await promise;
    expect(hook.sending).toBe(false);
    expect(mockResponseHook.setLoading).toHaveBeenCalledWith(false);
  });

  test("send should handle concurrent requests correctly", async () => {
    let callCount = 0;
    const onSend = mock(async () => {
      callCount++;
      await new Promise(resolve => setTimeout(resolve, 50));
      return mockResponse;
    });
    const onUpdate = mock(async () => {});

    const hook = useRequestOperations({
      on: {send: onSend, update: onUpdate},
    });

    // Start multiple concurrent sends
    const promise1 = hook.send(mockRequest);
    const promise2 = hook.send(mockRequest);
    const promise3 = hook.send(mockRequest);

    expect(hook.sending).toBe(true);

    await Promise.all([promise1, promise2, promise3]);

    expect(hook.sending).toBe(false);
    expect(onSend).toHaveBeenCalledTimes(3);
    expect(callCount).toBe(3);
  });

  test("send should set error when onSend throws", () => {
    const error = new Error("Network error");
    const onSend = mock((): Promise<HTTPResponse | undefined> => {
      return Promise.reject(error);
    });
    const onUpdate = mock(() => Promise.resolve());

    const hook = useRequestOperations({
      on: {send: onSend, update: onUpdate},
    });

    expect(hook.send(mockRequest)).rejects.toThrow("Network error");
    expect(hook.sendError).toBe(error);
    expect(hook.sending).toBe(false);
  });

  test("send should normalize non-Error exceptions", () => {
    const onSend = mock((): Promise<HTTPResponse> => {
      return Promise.reject(new Error("String error"));
    });
    const onUpdate = mock(() => Promise.resolve());

    const hook = useRequestOperations({
      on: {send: onSend, update: onUpdate},
    });

    expect(hook.send(mockRequest)).rejects.toThrow("String error");
    expect(hook.sendError?.message).toBe("String error");
    expect(hook.sendError).toBeInstanceOf(Error);
  });

  test("update should call onUpdate callback", async () => {
    const onSend = mock(() => Promise.resolve(mockResponse));
    const onUpdate = mock(() => Promise.resolve());

    const hook = useRequestOperations({
      on: {send: onSend, update: onUpdate},
    });

    await hook.update(mockRequest);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(mockRequest);
  });

  test("update should update updating state during operation", async () => {
    const onSend = mock(() => Promise.resolve(mockResponse));
    const onUpdate = mock(() => {
      expect(hook.updating).toBe(true);
      return Promise.resolve();
    });
    const mockResponseHook = createMockResponseHook();

    const hook = useRequestOperations({response: mockResponseHook,
      on: {send: onSend, update: onUpdate},
    });

    expect(hook.updating).toBe(false);
    const promise = hook.update(mockRequest);
    expect(hook.updating).toBe(true);
    expect(mockResponseHook.setLoading).toHaveBeenCalledWith(true);

    await promise;
    expect(hook.updating).toBe(false);
    expect(mockResponseHook.setLoading).toHaveBeenCalledWith(false);
  });

  test("update should handle concurrent updates correctly", async () => {
    let callCount = 0;
    const onSend = mock(() => Promise.resolve(mockResponse));
    const onUpdate = mock(async () => {
      callCount++;
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    const hook = useRequestOperations({
      on: {send: onSend, update: onUpdate},
    });

    // Start multiple concurrent updates
    const promise1 = hook.update(mockRequest);
    const promise2 = hook.update(mockRequest);
    const promise3 = hook.update(mockRequest);

    expect(hook.updating).toBe(true);

    await Promise.all([promise1, promise2, promise3]);

    expect(hook.updating).toBe(false);
    expect(onUpdate).toHaveBeenCalledTimes(3);
    expect(callCount).toBe(3);
  });

  test("update should set error when onUpdate throws", () => {
    const error = new Error("Update failed");
    const onSend = mock(() => Promise.resolve(mockResponse));
    const onUpdate = mock((): Promise<void> => {
      return Promise.reject(error);
    });

    const hook = useRequestOperations({
      on: {send: onSend, update: onUpdate},
    });

    expect(hook.update(mockRequest)).rejects.toThrow("Update failed");
    expect(hook.updateError).toBe(error);
    expect(hook.updating).toBe(false);
  });

  test("reset should clear all state", async () => {
    const error = new Error("Test error");
    const onSend = mock((): Promise<HTTPResponse | undefined> => {
      return Promise.reject(error);
    });
    const onUpdate = mock((): Promise<void> => {
      return Promise.reject(error);
    });

    const hook = useRequestOperations({
      on: {send: onSend, update: onUpdate},
    });

    // Trigger errors to set state
    await hook.send(mockRequest).catch(() => {});
    await hook.update(mockRequest).catch(() => {});

    expect(hook.sendError).toBe(error);
    expect(hook.updateError).toBe(error);

    hook.reset();

    expect(hook.sending).toBe(false);
    expect(hook.updating).toBe(false);
    expect(hook.sendError).toBe(null);
    expect(hook.updateError).toBe(null);
  });

  test("signals should update when state changes", async () => {
    const onSend = mock(() => Promise.resolve(mockResponse));
    const onUpdate = mock(() => Promise.resolve());

    const hook = useRequestOperations({
      on: {send: onSend, update: onUpdate},
    });

    const sendingCollector = collectSignalValues(hook.sendingSignal);
    const updatingCollector = collectSignalValues(hook.updatingSignal);
    const sendErrorCollector = collectSignalValues(hook.sendErrorSignal);
    const updateErrorCollector = collectSignalValues(hook.updateErrorSignal);

    await hook.send(mockRequest);
    await hook.update(mockRequest);

    expect(sendingCollector.values).toEqual([true, false]);
    expect(updatingCollector.values).toEqual([true, false]);
    expect(sendErrorCollector.values).toEqual([]);
    expect(updateErrorCollector.values).toEqual([]);

    sendingCollector.unsubscribe();
    updatingCollector.unsubscribe();
    sendErrorCollector.unsubscribe();
    updateErrorCollector.unsubscribe();
  });

  test("signals should update when errors occur", async () => {
    const error = new Error("Test error");
    const onSend = mock((): Promise<HTTPResponse | undefined> => {
      return Promise.reject(error);
    });
    const onUpdate = mock((): Promise<void> => {
      return Promise.reject(error);
    });

    const hook = useRequestOperations({
      on: {send: onSend, update: onUpdate},
    });

    const sendErrorCollector = collectSignalValues(hook.sendErrorSignal);
    const updateErrorCollector = collectSignalValues(hook.updateErrorSignal);

    await hook.send(mockRequest).catch(() => {});
    await hook.update(mockRequest).catch(() => {});

    expect(sendErrorCollector.values).toEqual([error]);
    expect(updateErrorCollector.values).toEqual([error]);

    sendErrorCollector.unsubscribe();
    updateErrorCollector.unsubscribe();
  });

  test("should handle mixed send and update operations concurrently", async () => {
    let sendCount = 0;
    let updateCount = 0;

    const onSend = mock(async () => {
      sendCount++;
      await new Promise(resolve => setTimeout(resolve, 30));
      return mockResponse;
    });

    const onUpdate = mock(async () => {
      updateCount++;
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    const hook = useRequestOperations({
      on: {send: onSend, update: onUpdate},
    });

    // Start mixed operations
    const sendPromise1 = hook.send(mockRequest);
    const updatePromise1 = hook.update(mockRequest);
    const sendPromise2 = hook.send(mockRequest);
    const updatePromise2 = hook.update(mockRequest);

    expect(hook.sending).toBe(true);
    expect(hook.updating).toBe(true);

    await Promise.all([sendPromise1, updatePromise1, sendPromise2, updatePromise2]);

    expect(hook.sending).toBe(false);
    expect(hook.updating).toBe(false);
    expect(sendCount).toBe(2);
    expect(updateCount).toBe(2);
  });
});