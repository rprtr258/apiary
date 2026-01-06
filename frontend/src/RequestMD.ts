import {EditorState} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import {markdown} from "@codemirror/lang-markdown";
import {database} from "../wailsjs/go/models.ts";
import {NEmpty} from "./components/dataview.ts";
import {defaultEditorExtensions, defaultExtensions} from "./components/editor.ts";
import {get_request} from "./store.ts";
import {api, HistoryEntry} from "./api.ts";
import {m, Signal} from "./utils.ts";

type Request = {kind: database.Kind.MD} & database.MDRequest;

type Props = {
  value: string | null,
  on: {
    update: (value: string) => void,
  },
  class?: string,
  style?: Partial<CSSStyleDeclaration>,
};
function EditorMD(props: Props) {
  const el = m("div", {
    class: props.class,
    style: props.style ?? {},
  });

  const editor = new EditorView({
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
  show_request: Signal<boolean>,
  on: {
    update: (patch: Partial<Request>) => Promise<void>,
    send: () => Promise<void>,
  },
): {
  loaded(r: get_request): void,
  push_history_entry(he: HistoryEntry): void, // show last history entry
} {
  el.append(NEmpty({
    description: "Loading request...",
    class: "h100",
    style: {justifyContent: "center"},
  }));

  const el_response = NEmpty({
    description: "Send request or choose one from history.",
    class: "h100",
    style: {justifyContent: "center"},
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
            overflowY: "scroll",
            height: "100vh",
          },
          innerHTML: response.data,
        }));
      }
    }).catch(alert);
  };

  return {
    loaded: (r: get_request) => {
      const request = r.request as Request;
      id = r.request.id;
      update_response();

      const el_editor_md = EditorMD({
        value: request.data,
        on: {update: (data: string) => on.update({data})},
        class: "h100",
        style: {
          overflowY: "scroll",
        },
      });

      const updateLayout = () => {
        if (show_request.value) {
          el.replaceChildren(m("div", {
            class: "h100",
            style: {
              display: "grid",
              gridTemplateColumns: "50% 50%",
              gridColumnGap: ".5em",
            },
          },
            el_editor_md,
            el_response,
          ));
        } else {
          el.replaceChildren(m("div", {
            class: "h100",
            style: {
              display: "grid",
              gridTemplateColumns: "1fr",
              gridTemplateRows: "1fr",
            },
          },
            // Markdownerror !== null ?  m("div", {style: {position: "fixed", color: "red", bottom: "3em"}}, Markdownerror) :
            el_response,
          ));
        }
      };

      show_request.sub(() => updateLayout());
    },
    push_history_entry(_he) {
      update_response();
    },
    // unmount() { // TODO: uncomment and use
    //   el_view_response_body.unmount();
    // },
  };
}