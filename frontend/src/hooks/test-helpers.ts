import type {Signal} from "../utils.ts";

/**
 * Helper function to subscribe to a signal and collect values
 * Returns an object with:
 * - values: array of collected values
 * - unsubscribe: function to stop collecting
 */
export function collectSignalValues<T>(signal: Signal<T>): {values: T[], unsubscribe: () => void} {
  const values: T[] = [];
  const unsubscribe = signal.sub(function*() {
    yield; // Initial yield
    while (true) {
      values.push(yield);
    }
  }());
  return {values, unsubscribe};
}
