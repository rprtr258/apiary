import {ChangeSpec, EditorState} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import {markdown} from "@codemirror/lang-markdown";
import {database} from "../wailsjs/go/models";
import {NEmpty} from "./components/dataview";
import {defaultEditorExtensions, defaultExtensions} from "./components/editor";
import {get_request} from "./store";
import {api, HistoryEntry} from "./api";
import {m, Signal} from "./utils";

type Request = {kind: database.Kind.MD} & database.MDRequest;

type Props = {
  value: string | null,
  on: {
    update: (value: string) => void,
  },
  class?: string,
  style?: any,
};
function EditorMD(props: Props) {
  const el = m("div", {
    class: props.class,
    style: props.style ?? {},
  });

  let editor = new EditorView({
    parent: el,
    state: EditorState.create({
      doc: props.value ?? "",
      extensions: [
        ...defaultExtensions,
        ...defaultEditorExtensions(props.on.update),
        markdown(),
      ],
    }),
  });
  void editor;

  // if (props.value !== editor.state.doc.toString()) {
  //   editor.dispatch({
  //     changes: {
  //       from: 0,
  //       to: editor.state.doc.length,
  //       insert: props.value,
  //     } as ChangeSpec,
  //   });
  // }

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
  let Markdownerror: string | null = null; // TODO: use
  let id: string; // TODO: move?
  const update_response = () => {
    api.requestPerform(id).then(res => {
      if (res.kind === "err") {
        Markdownerror = `Could not render document: ${res.value}`;
      } else {
        Markdownerror = null;
        const response = res.value.response as database.MDResponse;
        el_response.replaceChildren(m("div", {
          class: "h100 markdown-body",
          style: {
            "overflow-y": "scroll",
            height: "100vh",
          },
          innerHTML: response.data,
        }));
      }
    });
  }

  return {
    loaded: (r: get_request) => {
      const request = r.request as Request;
      id = r.request.id;
      update_response();

      el.replaceChildren(m("div", {
        class: "h100",
        style: {
          display: "grid",
          "grid-template-columns": "1fr" + (show_request ? " 1fr" : ""),
          "grid-column-gap": ".5em",
        },
      },
        show_request && EditorMD({
          value: request.data,
          on: {update: (data: string) => on.update({data})},
          class: "h100",
          style: {
            "overflow-y": "scroll",
          },
        }) || null,
        // Markdownerror !== null ?  m("div", {style: {position: "fixed", color: "red", bottom: "3em"}}, Markdownerror) :
        el_response,
      ));
    },
    push_history_entry(he) {
      update_response();
    },
    // unmount() { // TODO: uncomment and use
    //   el_view_response_body.unmount();
    // },
  };
}