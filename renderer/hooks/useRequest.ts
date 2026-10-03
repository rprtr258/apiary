import {signal, Signal} from "../lib/utils.ts";

export type UseRequestOptions<T> = {
  initialRequest: T,
  on: {update?: (request: T) => Promise<void>},
};

export type UseRequestResult<T> = {
  // State
  requestSignal: Signal<T>,
  loadingSignal: Signal<boolean>,
  // Getters
  get request(): T,
  get loading(): boolean,
  get error(): Error | null,
  // Actions
  update: (patch: Partial<T>) => Promise<void>,
  reset: () => void,
};

/**
 * Thrown by the persistence layer when a persist failed and it already reverted its own state;
 * carries the state it reverted to. The hook rolls back to it instead of prevRequest, so both
 * layers agree even when an older in-flight persist's optimistic state sits between them
 * (prevRequest would then be a never-persisted patch).
 */
export class PersistRevertedError extends Error {
  readonly revertedRequest: unknown;

  constructor(message: string, revertedRequest: unknown) {
    super(message);
    this.name = "PersistRevertedError";
    this.revertedRequest = revertedRequest;
  }
}

/** Headless hook for HTTP request state management */
export function useRequest<T>({
  initialRequest,
  on: {update: onUpdate = async () => {}},
}: UseRequestOptions<T>): UseRequestResult<T> {
  const request = signal<T>(initialRequest);
  const loading = signal<boolean>(false);
  // Plain local: no production consumer subscribes to errors (the store notification displays them).
  let error: Error | null = null;
  let inFlight = 0;
  let seq = 0;

  const update = async (patch: Partial<T>): Promise<void> => {
    const token = ++seq;
    const prevRequest = request.value;
    inFlight++;
    loading.update(() => true);
    error = null;

    try {
      const newRequest = {...prevRequest, ...patch};
      request.update(() => newRequest);
      await onUpdate(newRequest);
    } catch (err) {
      // The persistence layer already reverted its own state; roll the hook back
      // too so the failed patch is not silently re-applied by the next edit.
      // When it reports the state it reverted to (last persisted), roll back to that
      // same state; otherwise fall back to prevRequest (pre-patch hook state).
      // A newer update having started since makes this one stale — keep its result.
      if (token === seq) {
        const reverted = err instanceof PersistRevertedError ? err.revertedRequest as T : prevRequest;
        request.update(() => reverted);
        error = err instanceof Error ? err : new Error(String(err));
      }
      throw err;
    } finally {
      inFlight--;
      loading.update(() => inFlight > 0);
    }
  };

  const reset = (): void => {
    seq++; // invalidate in-flight updates: their failure must not roll back past the reset
    request.update(() => initialRequest);
    loading.update(() => false);
    error = null;
  };

  return {
    get request() { return request.value; },
    get loading() { return loading.value; },
    get error() { return error; },
    update,
    // Deliberately exposed without a production subscriber — side-effect-free escape hatch for
    // seeding/loading state (see docs/dev/ARCHITECTURE.md).
    requestSignal: request,
    loadingSignal: loading,
    reset,
  };
}
