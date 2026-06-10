import {EditorState} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import {json} from "@codemirror/lang-json";
import {jsonSchema} from "codemirror-json-schema";
import type {JSONSchema7} from "json-schema";
import {defaultEditorExtensions, defaultExtensions} from "./editor.ts";
import {m} from "../utils.ts";

type Props = {
  value: string | null,
  schema?: JSONSchema7,
  on: {
    update: (value: string) => void,
  },
  class?: string,
  style?: Partial<CSSStyleDeclaration>,
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
      // Add JSON Schema extension if schema is provided
      ...(props.schema !== undefined ? [jsonSchema(props.schema)] : []),
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
