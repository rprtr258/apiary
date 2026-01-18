import {database} from "../../wailsjs/go/models.ts";
import {HistoryEntry, Method as Methods} from "../api.ts";
import {NInputGroup, NInput, NSelect, NButton} from "./input.ts";
import {NTabs, NSplit} from "./layout.ts";
import {NTag, NTable, NEmpty} from "./dataview.ts";
import EditorJSON from "./EditorJSON.ts";
import ViewJSON from "./ViewJSON.ts";
import ParamsList from "./ParamsList.ts";
import {m, setDisplay, Signal, signal} from "../utils.ts";
import {notification} from "../store.ts";

type Request = database.HTTPRequest;

// function responseBodyLanguage(contentType: string): string {
//   for (const [key, value] of Object.entries({
//     "application/json;": "json",
//     "text/html;": "html",
//   })) {
//     if (contentType.startsWith(key)) {
//       return value;
//     }
//   }
//   return "text";
// };

function responseBadge(response: database.HTTPResponse): HTMLElement {
  const code = response.code;
  return NTag({
    type: (
      code < 300 ? "success" :
      code < 500 ? "warning" :
                   "error"
    ),
    size: "small",
    round: true,
  }, `${code}`);
}

export interface HTTPRequestViewResult {
  loaded(r: {request: Request, history: HistoryEntry[]}): void,
  push_history_entry(he: HistoryEntry): void,
  unmount(): void,
}

export default function HTTPRequestView(
  el: HTMLElement,
  {
    initialRequest,
    showRequest = signal(true),
    on: {
      send: onSend,
      update: onUpdate = async () => {},
    },
  }: {
    initialRequest: database.HTTPRequest,
    showRequest?: Signal<boolean>,
    on: {
      send: (request: database.HTTPRequest) => Promise<void>,
      update?: (request: database.HTTPRequest) => Promise<void>,
    },
  },
): HTTPRequestViewResult {
  el.append(NEmpty({description: "Loading request..."}));

  const el_send = NButton({
    type: "primary",
    on: {click: () => {
      el_send.disabled = true;
      onSend(currentRequest).then(() => {
        el_send.disabled = false;
      }).catch(e => {
        el_send.disabled = false;
        notification.error({title: "Send failed", error: e});
      });
    }},
  }, "Send");

  let currentRequest = initialRequest;

  const updateRequest = (patch: Partial<database.HTTPRequest>): void => {
    el_send.disabled = true;
    const newRequest = database.HTTPRequest.createFrom(currentRequest);
    Object.assign(newRequest, patch);
    currentRequest = newRequest;

    onUpdate(currentRequest).then(() => {
      el_send.disabled = false;
    }).catch(() => {
      el_send.disabled = false;
    });
  };

  const el_response = NEmpty({description: "Send request or choose one from history."});
  const el_view_response_body = ViewJSON("");
  const tbody = m("tbody", {});
  const el_headers_table = NTable({
    size: "small",
    "single-column": true,
    "single-line": false,
    style: {
      borderCollapse: "collapse",
    },
  }, [
    m("colgroup", {},
      m("col", {style: {width: "30%"}}),
      m("col", {style: {width: "70%"}}),
    ),
    m("thead", {},
      m("tr", {},
        m("th", {}, "NAME"),
        m("th", {}, "VALUE"),
      ),
    ),
    tbody,
  ]);
  const unmounts: (() => void)[] = [() => el_view_response_body.unmount()];
  const badgeContainer = m("span", {});
  let tabsReplaced = false;
  const tabsElement = NTabs({
    tabs: [
      {
        name: badgeContainer,
        disabled: true,
      },
      {
        name: "Body",
        elem: el_view_response_body.el,
      },
      {
        name: "Headers",
        style: {
          flexGrow: "1",
          overflowY: "auto",
        },
        elem: el_headers_table,
      },
    ],
  });
  const update_response = (response: database.HTTPResponse | undefined) => {
    if (response === undefined)
      return;

    badgeContainer.replaceChildren(responseBadge(response));
    el_view_response_body.update(response.body);
    tbody.replaceChildren(...response.headers.map((header: database.KV) => m("tr", {},
      m("td", {style: {border: "1px solid #444"}}, header.key),
      m("td", {style: {border: "1px solid #444", wordBreak: "break-word"}}, header.value),
    )));
    if (!tabsReplaced) {
      el_response.replaceChildren(tabsElement);
      tabsReplaced = true;
    }
  };

  const push_history_entry = (he: HistoryEntry) => {
    update_response(he.response as database.HTTPResponse);
  };

  return {
    loaded(r: {request: Request, history: HistoryEntry[]}) {
      const request = r.request;
      currentRequest = request;

      if (r.history.length > 0) {
        const lastHistory = r.history[r.history.length - 1];
        update_response(lastHistory.response as database.HTTPResponse);
      }

      const el_input_group = NInputGroup({style: {
        display: "grid",
        gridTemplateColumns: "1fr 10fr 1fr",
      }},
        NSelect({
          options: Object.keys(Methods).map(method => ({label: method, value: method})),
          placeholder: request.method,
          on: {update: (method: string) => updateRequest({method})},
        }).el,
        NInput({
          placeholder: "URL",
          value: request.url,
          on: {update: (url: string) => updateRequest({url})},
        }),
        el_send,
      );

      const el_req_tabs = NTabs({
        class: "h100",
        tabs: [
          {
            name: "Request",
            class: "h100",
            elem: EditorJSON({
              class: "h100",
              value: request.body,
              on: {update: (body: string) => updateRequest({body})},
            }),
          },
          {
            name: "Headers",
            style: {
              display: "flex",
              flexDirection: "column",
              flexGrow: "1",
            },
            elem: ParamsList({
              value: request.headers,
              on: {update: (value: database.KV[]): void => updateRequest({headers: value})},
            }),
          },
        ],
      });

      const split = NSplit(el_req_tabs, el_response, {direction: "horizontal", style: {minHeight: "0"}});
      unmounts.push(() => split.unmount());
      const el_container = m("div", {
        class: "h100",
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
        },
      }, el_input_group, split.element);
      unmounts.push(showRequest.sub(function*() {
        while (true) {
          const show_request = yield;
          split.leftVisible = show_request;
          setDisplay(el_input_group, show_request);
        }
      }()));
      el.replaceChildren(el_container);
    },
    push_history_entry,
    unmount() {
      for (const unmount of unmounts) {
        unmount();
      }
    },
  };
}
