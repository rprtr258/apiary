import {database} from "../../wailsjs/go/models.ts";
import {HistoryEntry, HTTPRequest} from "../types.ts";
import {NTabs, NSplit} from "./layout.ts";
import {NTag, NTable, NEmpty} from "./dataview.ts";
import ViewJSON from "./ViewJSON.ts";
import {m, setDisplay, Signal, signal} from "../utils.ts";
import NRequestForm from "./NRequestForm.ts";

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
    showRequest = signal(true),
    on: {
      send: onSend,
      update: onUpdate = async () => {},
    },
  }: {
    showRequest?: Signal<boolean>,
    on: {
      send: (request: database.HTTPRequest) => Promise<void>,
      update?: (request: database.HTTPRequest) => Promise<void>,
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
      if (r.history.length > 0) {
        const lastHistory = r.history[r.history.length - 1];
        update_response(lastHistory.response as database.HTTPResponse);
      }

      const requestForm = NRequestForm({
        initialRequest: r.request as HTTPRequest,
        on: {
          send: async (request: HTTPRequest) => {
            await onSend(request as database.HTTPRequest);
          },
          update: async (request: HTTPRequest) => {
            await onUpdate(request as database.HTTPRequest);
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
