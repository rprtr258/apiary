import {database} from "../wailsjs/go/models.ts";
import {NInput, NButton, NInputGroup} from "./components/input.ts";
import {NEmpty} from "./components/dataview.ts";
import ViewJSON from "./components/ViewJSON.ts";
import EditorJSON from "./components/EditorJSON.ts";
import {get_request, last_history_entry} from "./store.ts";
import {m, Signal} from "./utils.ts";
import {HistoryEntry} from "./api.ts";

type Request = {kind: database.Kind.JQ} & database.JQRequest;

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
    style: {justifyContent: "center"},
  }));

  const jqerror: string | null = null; // TODO: use
  const el_send = NButton({
    type: "primary",
    on: {click: on.send},
    disabled: true,
  }, "Send");
  const update_requestt = (patch: Partial<database.JQRequest>): void => {
    el_send.disabled = true;
    on.update(patch).then(() => {
      el_send.disabled = false;
    });
  };

  const el_response = NEmpty({
    description: "Send request or choose one from history.",
    class: "h100",
    style: {justifyContent: "center"},
  });
  const el_view_response_body = ViewJSON("");
  const update_response = (response: database.JQResponse | null) => {
    if (response === null) {return;}

    if (jqerror !== null) {
      el_response.replaceChildren(m("div", {style: {position: "fixed", color: "red", bottom: "3em"}}, jqerror));
      return;
    }

    el_response.replaceChildren(el_view_response_body.el);
    el_view_response_body.update(response.response.join("\n"));
  };

  return {
    loaded: (r: get_request) => {
      const request = r.request as Request;
      update_response((last_history_entry(r)?.response as database.JQResponse | undefined) ?? null);

      el.replaceChildren(m("div", {
        class: "h100",
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "auto minmax(0, 1fr)",
          gridColumnGap: ".5em",
        },
      },
        show_request.value ? [NInputGroup({style: {
          "display": "grid",
          gridTemplateColumns: "11fr 1fr",
          gridColumn: "span 2",
        }}, [
          NInput({
            placeholder: "JQ query",
            status: jqerror !== null ? "error" : "success",
            value: request.query,
            on: {update: (query: string) => update_requestt({query})},
          }),
          // TODO: autosend
          el_send,
        ]),
        EditorJSON({
          class: "h100",
          value: request.json,
          on: {update: (json: string) => update_requestt({json})},
        })] : null,
        el_response,
      ));
    },
    push_history_entry(he) {
      update_response(he.response as database.JQResponse);
    },
  };
}
