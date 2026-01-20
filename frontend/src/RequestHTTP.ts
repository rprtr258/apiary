import {database} from "../wailsjs/go/models.ts";
import {type HistoryEntry} from "./types.ts";
import {type get_request} from "./store.ts";
import {Signal} from "./utils.ts";
import HTTPRequestView, {HTTPRequestViewResult} from "./components/HTTPRequestView.ts";

type Request = database.HTTPRequest;

export default function(
  el: HTMLElement,
  show_request: Signal<boolean>,
  on: {
    update: (patch: Partial<Request>) => Promise<void>,
    send: () => Promise<void>,
  },
): {
  loaded(r: get_request): void,
  push_history_entry(he: HistoryEntry): void,
  unmount(): void,
} {
  let httpRequestView: HTTPRequestViewResult | null = null;
  let currentRequestID: string | null = null;

  const onSend = async (): Promise<void> => {
    if (currentRequestID === null)
      throw new Error("No request ID available");

    await on.send();
  };

  const onUpdate = async (request: database.HTTPRequest): Promise<void> => {
    if (currentRequestID === null)
      throw new Error("No request ID available");
    await on.update(request);
  };

  return {
    loaded(r: get_request) {
      currentRequestID = r.request.id;

      const request = r.request as Request;
      httpRequestView = HTTPRequestView(el, {
        initialRequest: request,
        showRequest: show_request,
        on: {send: onSend, update: onUpdate},
      });

      httpRequestView.loaded({
        request,
        history: r.history,
      });
    },
    push_history_entry(he: HistoryEntry) {
      httpRequestView?.push_history_entry(he);
    },
    unmount() {
      httpRequestView?.unmount();
    },
  };
}
