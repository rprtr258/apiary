import {type get_request} from "./store.ts";
import {type HistoryEntry} from "./api.ts";
import HTTPRequestView, {HTTPRequestViewResult} from "./components/HTTPRequestView.ts";
import {Signal} from "./utils.ts";
import {database} from "../wailsjs/go/models.ts";

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
  let currentRequestId: string | null = null;

  const onSend = async (): Promise<void> => {
    if (currentRequestId === null)
      throw new Error("No request ID available");

    await on.send();
  };

  const onUpdate = async (request: database.HTTPRequest): Promise<void> => {
    if (currentRequestId === null)
      throw new Error("No request ID available");
    await on.update(request);
  };

  return {
    loaded(r: get_request) {
      currentRequestId = r.request.id;

      const request = r.request as Request;
      httpRequestView = HTTPRequestView(el, {
        initialRequest: request,
        onSend,
        onUpdate,
        showRequest: show_request,
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