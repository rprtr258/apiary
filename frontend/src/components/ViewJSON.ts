import {EditorState} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import {json} from "@codemirror/lang-json";
import {transform} from "../utils";
import {NInput} from "./input";
import {NTooltip} from "./dataview";
import {defaultExtensions} from "./editor";
import {m} from "../utils";

export default function(init_value: string) {
  const state = {
    value: "",
    query: ".",
    jqerror: null as  string | null,
  };

  function update(value?: string) {
    if (value) {
      state.value = value;
      editor.dispatch({
        changes: {from: 0, to: editor.state.doc.length, insert: state.value},
      });
    }
    transform(state.value, state.query) // TODO: can't transform if body is stream of jsons
      .then(v => {
        switch (v.kind) {
        case "ok":
          editor.dispatch({
            changes: {from: 0, to: editor.state.doc.length, insert: v.value},
          });
          state.jqerror = null;
          break;
        case "err":
          state.jqerror = v.value;
          break;
        }
      });
  }

  const el = m("div");
  const editor: EditorView = new EditorView({
    parent: el,
    state: EditorState.create({
      doc: state.value,
      extensions: [
        ...defaultExtensions,
        EditorState.readOnly.of(true),
        json(),
      ],
    }),
  });
  update(init_value);

  return {
    el: m("div", {style: {
      height: "100%",
      display: "grid",
      "grid-template-rows": "auto 1fr",
    }},
      // TODO: put input under editor
      NInput({
        placeholder: "JQ query",
        status: state.jqerror !== null ? "error" : "success", // TODO: update
        on: {update: (v: string) => {
          state.query = v;
          update(state.value);
        }},
      }),
      NTooltip({ // TODO: show over input
        show: state.jqerror !== null,
        placement: "bottom",
      }, state.jqerror),
      el,
    ),
    update,
    unmount() {
      editor.destroy();
    },
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
