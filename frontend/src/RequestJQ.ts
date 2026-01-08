import {database} from "../wailsjs/go/models.ts";
import {NInput, NButton, NInputGroup} from "./components/input.ts";
import {NEmpty} from "./components/dataview.ts";
import ViewJSON from "./components/ViewJSON.ts";
import EditorJSON from "./components/EditorJSON.ts";
import {NSplit} from "./components/layout.ts";
import {get_request, last_history_entry} from "./store.ts";
import {m, setDisplay, Signal} from "./utils.ts";
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
  el.append(NEmpty({description: "Loading request..."}));

  const jqerror: string | undefined = undefined;
  const el_send = NButton({ // TODO: autosend
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

  const el_response = NEmpty({description: "Send request or choose one from history."});
  const el_view_response_body = ViewJSON("");
  const unmounts: (() => void)[] = [() => el_view_response_body.unmount()];
  const update_response = (response: database.JQResponse | undefined) => {
    if (response === undefined)
      return;

    if (jqerror !== undefined) {
      el_response.replaceChildren(m("div", {style: {position: "fixed", color: "red", bottom: "3em"}}, jqerror));
      return;
    }

    el_response.replaceChildren(el_view_response_body.el);
    el_view_response_body.update(response.response.join("\n"));
  };

  return {
    loaded: (r: get_request) => {
      const request = r.request as Request;
      update_response(last_history_entry(r)?.response as database.JQResponse | undefined);

      const el_input_group = NInputGroup({style: {
        display: "grid",
        gridTemplateColumns: "11fr 1fr",
      }}, [
        NInput({
          placeholder: "JQ query",
          status: jqerror !== undefined ? "error" : "success",
          value: request.query,
          on: {update: (query: string) => update_request({query})},
        }),
        el_send,
      ]);

      const el_editor_json = EditorJSON({
        class: "h100",
        value: request.json,
        on: {update: (json: string) => update_request({json})},
      });

      const split = NSplit(el_editor_json, el_response, {direction: "horizontal", style: {minHeight: "0"}});
      unmounts.push(() => split.unmount());
      const el_container = m("div", {
        class: "h100",
        style: {
          display: "flex",
          flexDirection: "column",
        },
      }, el_input_group, split.element);
      unmounts.push(show_request.sub(show_request => {
        split.leftVisible = show_request;
        setDisplay(el_input_group, show_request);
      }, true));
      el.replaceChildren(el_container);
    },
    push_history_entry(he) {
      update_response(he.response as database.JQResponse);
    },
    unmount() {
      for (const unmount of unmounts) {
        unmount();
      }
    },
  };
}
