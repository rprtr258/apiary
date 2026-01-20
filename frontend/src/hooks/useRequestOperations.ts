import {Signal, signal} from "../utils.ts";

export type UseRequestOperationsOptions<Req, Resp> = {
  on: {
    send: (request: Req) => Promise<Resp | undefined>,
    update?: (request: Req) => Promise<void>,
  },
  response?: {
    setLoading: (loading: boolean) => void,
  },
};

export type UseRequestOperationsResult<Req, Resp> = {
  // State
  sendingSignal: Signal<boolean>,
  updatingSignal: Signal<boolean>,
  sendErrorSignal: Signal<Error | null>,
  updateErrorSignal: Signal<Error | null>,
  // Getters
  get sending(): boolean,
  get updating(): boolean,
  get sendError(): Error | null,
  get updateError(): Error | null,
  // Actions
  send: (request: Req) => Promise<Resp | undefined>,
  update: (request: Req) => Promise<void>,
  reset: () => void,
};

/** Headless hook for request operations (send, update) */
export function useRequestOperations<Req, Resp>({
  on: {
    send: onSend,
    update: onUpdate = async () => {},
  },
  response,
}: UseRequestOperationsOptions<Req, Resp>): UseRequestOperationsResult<Req, Resp> {
  const sending = signal(false);
  const updating = signal(false);
  const sendInFlight = signal(0);
  const updateInFlight = signal(0);
  const sendError = signal<Error | null>(null);
  const updateError = signal<Error | null>(null);
  const resetToken = signal(0);

  const send = async (request: Req): Promise<Resp | undefined> => {
    const token = resetToken.value;
    sendInFlight.update(n => n + 1);
    sending.update(() => true);
    response?.setLoading(true);
    sendError.update(() => null);

    try {
      return await onSend(request);
    } catch (err) {
      if (resetToken.value === token) {
        sendError.update(() => err as Error);
      }
      throw err;
    } finally {
      if (resetToken.value === token) {
        sendInFlight.update(n => n - 1);
        sending.update(() => sendInFlight.value > 0);
        response?.setLoading(sendInFlight.value + updateInFlight.value > 0);
      }
    }
  };

  const update = async (request: Req): Promise<void> => {
    const token = resetToken.value;
    updateInFlight.update(n => n + 1);
    updating.update(() => true);
    response?.setLoading(true);
    updateError.update(() => null);

    try {
      await onUpdate(request);
    } catch (err) {
      if (resetToken.value === token) {
        updateError.update(() => err as Error);
      }
      throw err;
    } finally {
      if (resetToken.value !== token) return;
      updateInFlight.update(n => n - 1);
      updating.update(() => updateInFlight.value > 0);
      response?.setLoading(sendInFlight.value + updateInFlight.value > 0);
    }
  };

  const reset = (): void => {
    resetToken.update(n => n + 1);
    sendInFlight.update(() => 0);
    updateInFlight.update(() => 0);
    sending.update(() => false);
    updating.update(() => false);
    response?.setLoading(false);
    sendError.update(() => null);
    updateError.update(() => null);
  };

  return {
    sendingSignal: sending,
    updatingSignal: updating,
    sendErrorSignal: sendError,
    updateErrorSignal: updateError,
    get sending() { return sending.value; },
    get updating() { return updating.value; },
    get sendError() { return sendError.value; },
    get updateError() { return updateError.value; },
    send,
    update,
    reset,
  };
}
