import {database} from "../wailsjs/go/models.ts";
import {HistoryEntry, Method as Methods} from "./api.ts";
import {NInputGroup, NInput, NSelect, NButton} from "./components/input.ts";
import {NTabs, NSplit} from "./components/layout.ts";
import {NTag, NTable, NEmpty} from "./components/dataview.ts";
import EditorJSON from "./components/EditorJSON.ts";
import ViewJSON from "./components/ViewJSON.ts";
import ParamsList from "./components/ParamsList.ts";
import {type get_request, last_history_entry} from "./store.ts";
import {DOMNode, m, setDisplay, Signal} from "./utils.ts";

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

function responseBadge(response: database.HTTPResponse): DOMNode {
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
  unmount(): void,
} {
  el.append(NEmpty({description: "Loading request..."}));

  const el_response = NEmpty({description: "Send request or choose one from history."});
  const el_view_response_body = ViewJSON("");
  const unmounts: (() => void)[] = [() => el_view_response_body.unmount()];
  const update_response = (response: database.HTTPResponse | undefined) => {
    if (response === undefined) return;

    el_response.replaceChildren(NTabs({
      class: "h100",
      tabs: [
        {
          name: responseBadge(response),
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
              m("td", {style: {border: "1px solid #444", wordBreak: "break-word"}}, header.value),
            )),
          ]),
        },
      ],
    }));
    el_view_response_body.update(response.body);
  };

  return {
    loaded(r: get_request) {
      const request = r.request as Request;
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
      const update_request = (patch: Partial<database.HTTPRequest>): void => {
        el_send.disabled = true;
        on.update(patch).then(() => {
          el_send.disabled = false;
        });
      };
      update_response(last_history_entry(r)?.response as database.HTTPResponse | undefined);

      const el_input_group = NInputGroup({style: {
        gridColumn: "span 2",
        display: "grid",
        gridTemplateColumns: "1fr 10fr 1fr",
      }},
        NSelect({
          label: request.method,
          options: Object.keys(Methods).map(method => ({label: method, value: method})),
          placeholder: request.method,
          on: {update: (method: string) => update_request({method})},
        }).el,
        NInput({
          placeholder: "URL",
          value: request.url,
          on: {update: (url: string) => update_request({url})},
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
              value: request.body ?? null,
              on: {update: (body: string) => update_request({body})},
            }),
          },
          {
            name: "Headers",
            style: {
              display: "flex",
              flexDirection: "column",
              flexGrow: "1",
            },
            elem: [ParamsList({
              value: request.headers,
              on: {update: (value: database.KV[]): void => update_request({headers: value})},
            })],
          },
        ],
      });

      const split = NSplit(el_req_tabs, el_response, {direction: "horizontal"});
      unmounts.push(() => split.unmount());
      const el_container = m("div", {
        class: "h100",
        style: {
          display: "grid",
          gridTemplateColumns: "1fr",
          gridTemplateRows: "auto minmax(0, 1fr)",
          gridColumnGap: ".5em",
        },
      }, el_input_group, split.element);
      unmounts.push(show_request.sub(show_request => {
        split.leftVisible = show_request;
        setDisplay(el_input_group, show_request);
        el_container.style.gridTemplateRows = show_request ? "auto minmax(0, 1fr)" : "minmax(0, 1fr)";
      }, true));
      el.replaceChildren(el_container);
    },
    push_history_entry(he: HistoryEntry) {
      update_response(he.response as database.HTTPResponse);
    },
    unmount() {
      for (const unmount of unmounts) {
        unmount();
      }
    },
  };
}
