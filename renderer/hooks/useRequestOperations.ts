import {signal, Signal} from "../lib/utils.ts";

export type UseRequestOperationsOptions<Req> = {
  on: {
    send: (request: Req) => Promise<void>,
  },
};

export type UseRequestOperationsResult<Req> = {
  // State
  sendingSignal: Signal<boolean>,
  // Getters
  get sending(): boolean,
  // Actions
  send: (request: Req) => Promise<void>,
};

/** Headless hook tracking in-flight request sends. */
export function useRequestOperations<Req>({on: {send: onSend}}: UseRequestOperationsOptions<Req>): UseRequestOperationsResult<Req> {
  let sendInFlight = 0;
  const sending = signal(false);

  const send = async (request: Req): Promise<void> => {
    sendInFlight++;
    sending.update(() => sendInFlight > 0);
    try {
      await onSend(request);
    } finally {
      sendInFlight--;
      sending.update(() => sendInFlight > 0);
    }
  };

  return {
    sendingSignal: sending,
    get sending() { return sending.value; },
    send,
  };
}
