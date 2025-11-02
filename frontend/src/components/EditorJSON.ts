import {EditorState} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import {json} from "@codemirror/lang-json";
import {defaultEditorExtensions, defaultExtensions} from "./editor";
import {m} from "../utils";

type Props = {
  value: string | null,
  on: {
    update: (value: string) => void,
  },
  class?: string,
  style?: any,
};
export default function(props: Props) {
  const el = m("div", {
    class: props.class,
    style: props.style ?? {},
  });

  const state = EditorState.create({
    doc: props.value ?? "",
    extensions: [
      ...defaultExtensions,
      ...defaultEditorExtensions(props.on.update),
      json(),
    ],
  });

  const editor = new EditorView({
    parent: el,
    state: state,
  });

  void editor; // TODO: close/unmount method
    // onremove() {
    //   editor?.destroy();
    // },

  return el;
}