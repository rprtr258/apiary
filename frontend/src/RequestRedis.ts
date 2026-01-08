import {NButton, NInputGroup, NInput} from "./components/input.ts";
import {NEmpty} from "./components/dataview.ts";
import {NSplit} from "./components/layout.ts";
import ViewJSON from "./components/ViewJSON.ts";
import EditorJSON from "./components/EditorJSON.ts";
import {database} from "../wailsjs/go/models.ts";
import {get_request} from "./store.ts";
import {m, Signal, setDisplay} from "./utils.ts";
import {HistoryEntry} from "./api.ts";

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
  push_history_entry(he: HistoryEntry): void, // show last history entry
  unmount(): void,
} {
  el.append(NEmpty({description: "Loading request..."}));

  const el_send = NButton({
    type: "primary",
    on: {click: on.send},
    disabled: false,
    style: {width: "10em"},
  }, "Send");
  const el_response = NEmpty({description: "Send request or choose one from history."});
  const el_view_response_body = ViewJSON("");
  const unmounts: (() => void)[] = [() => el_view_response_body.unmount()];
  const update_request = (patch: Partial<database.RedisRequest>): void => {
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

      const el_input_group = NInputGroup({style: {
        gridColumn: "span 2",
        display: "flex",
      }}, [
        NInput({
          style: {
            flexGrow: "1",
          },
          placeholder: "DSN",
          value: request.dsn,
          on: {update: (dsn: string) => update_request({dsn})},
        }),
        el_send,
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
          display: "grid",
          gridTemplateColumns: "1fr",
          gridTemplateRows: "auto minmax(0, 1fr)",
          gridColumnGap: ".5em",
        },
      }, el_input_group, split.element);
      el.replaceChildren(el_container);

      unmounts.push(show_request.sub((show_request: boolean) => {
        split.leftVisible = show_request;
        setDisplay(el_input_group, show_request);
        el_container.style.gridTemplateRows = show_request ? "auto minmax(0, 1fr)" : "minmax(0, 1fr)";
      }));
    },
    push_history_entry(he: HistoryEntry) {
      update_response(he.response as database.RedisResponse);
    },
    unmount() {
      for (const unmount of unmounts) {
        unmount();
      }
    },
  };
}
