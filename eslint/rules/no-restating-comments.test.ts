import {describe, expect, test} from "bun:test";
import {Linter} from "eslint";
import {noRestatingComments} from "./no-restating-comments.ts";

const linter = new Linter();
const lint = (code: string): string[] =>
  linter.verify(code, {
    plugins: {local: {rules: {"no-restating-comments": noRestatingComments}}},
    rules: {"local/no-restating-comments": "error", "no-console": "error"},
  }).map(message => message.message);

describe("local/no-restating-comments", () => {
  test("flags narration comments whose content words all appear in the code below", () => {
    expect(lint([
      "// Create the shaders",
      "createShader(gl, type);",
    ].join("\n"))).toHaveLength(1);
  });

  test("flags comments above a blank-line-separated code line via camelCase and plural token splitting", () => {
    expect(lint([
      "// Initialize the parser options",
      "const myParserOptions = {};",
    ].join("\n"))).toHaveLength(1);
  });

  test("passes comments carrying real information (why, constraints, caveats)", () => {
    expect(lint([
      "// createShader with type=GEOMETRY throws on macOS drivers, so fall back",
      "const shader = createShader(gl, VERTEX);",
      "",
      "// Widgets above the fold stay in the DOM; only off-screen ones unmount",
      "unmount(widget);",
      "",
      "// The other branch handles retries",
      "handleBranch(branch);",
    ].join("\n"))).toEqual([]);
  });

  test("passes tooling directives, dividers, trailing comments and block continuations", () => {
    expect(lint([
      "// eslint-disable-next-line no-console",
      "console.log(x);",
      "noop(); // Set above",
      "//",
      "// ==== section ==== //",
      "noop();",
      "",
      "// The plan: first do A, then B. This line is long enough on its own to be",
      "// a real explanation, so the block is never flagged",
      "noop();",
    ].join("\n"))).toEqual([]);
  });
});
