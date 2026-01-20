import {NButton, NInputGroup, NInput} from "./components/input.ts";
import {NEmpty} from "./components/dataview.ts";
import {NSplit} from "./components/layout.ts";
import ViewJSON from "./components/ViewJSON.ts";
import EditorJSON from "./components/EditorJSON.ts";
import {database} from "../wailsjs/go/models.ts";
import {get_request, last_history_entry} from "./store.ts";
import {m, Signal, setDisplay, signal} from "./utils.ts";
import {HistoryEntry} from "./types.ts";

type Request = {kind: database.Kind.REDIS} & database.RedisRequest;

export default function(
  el: HTMLElement,
  show_request: Signal<boolean>,
  on: {
    update: (patch: Partial<Request>) => Promise<void>,
    send: () => Promise<void>,
  },
): {
  loaded(r: get_request): void,
  push_history_entry(he: HistoryEntry): void,
  unmount(): void,
} {
  el.append(NEmpty({description: "Loading request..."}));
  const el_empty_response = NEmpty({description: "Send request or choose one from history."});

  const el_send = NButton({
    type: "primary",
    on: {click: on.send},
    disabled: false,
  }, "Send");
  const response = signal<database.RedisResponse | undefined>(undefined);
  const el_view_response_body = ViewJSON("");
  const unmounts: (() => void)[] = [() => el_view_response_body.unmount()];
  const update_request = (patch: Partial<database.RedisRequest>): void => {
    el_send.disabled = true;
    on.update(patch).then(() => {
      el_send.disabled = false;
    });
  };
  const el_response = m("div", {class: "h100"});
  unmounts.push(response.sub(function*() {
    let is_empty = false; // NOTE: to trigger first call to set it to true
    while (true) {
      const r = yield;
      if (r === undefined) {
        if (!is_empty) {
          el_response.replaceChildren(el_empty_response);
          is_empty = true;
        }
        continue;
      }

      el_view_response_body.update(r.response);
      if (is_empty) {
        el_response.replaceChildren(el_view_response_body.el);
        is_empty = false;
      }
    }
  }()));

  return {
    loaded: (r: get_request) => {
      const request = r.request as Request;
      response.update(() => last_history_entry(r)?.response as database.RedisResponse | undefined);

      const el_input_group = NInputGroup({style: {
        display: "grid",
        gridTemplateColumns: "11fr 1fr",
      }}, [
        NInput({
          style: {
            flexGrow: "1",
          },
          placeholder: "DSN",
          value: request.dsn,
          on: {update: (dsn: string) => update_request({dsn})},
        }),
        el_send.el,
      ]);

      const el_editor_json = EditorJSON({
        class: "h100",
        value: request.query,
        on: {update: (value: string) => update_request({query: value})},
      });

      const split = NSplit(el_editor_json, el_response, {direction: "horizontal"});
      unmounts.push(() => split.unmount());
      const el_container = m("div", {
        class: "h100",
        style: {
          display: "flex",
          flexDirection: "column",
        },
      }, el_input_group, split.element);
      unmounts.push(show_request.sub(function*() {
        while (true) {
          const show_request = yield;
          split.leftVisible = show_request;
          setDisplay(el_input_group, show_request);
        }
      }()));
      el.replaceChildren(el_container);
    },
    push_history_entry(he: HistoryEntry) {
      response.update(() => he.response as database.RedisResponse);
    },
    unmount() {
      for (const unmount of unmounts) {
        unmount();
      }
    },
  };
}
