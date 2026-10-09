import {EditorState, type Extension} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import {json, jsonLanguage} from "@codemirror/lang-json";
import type {CompletionSource} from "@codemirror/autocomplete";
import {jsonSchema} from "codemirror-json-schema";
import type {JSONSchema7} from "json-schema";
import {defaultEditorExtensions, defaultExtensions} from "./editor.ts";
import {m} from "../lib/utils.ts";

type Props = {
  value: string | null,
  schema?: JSONSchema7,
  completions?: CompletionSource[],
  on: {
    update: (value: string) => void,
  },
  class?: string,
  style?: Partial<CSSStyleDeclaration>,
};

// Register completion sources as "autocomplete" language data so they merge
// with the JSON Schema ones. Each entry must be a single source: CM treats
// an array value as a list of completion items, not a list of sources.
export function completionSources(sources: CompletionSource[]): Extension {
  return sources.map(source => jsonLanguage.data.of({autocomplete: source}));
}

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
      // Completion sources provided by the caller (merged with schema ones)
      ...(props.completions === undefined ? [] : [completionSources(props.completions)]),
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
