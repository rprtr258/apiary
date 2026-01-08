import {EditorState} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import {json} from "@codemirror/lang-json";
import {transform} from "../utils.ts";
import {NInput} from "./input.ts";
import {NTooltip} from "./dataview.ts";
import {defaultExtensions} from "./editor.ts";
import {m} from "../utils.ts";

export default function(init_value: string) {
  const state = {
    value: "",
    query: ".",
    jqerror: undefined as  string | undefined,
  };

  function update(value?: string) {
    if (value !== undefined) {
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
          state.jqerror = undefined;
          break;
        case "err":
          state.jqerror = v.value;
          break;
        }
      });
  }

  const el = m("div", {style: {minHeight: "0", flexGrow: "1"}});
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
    el: m("div", {class: "h100", style: {
      width: "100%",
      display: "flex",
      flexDirection: "column",
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
        show: state.jqerror !== undefined,
        placement: "bottom",
      }, state.jqerror ?? ""),
      el,
    ),
    update,
    unmount() {
      editor.destroy();
    },
  };
}
