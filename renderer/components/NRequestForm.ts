import {m} from "../lib/utils.ts";
import {NInputGroup, NInput, NSelect, NButton} from "./input.ts";
import {NTabs} from "./layout.ts";
import EditorJSON from "./EditorJSON.ts";
import ParamsList from "./ParamsList.ts";
import {useRequest} from "../hooks/useRequest.ts";
import {Method as Methods, HTTPRequest} from "@/types.ts";
import type {KV} from "@/types.ts";
import type {JSONSchema7} from "json-schema";

export type NRequestFormProps = {
  initialRequest: HTTPRequest,
  schema?: JSONSchema7,
  on: {
    send: (request: HTTPRequest) => Promise<void>,
    update: (request: HTTPRequest) => Promise<void>,
  },
  style?: Partial<CSSStyleDeclaration>,
  class?: string,
};

/**
 * Reusable HTTP request form: method selector, URL input, send button and the
 * Body/Headers tabs. Request state lives in `useRequest` (transactional updates,
 * rollback on failed persist); the send button keeps itself loading for the whole
 * awaited click, and stays disabled while a persist is in flight.
 */
export default function NRequestForm(props: NRequestFormProps): {
  el: HTMLElement,
  unmount: () => void,
} {
  const requestHook = useRequest<HTTPRequest>({
    initialRequest: props.initialRequest,
    on: {update: props.on.update},
  });

  const sendButton = NButton({
    primary: true,
    on: {click: () => props.on.send(requestHook.requestSignal.value).catch(() => {
      // Surface the failure to the caller: HTTPRequestView owns send-failure notification
      // (also covers sends not originating from this button).
    })},
  }, "Send");

  const methodSelector = NSelect({
    options: Object.keys(Methods).map(method => ({label: method, value: method})),
    placeholder: requestHook.requestSignal.value.method,
    on: {update: (method: string) => {
      requestHook.update({method}).catch(() => {
        // Re-sync the DOM to the rolled-back state (reset() would show the placeholder instead).
        methodSelector.set(requestHook.requestSignal.value.method);
      });
    }},
  });

  const urlInput = NInput({
    placeholder: "URL",
    value: requestHook.requestSignal.value.url,
    on: {update: (url: string) => {
      requestHook.update({url}).catch(() => {
        // Persist failed and the hook rolled back; keep the DOM in sync with hook state.
        urlInput.value = requestHook.requestSignal.value.url;
      });
    }},
  });

  const bodyEditor = EditorJSON({
    class: "h100",
    value: requestHook.requestSignal.value.body,
    schema: props.schema,
    on: {update: (body: string) => {
      requestHook.update({body}).catch(() => {}); // NOTE: body editor not re-synced on failed persist (EditorJSON exposes no update API)
    }},
  });

  const headersList = ParamsList({
    value: requestHook.requestSignal.value.headers,
    on: {update: (headers: KV[]) => {
      requestHook.update({headers}).catch(() => {}); // NOTE: headers not re-synced on failed persist (ParamsList exposes no update API)
    }},
  });

  const requestTabs = NTabs({
    class: "h100",
    tabs: [
      {
        name: "Body",
        class: "h100",
        elem: bodyEditor,
      },
      {
        name: "Headers",
        style: {
          display: "flex",
          flexDirection: "column",
          flexGrow: "1",
        },
        elem: headersList,
      },
    ],
  });

  const inputGroup = NInputGroup({style: {
    display: "grid",
    gridTemplateColumns: "1fr 10fr 1fr",
    gap: "8px",
    marginBottom: "8px",
  }},
    methodSelector.el,
    urlInput,
    sendButton.el,
  );

  const el = m("div", {
    class: props.class,
    style: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      ...props.style,
    },
  }, inputGroup, requestTabs);

  const unsubscribe = requestHook.loadingSignal.sub(function*() {
    while (true) {
      yield;
      sendButton.disabled = requestHook.loadingSignal.value;
    }
  }());

  return {
    el,
    unmount: unsubscribe,
  };
}
