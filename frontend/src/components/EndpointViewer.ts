import {ComponentContainer} from "golden-layout";
import {database} from "../../wailsjs/go/models.ts";
import {api} from "../api.ts";
import {type HistoryEntry} from "../types.ts";
import HTTPRequestView, {HTTPRequestViewResult} from "./HTTPRequestView.ts";
import type {JSONSchema7} from "json-schema";
import {m, signal} from "../utils.ts";
import {NEmpty} from "./dataview.ts";

export interface EndpointViewerProps {
  sourceID: string,
  endpointIndex: number,
}

export default function EndpointViewer(
  container: ComponentContainer,
  {sourceID, endpointIndex}: EndpointViewerProps,
): HTTPRequestViewResult {
  const el: HTMLElement = container.element;

  const loadEndpointData = async (): Promise<{
    exampleRequest: database.HTTPRequest,
    schema?: JSONSchema7,
  }> => {
    // First, get the endpoint list to extract schema
    const endpointsRes = await api.requestListEndpointsHTTPSource(sourceID);
    if (endpointsRes.kind === "err") {
      throw new Error(`Could not fetch endpoints: ${endpointsRes.value}`);
    }

    const endpoints = endpointsRes.value;
    if (endpointIndex < 0 || endpointIndex >= endpoints.length) {
      throw new Error(`Invalid endpoint index: ${endpointIndex}`);
    }

    const content = endpoints[endpointIndex].requestBody?.content;
    const schema: JSONSchema7 | undefined =
      content !== undefined && "application/json" in content ?
      content["application/json"].schema as JSONSchema7 :
      undefined;

    const exampleRes = await api.requestGenerateExampleRequestHTTPSource(sourceID, endpointIndex);
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
      on: {send: async (request: database.HTTPRequest) => {
        const res = await api.requestPerformVirtualEndpointHTTPSource(sourceID, endpointIndex, request);
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