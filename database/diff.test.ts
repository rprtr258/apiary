import {describe, test, expect} from "bun:test";
import {sendDIFF} from "./diff.ts";

describe("sendDIFF", () => {
  test("identical objects have no differences", () => {
    const result = sendDIFF({left: '{"a": 1}', right: '{"a": 1}'});
    expect(result.diff).toBe("No differences");
    expect(result.stats).toContain("0");
  });

  test("detects added keys", () => {
    const result = sendDIFF({left: '{"a": 1}', right: '{"a": 1, "b": 2}'});
    expect(result.diff).toContain("added");
    expect(result.diff).toContain("b");
  });

  test("detects removed keys", () => {
    const result = sendDIFF({left: '{"a": 1, "b": 2}', right: '{"a": 1}'});
    expect(result.diff).toContain("removed");
    expect(result.diff).toContain("b");
  });

  test("detects value changes", () => {
    const result = sendDIFF({left: '{"a": 1}', right: '{"a": 2}'});
    expect(result.diff).toContain("a");
    expect(result.diff).toContain("1");
    expect(result.diff).toContain("2");
  });

  test("handles nested objects", () => {
    const result = sendDIFF({left: '{"a": {"b": 1}}', right: '{"a": {"b": 2}}'});
    expect(result.diff).toContain("a.b");
  });

  test("handles arrays", () => {
    const result = sendDIFF({left: "[1, 2, 3]", right: "[1, 4, 3]"});
    expect(result.diff).toContain("[1]");
  });

  test("handles plain text (not JSON)", () => {
    const result = sendDIFF({left: "hello", right: "world"});
    expect(result.leftType).toBe("text");
    expect(result.rightType).toBe("text");
  });

  test("returns stats string", () => {
    const result = sendDIFF({left: '{"a": 1}', right: '{"b": 2}'});
    expect(result.stats).toContain("additions");
    expect(result.stats).toContain("removals");
    expect(result.stats).toContain("changes");
  });
});
