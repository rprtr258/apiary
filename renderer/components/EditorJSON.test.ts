import {describe, test, expect} from "bun:test";
import {EditorState} from "@codemirror/state";
import {json} from "@codemirror/lang-json";
import {completionSources} from "./EditorJSON.ts";

describe("completionSources", () => {
  test("registers each source so CM resolves it as a source, not a completion item", () => {
    const source = async () => null;
    const state = EditorState.create({
      doc: "{}",
      extensions: [json(), completionSources([source])],
    });
    expect(state.languageDataAt("autocomplete", 0)).toContain(source);
  });
});
