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
  show_request: Signal<boolean>,
  on: {
    update: (patch: Partial<Request>) => Promise<void>,
    send: () => Promise<void>,
  },
): {
  loaded(r: get_request): void,
  push_history_entry(he: HistoryEntry): void, // show last history entry
  unmount(): void,
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
  const update_request = (patch: Partial<database.JQRequest>): void => {
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
  let unsub_show = () => {};
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

      const el_input_group = NInputGroup({style: {
        "display": "grid",
        gridTemplateColumns: "11fr 1fr",
        gridColumn: "span 2",
      }}, [
        NInput({
          placeholder: "JQ query",
          status: jqerror !== null ? "error" : "success",
          value: request.query,
          on: {update: (query: string) => update_request({query})},
        }),
        // TODO: autosend
        el_send,
      ]);

      const el_editor_json = EditorJSON({
        class: "h100",
        value: request.json,
        on: {update: (json: string) => update_request({json})},
      });

      const updateLayout = (show_request: boolean) => {
        if (show_request) {
          el.replaceChildren(m("div", {
            class: "h100",
            style: {
              display: "grid",
              gridTemplateColumns: "50% 50%",
              gridTemplateRows: "auto minmax(0, 1fr)",
            },
          }, el_input_group, el_editor_json, el_response));
        } else {
          el.replaceChildren(m("div", {
            class: "h100",
            style: {
              display: "grid",
              gridTemplateColumns: "1fr",
              gridTemplateRows: "1fr",
            },
          }, el_response));
        }
      };

      unsub_show = show_request.sub(updateLayout);
    },
    push_history_entry(he) {
      update_response(he.response as database.JQResponse);
    },
    unmount() {
      unsub_show();
      el_view_response_body.unmount();
    },
  };
}
