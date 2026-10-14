import {describe, test, expect} from "bun:test";
import {EditorState} from "@codemirror/state";
import {json} from "@codemirror/lang-json";
import {ensureSyntaxTree} from "@codemirror/language";
import {none} from "@/option.ts";
import {promptArgAt} from "./tool.ts";

function argAt(text: string, pos: number): ReturnType<typeof promptArgAt> {
  // The initial parse of a fresh EditorState has a small wall-clock budget and
  // may be cut mid-document under load (visible under the flaky-test clock
  // drift shim). Wait out the parse to completion, as a live editor would
  // have by typing time, so the test exercises promptArgAt's logic rather
  // than parse scheduling.
  const state = EditorState.create({doc: text, extensions: [json()]});
  ensureSyntaxTree(state, text.length, 1000);
  return promptArgAt(state, pos);
}

const ARGS = `{"department": "Eng", "name": "Al"}`;

describe("promptArgAt", () => {
  test("finds the argument under the caret with its partial value", () => {
    expect(argAt(ARGS, 32).unwrap()).toEqual({
      name: "name",
      value: "A",
      args: {department: "Eng"},
      from: 31,
      to: 33,
    });
  });

  test("excludes the completed argument from the context", () => {
    expect(argAt(ARGS, 17).unwrap().args).toEqual({name: "Al"});
  });

  test("accepts the caret right before the closing quote", () => {
    expect(argAt(ARGS, 33).unwrap().value).toEqual("Al");
  });

  test.each([
    ["rejects the caret inside a property name", ARGS, 24],
    ["rejects the caret outside string values (1)", ARGS, 20],
    ["rejects the caret outside string values (2)", ARGS, 34],
    ["rejects non-string values", `{"n": 1}`, 6],
    ["rejects an unparseable property name", `{"a\\": "b"}`, 8],
  ] as [name: string, text: string, pos: number][])("%s", (_name, text, pos) =>
    expect(argAt(text, pos)).toEqual(none));
});
