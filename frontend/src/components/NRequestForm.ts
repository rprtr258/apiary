import {m, Signal} from "../utils.ts";
import {NInputGroup, NInput, NSelect, NButton} from "./input.ts";
import {NTabs} from "./layout.ts";
import EditorJSON from "./EditorJSON.ts";
import ParamsList from "./ParamsList.ts";
import {useRequest} from "../hooks/useRequest.ts";
import {useRequestOperations} from "../hooks/useRequestOperations.ts";
import {Method as Methods, HTTPRequest} from "../types.ts";

export type NRequestFormProps = {
  initialRequest: HTTPRequest,
  showRequest?: Signal<boolean>,
  on: {
    send: (request: HTTPRequest) => Promise<void>,
    update?: (request: HTTPRequest) => Promise<void>,
  },
  style?: Partial<CSSStyleDeclaration>,
  class?: string,
};

export type NRequestFormResult = {
  el: HTMLElement,
  request: HTTPRequest,
  loading: boolean,
  sending: boolean,
  update: (patch: Partial<HTTPRequest>) => Promise<void>,
  send: () => Promise<void>,
  reset: () => void,
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
 *
 * Uses headless hooks for state management and operations.
 */
export default function NRequestForm(props: NRequestFormProps): NRequestFormResult {
  const container = m("div", {
    class: props.class,
    style: {
      display: "flex",
      flexDirection: "column",
      width: "100%",
      ...props.style,
    },
  });

  // Use headless hooks for state management
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
      return undefined;
    },
    update: async (request: HTTPRequest) => {
      if (props.on.update !== undefined) {
        await props.on.update(request);
      }
    },
  }});

  // Create send button
  const sendButton = NButton({
    type: "primary",
    disabled: requestHook.loading || operationsHook.sending,
    on: {click: () => {
      operationsHook.send(requestHook.request).catch((e: unknown) => {
        // Error handling is done by the hook
        console.error("Send failed:", e);
      });
    }},
  }, "Send");
  sendButton.loading = operationsHook.sending;

  // Create method selector
  const methodSelector = NSelect({
    options: Object.keys(Methods).map(method => ({label: method, value: method})),
    placeholder: requestHook.request.method,
    on: {update: (method: string) => {
      requestHook.update({method}).catch(() => {});
    }},
  });

  // Create URL input
  const urlInput = NInput({
    placeholder: "URL",
    value: requestHook.request.url,
    on: {update: (url: string) => {
      requestHook.update({url}).catch(() => {});
    }},
  });

  // Create request body editor
  const bodyEditor = EditorJSON({
    class: "h100",
    value: requestHook.request.body,
    on: {update: (body: string) => {
      requestHook.update({body}).catch(() => {});
    }},
  });

  // Create headers list
  const headersList = ParamsList({
    value: requestHook.request.headers,
    on: {update: (headers) => {
      requestHook.update({headers}).catch(() => {});
    }},
  });

  // Create request tabs (Body and Headers)
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

  // Create input group (method selector + URL + send button)
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

  // Assemble the form
  container.append(
    inputGroup,
    requestTabs,
  );

  // Update send button state based on loading/sending signals
  const unsubscribeRequestLoading = requestHook.loadingSignal.sub(function*() {
    while (true) {
      yield;
      sendButton.disabled = requestHook.loading || operationsHook.sending;
    }
  }());

  const unsubscribeOperationsSending = operationsHook.sendingSignal.sub(function*() {
    while (true) {
      yield;
      sendButton.disabled = requestHook.loading || operationsHook.sending;
    }
  }());

  const unmount = () => {
    unsubscribeRequestLoading();
    unsubscribeOperationsSending();
    if ("unmount" in bodyEditor && typeof bodyEditor.unmount === "function") {
      (bodyEditor.unmount as () => void)();
    }
    if ("unmount" in headersList && typeof headersList.unmount === "function") {
      (headersList.unmount as () => void)();
    }
  };

  return {
    el: container,
    get request() { return requestHook.request; },
    get loading() { return requestHook.loading; },
    get sending() { return operationsHook.sending; },
    update: requestHook.update,
    send: async () => {
      await operationsHook.send(requestHook.request);
    },
    reset: () => {
      requestHook.reset();
      operationsHook.reset();
    },
    unmount,
  };
}
