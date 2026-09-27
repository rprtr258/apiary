import * as t from "@/types.ts";
import {api} from "../api.ts";
import HTTPRequestView, {HTTPRequestViewResult} from "./HTTPRequestView.ts";
import type {JSONSchema7} from "json-schema";
import {m, signal} from "../lib/utils.ts";
import {NEmpty} from "./dataview.ts";
import {ComponentContainer} from "../layout/types.ts";

export type EndpointViewerProps = {
  sourceID: string,
  endpointInfo: t.EndpointInfo,
};

export default function EndpointViewer(
  container: ComponentContainer,
  {sourceID, endpointInfo}: EndpointViewerProps,
): HTTPRequestViewResult {
  const el: HTMLElement = container.element;

  const loadEndpointData = async (): Promise<{
    exampleRequest: t.HTTPRequest,
    schema?: JSONSchema7,
  }> => {
    const content = endpointInfo.requestBody?.content;
    const schema: JSONSchema7 | undefined =
      content !== undefined && "application/json" in content ?
      content["application/json"].schema :
      undefined;

    const exampleRes = await api.requestGenerateExampleRequestHTTPSource(sourceID, {method: endpointInfo.method, path: endpointInfo.path});
    if (exampleRes.kind === "err") {
      throw new Error(`Could not generate example request: ${exampleRes.value}`);
    }

    return {
      exampleRequest: exampleRes.value,
      schema,
    };
  };

  el.replaceChildren(NEmpty({description: "Loading endpoint..."}));

  let httpRequestView: HTTPRequestViewResult | null = null;

  loadEndpointData().then(({exampleRequest, schema}) => {
    httpRequestView = HTTPRequestView(el, {
      initialRequest: exampleRequest,
      showRequest: signal(true),
      schema,
      on: {send: async (request: t.HTTPRequest) => {
        const res = await api.requestPerformVirtualEndpointHTTPSource(sourceID, {method: endpointInfo.method, path: endpointInfo.path}, request);
        if (res.kind === "err")
          throw new Error(`Could not perform request: ${res.value}`);
        httpRequestView?.push_history_entry(res.value);
      }},
    });

    httpRequestView.loaded({
      request: exampleRequest,
      history: [], // virtual endpoints don't persist history
    });
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    el.replaceChildren(m("div", {class: "h100", style: {color: "red"}}, `Error: ${message}`));
  });

  return {
    loaded(r: {request: t.HTTPRequest, history: t.HistoryEntry[]}) {
      httpRequestView?.loaded(r);
    },
    push_history_entry(he: t.HistoryEntry) {
      httpRequestView?.push_history_entry(he);
    },
    unmount() {
      httpRequestView?.unmount();
    },
  };
}
