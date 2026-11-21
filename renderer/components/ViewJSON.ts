import {EditorState} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import {json} from "@codemirror/lang-json";
import {m, transform} from "../lib/utils.ts";
import {NInput} from "./input.ts";
import {NTooltip} from "./dataview.ts";
import {defaultExtensions} from "./editor.ts";

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
    transform(state.value, state.query)
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
      NInput({
        placeholder: "JQ query",
        status: state.jqerror !== undefined ? "error" : "success",
        on: {update: (v: string) => {
          state.query = v;
          update(state.value);
        }},
      }),
      NTooltip({
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
