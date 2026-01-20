import {database} from "../../wailsjs/go/models.ts";
import {api} from "../api.ts";
import {type HistoryEntry} from "../types.ts";
import HTTPRequestView, {HTTPRequestViewResult} from "./HTTPRequestView.ts";
import {m, signal} from "../utils.ts";
import {NEmpty} from "./dataview.ts";

export interface EndpointViewerProps {
  sourceID: string,
  endpointIndex: number,
}

export default function EndpointViewer(
  el: HTMLElement,
  {sourceID, endpointIndex}: EndpointViewerProps,
): HTTPRequestViewResult {
  const loadExampleRequest = async (): Promise<database.HTTPRequest> => {
    const res = await api.requestGenerateExampleRequestHTTPSource(sourceID, endpointIndex);
    if (res.kind === "err")
      throw new Error(`Could not generate example request: ${res.value}`);
    return res.value;
  };

  el.replaceChildren(NEmpty({description: "Loading endpoint..."}));

  let httpRequestView: HTTPRequestViewResult | null = null;

  loadExampleRequest().then((initialRequest) => {
    httpRequestView = HTTPRequestView(el, {
      initialRequest,
      showRequest: signal(true),
      on: {send: async (request: database.HTTPRequest) => {
        const res = await api.requestPerformVirtualEndpointHTTPSource(sourceID, endpointIndex, request);
        if (res.kind === "err")
          throw new Error(`Could not perform request: ${res.value}`);
        httpRequestView?.push_history_entry(res.value);
      }},
    });

    httpRequestView.loaded({
      request: initialRequest,
      history: [], // virtual endpoints don't persist history
    });
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    el.replaceChildren(m("div", {class: "h100", style: {color: "red"}}, `Error: ${message}`));
  });

  return {
    loaded(r: {request: database.HTTPRequest, history: HistoryEntry[]}) {
      httpRequestView?.loaded(r);
    },
    push_history_entry(he: HistoryEntry) {
      httpRequestView?.push_history_entry(he);
    },
    unmount() {
      httpRequestView?.unmount();
    },
  };
}