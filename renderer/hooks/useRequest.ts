import {signal, Signal} from "../lib/utils.ts";
import {PersistRevertedError} from "../store.ts";

type Options<T> = {
  initialRequest: T,
  on: {update: (request: T) => Promise<void>},
};

/**
 * Headless request state: `update(patch)` applies an optimistic merge, hands the merged
 * request to `on.update` (the persistence layer) and rolls back on failure — to the state
 * the persistence layer reverted to (`PersistRevertedError`) or to the pre-patch state.
 * A newer update having started since makes a failure stale: it keeps the newer state.
 */
export function useRequest<T>({initialRequest, on}: Options<T>): {
  update: (patch: Partial<T>) => Promise<void>,
  requestSignal: Signal<T>,
  loadingSignal: Signal<boolean>,
} {
  const requestSignal = signal<T>(initialRequest);
  const loadingSignal = signal(false);
  // Plain locals: loadingSignal is the only watched projection of inFlight.
  let inFlight = 0;
  let seq = 0;

  async function update(patch: Partial<T>): Promise<void> {
    seq++;
    const token = seq;
    const prev = requestSignal.value;
    inFlight++;
    loadingSignal.value = true;
    try {
      const request = {...prev, ...patch};
      requestSignal.value = request;
      await on.update(request);
    } catch (err) {
      // The persistence layer already reverted its own state;
      // roll the hook back too, so the failed patch is not silently re-applied by the next edit.
      // A newer update having started since makes this one stale — keep its result.
      if (token === seq) {
        const reverted = err instanceof PersistRevertedError ? err.revertedRequest as T : prev;
        requestSignal.value = reverted;
      }
      throw err;
    } finally {
      inFlight--;
      loadingSignal.value = inFlight > 0;
    }
  }

  return {
    update,
    requestSignal,
    loadingSignal,
  };
}
