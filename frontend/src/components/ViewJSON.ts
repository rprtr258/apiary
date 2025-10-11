import m, {Vnode, VnodeDOM} from "mithril";
import {EditorState} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import {json} from "@codemirror/lang-json";
import {transform} from "../utils";
import {NInput} from "./input";
import {NTooltip} from "./dataview";
import {defaultExtensions} from "./editor";

type Props = {
  value?: string,
}
export default function() {
  let query = "";
  let jqerror : string | null = null;

  // const editorRef = useTemplateRef("editorRef");

  let editor: EditorView | null = null;

  function localTransform(value?: string) {
    const body = value ?? "";
    transform(body, query) // TODO: can't transform if body is stream of jsons
      .then(v => {
        switch (v.kind) {
        case "ok":
          editor?.dispatch({
            changes: {from: 0, to: editor.state.doc.length, insert: v.value},
          });
          jqerror = null;
          break;
        case "err":
          jqerror = v.value;
          break;
        }
      });
  }
  // watch([
  //   () => value,
  //   () => query,

  // watch(() => value, () => {
  //   query.value = "";
  //   jqerror.value = null;
  // });
  // </script>

  return {
    oncreate(vnode: VnodeDOM<Props, any>) {
      localTransform(vnode.attrs.value);
      const props = vnode.attrs;
      const state = EditorState.create({
        doc: props.value ?? "",
        extensions: [
          ...defaultExtensions,
          EditorState.readOnly.of(true),
          json(),
        ],
      });

      editor = new EditorView({
        parent: vnode.dom,
        state: state,
      });
    },
    onbeforeremove() {
      editor?.destroy();
    },
    onupdate(vnode: Vnode<Props, any>) {
      localTransform(vnode.attrs.value);
    },
    view(vnode: Vnode<Props, any>) {
      const {value} = vnode.attrs;
      return m("div", {style: {
        height: "100%",
        display: "grid",
        "grid-template-rows": "auto 1fr",
      }}, [
        // TODO: put input under editor
        m(NTooltip, {
          show: jqerror !== null,
          placement: "bottom",
          trigger: m(NInput, {
            placeholder: "JQ query",
            status: jqerror !== null ? "error" : "success",
            value: "query",
            on: {update: (v: string) => {
              query = v;
              localTransform(value);
            }},
          })},
          jqerror),
        m("div", {ref: "editorRef"}),
      ]);
    }
  };
}

// <style lang="css" scoped>
// .n-tab-pane {
//   height: 100% !important;
// }
// </style>
// <style lang="css">
// .cm-editor { height: 100% }
// .cm-scroller { overflow: auto }
// </style>
