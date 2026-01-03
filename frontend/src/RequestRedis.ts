import {NButton, NInputGroup, NInput} from "./components/input.ts";
import {NEmpty} from "./components/dataview.ts";
import ViewJSON from "./components/ViewJSON.ts";
import EditorJSON from "./components/EditorJSON.ts";
import {database} from "../wailsjs/go/models.ts";
import {get_request} from "./store.ts";
import {m, Signal} from "./utils.ts";
import {HistoryEntry} from "./api.ts";

type Request = {kind: database.Kind.REDIS} & database.RedisRequest;

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

  const el_send = NButton({
    type: "primary",
    on: {click: on.send},
    disabled: false,
  }, "Send");
  const el_response = NEmpty({
    description: "Send request or choose one from history.",
    class: "h100",
    style: {justifyContent: "center"},
  });
  const el_view_response_body = ViewJSON("");
  const update_requestt = (patch: Partial<database.RedisRequest>): void => {
    el_send.disabled = true;
    on.update(patch).then(() => {
      el_send.disabled = false;
    });
  };
  const update_response = (r: database.RedisResponse | null): void => {
    if (r === null) {return;} // TODO: replace with empty state

    el_response.replaceChildren(el_view_response_body.el);
    el_view_response_body.update(r.response);
  };

  return {
    loaded: (r: get_request) => {
      const request = r.request as Request;

      el.replaceChildren(m("div", {
        class: "h100",
        style: {
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "34px 1fr",
          gridColumnGap: ".5em",
        },
      },
        NInputGroup({style: {gridColumn: "span 2"}}, [
          NInput({
            placeholder: "DSN",
            value: request.dsn,
            on: {update: (dsn: string) => update_requestt({dsn})},
          }),
          el_send,
        ]),
        EditorJSON({
          class: "h100",
          value: request.query,
          on: {update: (value: string) => update_requestt({query: value})},
        }),
        el_response,
      ));
    },
    push_history_entry(he: HistoryEntry) {
      update_response(he.response as database.RedisResponse);
    },
    // unmount() { // TODO: uncomment and use
    //   el_view_response_body.unmount();
    // },
  };
}
