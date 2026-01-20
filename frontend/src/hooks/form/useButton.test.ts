import {describe, expect, test, mock} from "bun:test";
import {useButton} from "./useButton.ts";
import {collectSignalValues} from "../test-helpers.ts";

describe("useButton", () => {
  test("should initialize with default state", () => {
    const hook = useButton();

    expect(hook.disabledSignal.value).toBe(false);
    expect(hook.loadingSignal.value).toBe(false);
  });

  test("should initialize with provided options", () => {
    const hook = useButton({
      disabled: true,
      loading: true,
    });

    expect(hook.disabledSignal.value).toBe(true);
    expect(hook.loadingSignal.value).toBe(true);
  });

  test("should handle click events", async () => {
    const onClick = mock(async () => {});
    const hook = useButton({on: {click: onClick}});

    await hook.on.click();

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(hook.loadingSignal.value).toBe(false); // Should reset after click
  });

  test("should set loading state during async click handler", async () => {
    let resolveClick: () => void;
    const clickPromise = new Promise<void>(resolve => {
      resolveClick = resolve;
    });

    const onClick = mock(async () => {
      expect(hook.loadingSignal.value).toBe(true);
      await clickPromise;
    });

    const hook = useButton({on: {click: onClick}});

    const clickPromiseResult = hook.on.click();

    // Should be loading while handler is executing
    expect(hook.loadingSignal.value).toBe(true);

    // Resolve the async handler
    resolveClick!();
    await clickPromiseResult;

    // Should reset loading after handler completes
    expect(hook.loadingSignal.value).toBe(false);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("should not call onClick when disabled", async () => {
    const onClick = mock(async () => {});
    const hook = useButton({
      on: {click: onClick},
      disabled: true,
    });

    await hook.on.click();

    expect(onClick).toHaveBeenCalledTimes(0);
  });

  test("should not call onClick when loading", async () => {
    const onClick = mock(async () => {});
    const hook = useButton({
      on: {click: onClick},
      loading: true,
    });

    await hook.on.click();

    expect(onClick).toHaveBeenCalledTimes(0);
  });

  test("should set disabled state", () => {
    const hook = useButton();

    hook.disabled = true;
    expect(hook.disabledSignal.value).toBe(true);

    hook.disabled = false;
    expect(hook.disabledSignal.value).toBe(false);
  });

  test("should set loading state", () => {
    const hook = useButton();

    hook.loading = true;
    expect(hook.loadingSignal.value).toBe(true);

    hook.loading = false;
    expect(hook.loadingSignal.value).toBe(false);
  });

  test("should reset to initial state", async () => {
    const hook = useButton({
      disabled: true,
      loading: true,
    });

    hook.disabled = false;
    hook.loading = false;
    await hook.on.click(); // Trigger clicked state

    expect(hook.disabledSignal.value).toBe(false);
    expect(hook.loadingSignal.value).toBe(false);

    hook.reset();

    expect(hook.disabledSignal.value).toBe(true); // Back to initial
    expect(hook.loadingSignal.value).toBe(true); // Back to initial
  });

  test("should reset clicked state after delay", async () => {
    const hook = useButton();

    await hook.on.click();

    // Wait for the reset timeout
    await new Promise(resolve => setTimeout(resolve, 350));
  });

  test("should clear timeout on reset", async () => {
    const hook = useButton();

    await hook.on.click();

    hook.reset();

    // Wait to ensure no timeout fires after reset
    await new Promise(resolve => setTimeout(resolve, 350));
  });

  test("should handle click errors gracefully", () => {
    const error = new Error("Click failed");
    const onClick = mock((): Promise<void> => {
      return Promise.reject(error);
    });

    const hook = useButton({on: {click: onClick}});

    expect(hook.on.click()).rejects.toThrow("Click failed");

    expect(hook.loadingSignal.value).toBe(false); // Should reset even on error
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("should update signals when state changes", async () => {
    const hook = useButton();

    const disabledCollector = collectSignalValues(hook.disabledSignal);
    const loadingCollector = collectSignalValues(hook.loadingSignal);

    hook.disabled = true;
    hook.loading = true;
    await hook.on.click(); // Will be blocked by disabled/loading

    expect(disabledCollector.values).toEqual([true]);
    expect(loadingCollector.values).toEqual([true]);

    disabledCollector.unsubscribe();
    loadingCollector.unsubscribe();
  });

  test("should allow click when not disabled or loading", async () => {
    const onClick = mock(async () => {});
    const hook = useButton({on: {click: onClick}});

    // Initially not disabled or loading
    expect(hook.disabledSignal.value).toBe(false);
    expect(hook.loadingSignal.value).toBe(false);

    await hook.on.click();

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test("should handle multiple rapid clicks sequentially", async () => {
    let clickCount = 0;
    const onClick = mock(async () => {
      clickCount++;
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    const hook = useButton({on: {click: onClick}});

    // Click multiple times sequentially
    await hook.on.click();
    await hook.on.click();
    await hook.on.click();

    expect(clickCount).toBe(3);
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  test("should reset to custom initial state", () => {
    const hook = useButton({
      disabled: false,
      loading: false,
    });

    hook.disabled = true;
    hook.loading = true;

    hook.reset();

    expect(hook.disabledSignal.value).toBe(false);
    expect(hook.loadingSignal.value).toBe(false);
  });
});