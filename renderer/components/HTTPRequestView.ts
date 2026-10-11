import * as t from "@/types.ts";
import {HistoryEntry, HTTPCodes} from "@/types.ts";
import {m, setDisplay, Signal, signal} from "../lib/utils.ts";
import notification from "../lib/notification.ts";
import {NTabs, NSplit} from "./layout.ts";
import {NTag, NTable, NEmpty, tagColors} from "./dataview.ts";
import NRequestForm from "./NRequestForm.ts";
import type {JSONSchema7} from "json-schema";
import ViewJSON from "./ViewJSON.ts";

type Request = t.HTTPRequest;

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

function responseBadge(response: t.HTTPResponse): HTMLElement {
  const code = response.code;
  const statusName = code in HTTPCodes ? HTTPCodes[code as keyof typeof HTTPCodes] : undefined;
  const tooltip = statusName !== undefined ? `${code} ${statusName}` : `${code}`;

  const tagType = 
    code < 300 ? "success" :
    code < 500 ? "warning" :
                 "error";
  return NTag({
    label: `${code}`,
    color: tagColors[tagType],
    tooltip: tooltip,
  });
}

export type HTTPRequestViewResult = {
  loaded(r: {request: Request, history: HistoryEntry[]}): void,
  push_history_entry(he: HistoryEntry): void,
  unmount(): void,
};

export default function HTTPRequestView(
  el: HTMLElement,
  {
    showRequest = signal(true),
    schema,
    on: {
      send: onSend,
      update: onUpdate = async () => {},
    },
  }: {
    showRequest?: Signal<boolean>,
    schema?: JSONSchema7,
    on: {
      send: (request: t.HTTPRequest) => Promise<void>,
      update?: (request: t.HTTPRequest) => Promise<void>,
    },
  },
): HTTPRequestViewResult {
  el.append(NEmpty({description: "Loading request..."}));

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
  const update_response = (response: t.HTTPResponse | undefined) => {
    if (response === undefined)
      return;

    badgeContainer.replaceChildren(responseBadge(response));
    el_view_response_body.update(response.body);
    tbody.replaceChildren(...response.headers.map((header: t.KV) => m("tr", {},
      m("td", {style: {border: "1px solid #444"}}, header.key),
      m("td", {style: {border: "1px solid #444", wordBreak: "break-word"}}, header.value),
    )));
    if (!tabsReplaced) {
      el_response.replaceChildren(tabsElement);
      tabsReplaced = true;
    }
  };

  const push_history_entry = (he: HistoryEntry) => {
    update_response(he.response as t.HTTPResponse);
  };

  return {
    loaded(r: {request: Request, history: HistoryEntry[]}) {
      const request = r.request;

      if (r.history.length > 0) {
        const lastHistory = r.history[r.history.length - 1];
        update_response(lastHistory.response as t.HTTPResponse);
      }

      const requestForm = NRequestForm({
        initialRequest: request,
        schema: schema,
        on: {
          send: async (request: t.HTTPRequest) => {
            try {
              await onSend(request);
            } catch (e) {
              notification("error", "Send failed", {error: e});
            }
          },
          update: async (request: t.HTTPRequest) => {
            await onUpdate(request);
          },
        },
      });
      unmounts.push(() => requestForm.unmount());

      const split = NSplit(requestForm.el, el_response, {direction: "horizontal", style: {minHeight: "0"}});
      unmounts.push(() => split.unmount());
      const el_container = m("div", {
        class: "h100",
        style: {
          display: "flex",
          flexDirection: "column",
          width: "100%",
        },
      }, split.element);
      unmounts.push(showRequest.sub(function*() {
        while (true) {
          const show_request = yield;
          split.leftVisible = show_request;
          setDisplay(requestForm.el, show_request);
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
