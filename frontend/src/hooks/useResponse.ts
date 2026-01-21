import {Signal, signal} from "../utils.ts";
import type {HTTPResponse} from "../types.ts";

export type UseResponseOptions = {
  initialResponse?: HTTPResponse,
};

export type UseResponseResult = {
  // State
  responseSignal: Signal<HTTPResponse | undefined>,
  loadingSignal: Signal<boolean>,
  errorSignal: Signal<Error | null>,
  // Getters
  get response(): HTTPResponse | undefined,
  get loading(): boolean,
  get error(): Error | null,
  // Actions
  update: (response: HTTPResponse | undefined) => void,
  clear: () => void,
  setLoading: (loading: boolean) => void,
};

/** Headless hook for HTTP response state management */
export function useResponse({
  initialResponse,
}: UseResponseOptions = {}): UseResponseResult {
  const response = signal<HTTPResponse | undefined>(initialResponse);
  const loading = signal<boolean>(false);
  const error = signal<Error | null>(null);

  const update = (newResponse: HTTPResponse | undefined): void => {
    response.update(() => newResponse);
    error.update(() => null);
    loading.update(() => false);
  };

  const clear = (): void => {
    response.update(() => undefined);
    error.update(() => null);
    loading.update(() => false);
  };

  const setLoading = (newLoading: boolean): void => {
    loading.update(() => newLoading);
  };

  return {
    responseSignal: response,
    loadingSignal: loading,
    errorSignal: error,
    get response() { return response.value; },
    get loading() { return loading.value; },
    get error() { return error.value; },
    update,
    clear,
    setLoading,
  };
}
