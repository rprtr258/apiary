import {describe, expect, test, mock} from "bun:test";
import {useRequestOperations} from "./useRequestOperations.ts";
import type {HTTPRequest} from "@/types.ts";
import {collectSignalValues} from "./test-helpers.ts";

describe("useRequestOperations", () => {
  const mockRequest: HTTPRequest = {
    method: "GET",
    url: "https://api.example.com/test",
    headers: [{key: "Content-Type", value: "application/json"}],
    body: "",
  };

  test("should initialize with default state", () => {
    const onSend = mock(() => Promise.resolve());

    const hook = useRequestOperations({on: {send: onSend}});

    expect(hook.sending).toBe(false);
  });

  test("send should call onSend callback", async () => {
    const onSend = mock(() => Promise.resolve());

    const hook = useRequestOperations({on: {send: onSend}});

    await hook.send(mockRequest);

    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith(mockRequest);
  });

  test("send should update sending state during operation", async () => {
    const onSend = mock(() => {
      expect(hook.sending).toBe(true);
      return Promise.resolve();
    });

    const hook = useRequestOperations({on: {send: onSend}});

    expect(hook.sending).toBe(false);
    const promise = hook.send(mockRequest);
    expect(hook.sending).toBe(true);

    await promise;
    expect(hook.sending).toBe(false);
  });

  test("send should handle concurrent requests correctly", async () => {
    let callCount = 0;
    const onSend = mock(async () => {
      callCount++;
      await new Promise(resolve => setTimeout(resolve, 50));
    });

    const hook = useRequestOperations({on: {send: onSend}});

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

  test("send should rethrow errors from onSend", async () => {
    const error = new Error("Network error");
    const onSend = mock((): Promise<void> => {
      return Promise.reject(error);
    });

    const hook = useRequestOperations({on: {send: onSend}});

    await hook.send(mockRequest).then(() => {
      throw new Error("expected rethrow");
    }, (e: unknown) => {
      expect(e).toBe(error);
    });
    expect(hook.sending).toBe(false);
  });

  test("sendingSignal should toggle during sends", async () => {
    const onSend = mock(() => Promise.resolve());

    const hook = useRequestOperations({on: {send: onSend}});

    const sendingCollector = collectSignalValues(hook.sendingSignal);

    await hook.send(mockRequest);

    expect(sendingCollector.values).toEqual([true, false]);

    sendingCollector.unsubscribe();
  });
});
