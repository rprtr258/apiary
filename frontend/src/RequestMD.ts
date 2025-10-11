import m, {VnodeDOM} from "mithril";
import {ChangeSpec, EditorState} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import {markdown} from "@codemirror/lang-markdown";
import {database} from "../wailsjs/go/models";
import {NEmpty} from "./components/dataview";
import {defaultEditorExtensions, defaultExtensions} from "./components/editor";
import {use_request} from "./store";
import {api} from "./api";

type Request = {kind: database.Kind.MD} & database.MarkdownRequest;

type Props = {
  value: string | null,
  on: {
    update: (value: string) => void,
  },
  class?: string,
  style?: any,
};

function EditorMD() {
  let editor: EditorView | null = null;
  return {
    oncreate(vnode: VnodeDOM<Props, any>) {
      const props = vnode.attrs;

      if (editor) {
        if (props.value !== editor.state.doc.toString()) {
          editor.dispatch({
            changes: {
              from: 0,
              to: editor.state.doc.length,
              insert: props.value,
            } as ChangeSpec,
          });
        }

        return;
      }

      const state = EditorState.create({
        doc: props.value ?? "",
        extensions: [
          ...defaultExtensions,
          ...defaultEditorExtensions(props.on.update),
          markdown(),
        ],
      });

      editor = new EditorView({
        parent: vnode.dom,
        state: state,
      });
    },
    onremove() {
      editor?.destroy();
    },
    view(vnode: VnodeDOM<Props, any>) {
      const props = vnode.attrs;
      return m("div", {
        class: props.class,
        style: props.style ?? {},
      });
    },
  };
}

export default function(
  id: string,
  show_request: () => boolean,
): m.ComponentTypes<any, any> {
  return {
    view() {
      // {request, response, is_loading, update_request, send}
      const r = use_request<Request, database.MarkdownResponse>(id);

      let Markdownerror: string | null = null; // TODO: use
      const responseText = r.response?.data ?? "";

      function update_request(data: string): void {
        r.update_request({data});
        api.requestPerform(id)
          .then(res => {
            if (res.kind === "err") {
              Markdownerror = `Could not render document: ${res.value}`;
            } else {
              Markdownerror = null;
              r.response = res.value.response as database.MarkdownResponse;
            }
          }).
          then(() => m.redraw());
      }
      if (r.request === null) {
        return m(NEmpty, {
          description: "Loading request...",
          class: "h100",
          style: {"justify-content": "center"},
        });
      }

      return m("div", {
        class: "h100",
        style: {
          display: "grid",
          "grid-template-columns": "1fr" + (show_request() ? " 1fr" : ""),
          "grid-column-gap": ".5em",
        },
      }, [
        show_request() && m(EditorMD, {
          value: r.request.data,
          on: {update: (data: string) => update_request(data)},
          class: "h100",
          style: {
            "overflow-y": "scroll",
          },
        }),
        Markdownerror !== null ?
        m("div", {style: {position: "fixed", color: "red", bottom: "3em"}}, Markdownerror) :
        r.response === null ?
        m(NEmpty, {
          description: "Send request or choose one from history.",
          class: "h100",
          style: {"justify-content": "center"},
        }) :
        m("div", {
          class: "h100 markdown-body",
          style: {
            "overflow-y": "scroll",
          },
        }, m.trust(responseText)),
      ]);
    },
  };
}