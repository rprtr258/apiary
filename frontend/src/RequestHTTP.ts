import {database} from '../wailsjs/go/models';
import {HistoryEntry, Method as Methods} from "./api";
import {NInputGroup, NInput, NSelect, NButton} from "./components/input";
import {NTabs} from "./components/layout";
import {NTag, NTable, NEmpty} from "./components/dataview";
import EditorJSON from "./components/EditorJSON";
import ViewJSON from "./components/ViewJSON";
import ParamsList from "./components/ParamsList";
import {type get_request, last_history_entry} from "./store";
import {DOMNode, m, Signal} from "./utils";
import Split from "split-grid";

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

function responseBadge(response: any): DOMNode {
  const code = response.code;
  return NTag({
    type: (
      code < 300 ? "success" :
      code < 500 ? "warning" :
                   "error"
    ) as "success" | "info" | "warning",
    size: "small",
    round: true,
  }, `${code ?? "N/A"}`);
}

function NSplit(left: HTMLElement, right: HTMLElement) {
  const el_line = m("hr", {style: {
    cursor: "col-resize",
    border: "none",
    "background-color": "white",
    width: "2px",
  }});
  const el = m("div", {
    class: "h100",
    id: "split-request-http",
    style: {
      display: "grid",
      "grid-template-columns": "1fr 5px 1fr",
      "grid-template-rows": "100%",
    },
  },
    left,
    el_line,
    right,
  );
  Split({
    columnGutters: [
      {track: 1, element: el_line},
    ],
  });
  return el;
}

export default function(
  el: HTMLElement,
  show_request: Signal<boolean>, // TODO: remove, show by default
  on: {
    update: (patch: Partial<Request>) => Promise<void>,
    send: () => Promise<void>,
  },
): {
  loaded(r: get_request): void,
  push_history_entry(he: HistoryEntry): void, // show last history entry
  // TODO: hide/show request
} {
  el.append(NEmpty({
    description: "Loading request...",
    class: "h100",
    style: {"justify-content": "center"},
  }));

  const el_response = NEmpty({
    description: "Send request or choose one from history.",
    class: "h100",
    style: {"justify-content": "center"},
  });
  const el_view_response_body = ViewJSON("");
  const update_response = (response: database.HTTPResponse | null) => {
    if (response === null) {return;}

    el_response.replaceChildren(NTabs({
      type: "card",
      size: "small",
      class: "h100",
      style: {"overflow-y": "none"},
      tabs: [
        {
          name: responseBadge(response),
          disabled: true,
        },
        {
          name: "Body",
          style: {"overflow-y": "auto"},
          elem: el_view_response_body.el,
        },
        {
          name: "Headers",
          style: {
            flex: 1,
            "overflow-y": "auto",
          },
          elem: NTable({
            size: "small",
            "single-column": true,
            "single-line": false,
            style: {
              "border-collapse": "collapse",
            },
          }, [
            m("colgroup", {},
              m("col", {style: {width: "30%"}}),
              m("col", {style: {width: "70%"}}),
            ),
            m("thead", m("tr", {}, m("th", {}, "NAME"), m("th", {}, "VALUE"))),
            ...response.headers.map(header => m("tr", {},
              m("td", {style: {border: "1px solid #444"}}, header.key),
              m("td", {style: {border: "1px solid #444", "word-break": "break-word"}}, header.value),
            )),
          ]),
        },
      ],
    }));
    el_view_response_body.update(response.body);
  };

  return {
    loaded(r: get_request) {
      let request = r.request as Request;
      const el_send = NButton({
        type: "primary",
        on: {click: () => {
          el_send.disabled = true;
          on.send().then(() => {
            el_send.disabled = false;
            // TODO: refetch
          });
        }},
      }, "Send");
      const update_requestt = (patch: Partial<database.HTTPRequest>): void => {
        el_send.disabled = true;
        on.update(patch).then(() => {
          el_send.disabled = false;
        });
      };
      update_response(last_history_entry(r)?.response as database.HTTPResponse | null);

      el.replaceChildren(m("div", {
        class: "h100",
        style: {
          display: "grid",
          "grid-template-columns": "1fr",
          "grid-template-rows": "auto minmax(0, 1fr)",
          "grid-column-gap": ".5em",
        },
      }, [
        show_request ? NInputGroup({style: {
          "grid-column": "span 2",
          display: "grid",
          "grid-template-columns": "1fr 10fr 1fr",
        }},
          NSelect({
            label: request.method,
            options: Object.keys(Methods).map(method => ({label: method, value: method})),
            on: {update: (method: string) => update_requestt({method})},
          }).el,
          NInput({
            placeholder: "URL",
            value: request.url,
            on: {update: (url: string) => update_requestt({url})},
          }),
          el_send,
        ) : null,
        NSplit(
          (() => {
            const el_req_show = NTabs({
              type: "line",
              size: "small",
              class: "h100",
              tabs: [
                {
                  name: "Request",
                  class: "h100",
                  elem: EditorJSON({
                    value: request.body ?? null,
                    on: {update: (body: string) => update_requestt({body})},
                  }),
                },
                {
                  name: "Headers",
                  style: {
                    display: "flex",
                    "flex-direction": "column",
                    flex: 1,
                  },
                  elem: [ParamsList({
                    value: request.headers,
                    on: {update: (value: database.KV[]): void => update_requestt({headers: value})},
                  })],
                },
              ],
            });
            const el_req_hide = m("div");
            const el_req = el_req_show;
            show_request.sub(b => {
              if (b) {
                if (el_req !== el_req_show) {
                  el_req.replaceChildren(el_req_show);
                }
              } else {
                el_req.replaceChildren(el_req_hide);
              }
            });
            return el_req;
          })(),
          el_response,
        ),
      ]));
    },
    push_history_entry(he: HistoryEntry) {
      update_response(he.response as database.HTTPResponse);
    },
    // unmount() { // TODO: uncomment and use
    //   // TODO: destroy split
    //   el_view_response_body.unmount();
    // },
  };
}
