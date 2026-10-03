import {m} from "../lib/utils.ts";
import {NInputGroup, NInput, NSelect, NButton} from "./input.ts";
import {NTabs} from "./layout.ts";
import EditorJSON from "./EditorJSON.ts";
import ParamsList from "./ParamsList.ts";
import {useRequest} from "../hooks/useRequest.ts";
import {useRequestOperations} from "../hooks/useRequestOperations.ts";
import {Method as Methods, HTTPRequest} from "@/types.ts";
import type {JSONSchema7} from "json-schema";

export type NRequestFormProps = {
  initialRequest: HTTPRequest,
  schema?: JSONSchema7,
  on: {
    send: (request: HTTPRequest) => Promise<void>,
    update?: (request: HTTPRequest) => Promise<void>,
  },
  style?: Partial<CSSStyleDeclaration>,
  class?: string,
};

export type NRequestFormResult = {
  el: HTMLElement,
  unmount: () => void,
};

/**
 * NRequestForm - Reusable HTTP request form component using headless hooks
 *
 * This component encapsulates the HTTP request form UI including:
 * - HTTP method selector
 * - URL input field
 * - Send button with loading state
 * - Request body editor (JSON)
 * - Headers management
 */
export default function NRequestForm(props: NRequestFormProps): NRequestFormResult {
  const requestHook = useRequest({
    initialRequest: props.initialRequest,
    on: {update: async (request: HTTPRequest) => {
      if (props.on.update !== undefined) {
        await props.on.update(request);
      }
    }},
  });

  const operationsHook = useRequestOperations({on: {
    send: async (request: HTTPRequest) => {
      await props.on.send(request);
      // Note: The response will be handled externally via push_history_entry or similar
    },
  }});

  const sendButton = NButton({
    primary: true,
    on: {click: () => {
      operationsHook.send(requestHook.request).catch(() => {
        // Surface the failure to the caller: HTTPRequestView owns send-failure notification
        // (also covers sends not originating from this button).
      });
    }},
  }, "Send");

  const methodSelector = NSelect({
    options: Object.keys(Methods).map(method => ({label: method, value: method})),
    placeholder: requestHook.request.method,
    on: {update: (method: string) => {
      requestHook.update({method}).catch(() => {
        // Re-sync the DOM to the rolled-back state; reset() would show the placeholder, not the reverted method.
        methodSelector.set(requestHook.request.method);
      });
    }},
  });

  const urlInput = NInput({
    placeholder: "URL",
    value: requestHook.request.url,
    on: {update: (url: string) => {
      requestHook.update({url}).catch(() => {
        // Persist failed (store reverted): keep the DOM in sync with hook state.
        urlInput.value = requestHook.request.url;
      });
    }},
  });

  const bodyEditor = EditorJSON({
    class: "h100",
    value: requestHook.request.body,
    schema: props.schema,
    on: {update: (body: string) => {
      requestHook.update({body}).catch(() => {}); // NOTE: body editor not re-synced on failed persist (EditorJSON exposes no update API)
    }},
  });

  const headersList = ParamsList({
    value: requestHook.request.headers,
    on: {update: headers => {
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

  const syncSendButton = (): void => {
    sendButton.loading = operationsHook.sending;
    sendButton.disabled = requestHook.loading || operationsHook.sending;
  };
  const unsubscribeRequestLoading = requestHook.loadingSignal.sub(function*() {
    while (true) {
      yield;
      syncSendButton();
    }
  }());
  const unsubscribeOperationsSending = operationsHook.sendingSignal.sub(function*() {
    while (true) {
      yield;
      syncSendButton();
    }
  }());

  const unmount = () => {
    unsubscribeRequestLoading();
    unsubscribeOperationsSending();
  };

  return {
    el,
    unmount,
  };
}
