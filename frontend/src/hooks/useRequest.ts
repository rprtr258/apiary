// Headless hook for HTTP request state management
import {Signal, signal} from "../utils.ts";

type KV = {
  key: string,
  value: string,
};

export type HTTPRequest = {
  url: string,
  method: string,
  body: string,
  headers: KV[],
};

export type HTTPResponse = {
  code: number,
  body: string,
  headers: KV[],
};

export type UseRequestOptions = {
  initialRequest: HTTPRequest,
  on: {update?: (request: HTTPRequest) => Promise<void>},
};

export type UseRequestResult = {
  // State
  requestSignal: Signal<HTTPRequest>,
  loadingSignal: Signal<boolean>,
  errorSignal: Signal<Error | null>,
  // Getters
  get request(): HTTPRequest,
  get loading(): boolean,
  get error(): Error | null,
  // Actions
  update: (patch: Partial<HTTPRequest>) => Promise<void>,
  reset: () => void,
};

export function useRequest({
  initialRequest,
  on: {update: onUpdate = async () => {}},
}: UseRequestOptions): UseRequestResult {
  const request = signal<HTTPRequest>(initialRequest);
  const loading = signal<boolean>(false);
  const error = signal<Error | null>(null);
  let inFlight = 0;

  const update = async (patch: Partial<HTTPRequest>): Promise<void> => {
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
