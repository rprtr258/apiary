import {EditorState} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import {json} from "@codemirror/lang-json";
import {m, signal, transform} from "../lib/utils.ts";
import {NInput, setInputStatus} from "./input.ts";
import {NTooltip} from "./dataview.ts";
import {defaultExtensions} from "./editor.ts";

export default function(init_value: string) {
  const state = {
    value: "",
    query: ".",
  };
  const jqerror = signal<string | undefined>(undefined);

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
          jqerror.value = undefined;
          break;
        case "err":
          jqerror.value = v.value;
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

  const el_input = NInput({
    placeholder: "JQ query",
    on: {update: (v: string) => {
      state.query = v;
      update(state.value);
    }},
  });
  const el_tooltip = NTooltip({style: {
    position: "absolute",
    bottom: "calc(100% + 4px)",
    left: "0",
    maxWidth: "100%",
    width: "max-content",
    background: "var(--bg2)",
    color: "var(--err)",
    border: "1px solid var(--err)",
    padding: "4px 8px",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
    zIndex: "10",
  }}, "");
  const el_input_area = m("div", {style: {position: "relative", flexShrink: "0", display: "grid", gridTemplateColumns: "1fr"}}, el_input, el_tooltip);

  const unsub_jqerror = jqerror.sub(function*() {
    while (true) {
      const err = yield;
      setInputStatus(el_input, err !== undefined ? "error" : "success");
      el_tooltip.replaceChildren(err ?? "");
      // setDisplay would restore the "none" NTooltip initialized with as the
      // "original" display, so the tooltip is driven directly.
      el_tooltip.style.display = err !== undefined ? "block" : "none";
    }
  }());

  update(init_value);

  return {
    el: m("div", {class: "h100", style: {
      width: "100%",
      display: "flex",
      flexDirection: "column",
    }},
      el,
      el_input_area,
    ),
    update,
    unmount() {
      unsub_jqerror();
      editor.destroy();
    },
  };
}
