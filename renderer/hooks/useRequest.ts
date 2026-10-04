import {signal, Signal} from "../lib/utils.ts";

type Options<T> = {
  initialRequest: T,
  on: {update: (request: T) => Promise<void>},
};

/**
 * Thrown by the persistence layer when a persist failed and it already reverted its own state;
 * carries the state it reverted to. The hook rolls back to it instead of its own pre-patch
 * state, so both layers agree even when an older in-flight persist's optimistic state sits
 * between them (that state was never persisted).
 */
export class PersistRevertedError extends Error {
  readonly revertedRequest: unknown;

  constructor(message: string, revertedRequest: unknown) {
    super(message);
    this.name = "PersistRevertedError";
    this.revertedRequest = revertedRequest;
  }
}

/**
 * Headless request state: `update(patch)` applies an optimistic merge, hands the merged
 * request to `on.update` (the persistence layer) and rolls back on failure — to the state
 * the persistence layer reverted to (`PersistRevertedError`) or to the pre-patch state.
 * A newer update having started since makes a failure stale: it keeps the newer state.
 */
export function useRequest<T>({initialRequest, on: {update: onUpdate}}: Options<T>): {
  update: (patch: Partial<T>) => Promise<void>,
  // Deliberately exposed without a production subscriber — side-effect-free escape hatch for
  // seeding the loaded request (see docs/dev/ARCHITECTURE.md).
  requestSignal: Signal<T>,
  loadingSignal: Signal<boolean>,
} {
  const requestSignal = signal<T>(initialRequest);
  const loadingSignal = signal(false);
  // Plain locals: loadingSignal is the only watched projection of inFlight.
  let inFlight = 0;
  let seq = 0;

  const update = async (patch: Partial<T>): Promise<void> => {
    const token = ++seq;
    const prev = requestSignal.value;
    inFlight++;
    loadingSignal.update(() => true);
    try {
      const request = {...prev, ...patch};
      requestSignal.update(() => request);
      await onUpdate(request);
    } catch (err) {
      // The persistence layer already reverted its own state; roll the hook back too, so the
      // failed patch is not silently re-applied by the next edit. A newer update having
      // started since makes this one stale — keep its result.
      if (token === seq) {
        const reverted = err instanceof PersistRevertedError ? err.revertedRequest as T : prev;
        requestSignal.update(() => reverted);
      }
      throw err;
    } finally {
      inFlight--;
      loadingSignal.update(() => inFlight > 0);
    }
  };

  return {
    update,
    requestSignal,
    loadingSignal,
  };
}
