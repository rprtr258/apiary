import * as t from "@/types.ts";
import {NInput, NButton, NInputGroup} from "../../components/input.ts";
import {NEmpty} from "../../components/dataview.ts";
import ViewJSON from "../../components/ViewJSON.ts";
import EditorJSON from "../../components/EditorJSON.ts";
import {NSplit} from "../../components/layout.ts";
import {get_request} from "../../store.ts";
import {useRequest} from "../../hooks/useRequest.ts";
import {m, setDisplay, Signal} from "../../lib/utils.ts";

type Request = {kind: t.Kind.JQ} & t.JQRequest;

export default function(
  el: HTMLElement,
  show_request: Signal<boolean>,
  on: {
    update: (patch: Partial<Request>) => Promise<void>,
    send: () => Promise<void>,
  },
): {
  loaded(r: get_request): void,
  push_history_entry(he: t.HistoryEntry): void,
  unmount(): void,
} {
  el.append(NEmpty({description: "Loading request..."}));

  const jqerror: string | undefined = undefined as string | undefined; // TODO: remove type cast, fill sometimes with error
  const el_send = NButton({ // TODO: autosend
    primary: true,
    on: {click: on.send},
    disabled: true,
  }, "Send");
  const requestHook = useRequest<t.JQRequest>({initialRequest: {
    query: "",
    json: "",
  }, on: {update: on.update}});
  const el_query_input = NInput({
    placeholder: "JQ query",
    status: jqerror !== undefined ? "error" : "success",
    value: "",
    on: {update: (query: string) => update_request({query})},
  });
  function update_request(patch: Partial<t.JQRequest>): void {
    el_send.disabled = true;
    requestHook.update(patch).finally(() => {
      el_send.disabled = false;
    }).catch(() => {
      el_query_input.value = requestHook.requestSignal.value.query;
      // TODO: json editor not re-synced (EditorJSON exposes no update API)
    });
  }

  const el_response = NEmpty({description: "Send request to see the response."});
  const el_view_response_body = ViewJSON("");
  const unmounts: (() => void)[] = [() => el_view_response_body.unmount()];
  function update_response(response: t.JQResponse | undefined): void {
    if (response === undefined)
      return;

    if (jqerror !== undefined) {
      el_response.replaceChildren(m("div", {style: {position: "fixed", color: "red", bottom: "3em"}}, jqerror));
      return;
    }

    el_response.replaceChildren(el_view_response_body.el);
    el_view_response_body.update(response.response.join("\n"));
  }

  const el_input_group = NInputGroup({style: {
    display: "grid",
    gridTemplateColumns: "11fr 1fr",
  }}, el_query_input, el_send.el);

  return {
    loaded: (r: get_request) => {
      const request = r.request as Request;
      requestHook.requestSignal.value = request;
      el_query_input.value = request.query;

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
      unmounts.push(show_request.sub(function*() {
        while (true) {
          const show_request = yield;
          split.leftVisible = show_request;
          setDisplay(el_input_group, show_request);
        }
      }()));
      el_send.disabled = false;
      el.replaceChildren(el_container);
    },
    push_history_entry(he) {
      update_response(he.response as t.JQResponse);
    },
    unmount() {
      for (const unmount of unmounts) {
        unmount();
      }
    },
  };
}
