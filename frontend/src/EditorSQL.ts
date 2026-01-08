import {EditorState} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import {PostgreSQL, sql} from "@codemirror/lang-sql";
import {defaultEditorExtensions, defaultExtensions} from "./components/editor.ts";
import {m} from "./utils.ts";

type Props = {
  class?: string,
  style?: Partial<CSSStyleDeclaration>,
  value: string,
  on: {
    update: (value: string) => void,
  },
};
export default function(props: Props) {
  const el = m("div", {class: props.class, style: props.style ?? {}});
  const editor = new EditorView({
    parent: el,
    state: EditorState.create({
      doc: props.value ?? "",
      extensions: [
        ...defaultExtensions,
        ...defaultEditorExtensions(props.on.update),
        sql({
          dialect: PostgreSQL,
        }),
      ],
    }),
  });
  void editor;

  // TODO: unmount method
    // onremove() {
    //   editor?.destroy();
    // },
  return el;
}
