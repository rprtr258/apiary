import {Signal, signal} from "../utils.ts";

export type UseRequestOptions<T> = {
  initialRequest: T,
  on: {update?: (request: T) => Promise<void>},
};

export type UseRequestResult<T> = {
  // State
  requestSignal: Signal<T>,
  loadingSignal: Signal<boolean>,
  errorSignal: Signal<Error | null>,
  // Getters
  get request(): T,
  get loading(): boolean,
  get error(): Error | null,
  // Actions
  update: (patch: Partial<T>) => Promise<void>,
  reset: () => void,
};

/** Headless hook for HTTP request state management */
export function useRequest<T>({
  initialRequest,
  on: {update: onUpdate = async () => {}},
}: UseRequestOptions<T>): UseRequestResult<T> {
  const request = signal<T>(initialRequest);
  const loading = signal<boolean>(false);
  const error = signal<Error | null>(null);
  let inFlight = 0;

  const update = async (patch: Partial<T>): Promise<void> => {
    inFlight++;
    loading.update(() => true);
    error.update(() => null);

    try {
      const newRequest = {...request.value, ...patch};
      request.update(() => newRequest);
      await onUpdate(newRequest);
    } catch (err) {
      error.update(() => err as Error);
      throw err;
    } finally {
      inFlight--;
      loading.update(() => inFlight > 0);
    }
  };

  const reset = (): void => {
    request.update(() => initialRequest);
    loading.update(() => false);
    error.update(() => null);
  };

  return {
    get request() { return request.value; },
    get loading() { return loading.value; },
    get error() { return error.value; },
    update,
    requestSignal: request,
    loadingSignal: loading,
    errorSignal: error,
    reset,
  };
}
