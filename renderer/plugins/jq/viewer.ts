import * as t from "@/types.ts";
import NButton from "../../components/button.ts";
import {NInput, NInputGroup, setInputStatus} from "../../components/input.ts";
import {NEmpty} from "../../components/dataview.ts";
import ViewJSON from "../../components/ViewJSON.ts";
import EditorJSON from "../../components/EditorJSON.ts";
import {NSplit} from "../../components/layout.ts";
import {m, setDisplay, signal, Signal} from "../../lib/utils.ts";
import {css, setClass} from "../../lib/styles.ts";

// Active autosend toggle: accent border marks the mode; the quiet base look
// means query changes only persist and Send performs manually.
const autosendActive = css("border-color: var(--accent); background: var(--sel);");

type Request = {kind: t.Kind.JQ} & t.JQRequest;

type ViewState =
  | {kind: "empty"}
  | {kind: "response", response: t.JQResponse}
  | {kind: "error", message: string};

export default function(
  el: HTMLElement,
  show_request: Signal<boolean>,
  on: {
    update: (patch: Partial<Request>) => Promise<void>,
    send: () => Promise<void>,
  },
): {
  loaded(r: t.Request): void,
  push_history_entry(he: t.HistoryEntry): void,
  performError(message: string): void,
  unmount(): void,
} {
  el.append(NEmpty({description: "Loading request..."}));

  let autosend = false;
  const el_send = NButton({
    primary: true,
    on: {click: on.send},
    disabled: true,
  }, "Send");
  const el_autosend = NButton({
    on: {click: () => {
      autosend = !autosend;
      renderAutosend();
      update_request({autosend});
    }},
  }, "autosend");
  function renderAutosend(): void {
    setClass(el_autosend.el, autosend, autosendActive);
  }
  const el_query_input = NInput({
    placeholder: "JQ query",
    value: "",
    on: {update: (query: string) => update_request({query}, autosend)},
  });
  function update_request(patch: Partial<t.JQRequest>, resend = false): void {
    el_send.disabled = true;
    on.update(patch).then(() => {
      el_send.disabled = false;
      if (resend)
        on.send();
    });
  }

  const el_empty_response = NEmpty({description: "Send request to see the response."});
  const el_response = m("div", {class: "h100"}, el_empty_response);
  const el_view_response_body = ViewJSON("");
  const unmounts: (() => void)[] = [() => el_view_response_body.unmount()];
  const view = signal<ViewState>({kind: "empty"});
  unmounts.push(view.sub(function*() {
    while (true) {
      const v = yield;
      setInputStatus(el_query_input, v.kind === "error" ? "error" : "success");
      switch (v.kind) {
      case "empty":
        el_response.replaceChildren(el_empty_response);
        break;
      case "response":
        el_response.replaceChildren(el_view_response_body.el);
        el_view_response_body.update(v.response.response.join("\n"));
        break;
      case "error":
        el_response.replaceChildren(m("div", {class: "h100", style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "8px",
          color: "var(--err)",
          whiteSpace: "pre-wrap",
          overflow: "auto",
        }}, v.message));
        break;
      }
    }
  }()));

  const el_input_group = NInputGroup({style: {
    display: "grid",
    gridTemplateColumns: "1fr auto auto",
    columnGap: "4px",
  }}, el_query_input, el_send.el, el_autosend.el);

  return {
    loaded: (r: t.Request) => {
      const request = r as Request;
      autosend = request.autosend ?? false;
      renderAutosend();
      el_query_input.value = request.query;

      const {el: el_editor_json, destroy} = EditorJSON({
        class: "h100",
        value: request.json,
        on: {update: (json: string) => update_request({json})},
      });
      unmounts.push(destroy);

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
      view.value = {kind: "response", response: he.response as t.JQResponse};
    },
    performError(message) {
      view.value = {kind: "error", message};
    },
    unmount() {
      for (const unmount of unmounts) {
        unmount();
      }
    },
  };
}
