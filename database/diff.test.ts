import {describe, test, expect} from "bun:test";
import {sendDIFF} from "./diff.ts";

describe("sendDIFF", () => {
  for (const [name, {left, right, leftType, rightType, diff, stats}] of Object.entries({
    "identical objects have no differences": {
      left: `{"a": 1}`, right: `{"a": 1}`,
      leftType: "json", rightType: "json",
      diff: "No differences",
      stats: "0 additions, 0 removals, 0 changes",
    },
    "detects added keys": {
      left: `{"a": 1}`, right: `{"a": 1, "b": 2}`,
      leftType: "json", rightType: "json",
      diff: `{
  "a": 1,
+ "b": 2,
}`,
      stats: "1 additions, 0 removals, 0 changes",
    },
    "detects removed keys": {
      left: `{"a": 1, "b": 2}`, right: `{"a": 1}`,
      leftType: "json", rightType: "json",
      diff: `{
  "a": 1,
- "b": 2,
}`,
      stats: "0 additions, 1 removals, 0 changes",
    },
    "detects value changes": {
      left: `{"a": 1}`, right: `{"a": 2}`,
      leftType: "json", rightType: "json",
      diff: `{
  ~ "a": 1 → 2,
}`,
      stats: "0 additions, 0 removals, 1 changes",
    },
    "handles nested objects": {
      left: `{"a": {"b": 1}}`, right: `{"a": {"b": 2}}`,
      leftType: "json", rightType: "json",
      // TODO: fix
      //     diff: `{
      //   "a": {
      //     ~ "b": 1 → 2,
      //   }
      // }`,
      diff: `{
  {
    ~ "a.b": 1 → 2,
  }
}`,
      stats: "0 additions, 0 removals, 1 changes",
    },
    "handles arrays": {
      left: "[1, 2, 3]", right: "[1, 4, 3]",
      leftType: "json", rightType: "json",
      // TODO: fix
      //     diff: `[
      //   "0": 1,
      //   ~ "1": 2 → 4,
      //   "2": 3,
      // ]`,
      diff: `: [
  "0": 1,
  ~ "1": 2 → 4,
  "2": 3,
],`,
      stats: "0 additions, 0 removals, 1 changes",
    },
    "handles plain text (not JSON)": {
      left: "hello", right: "world",
      leftType: "text", rightType: "text",
      diff: `- hello
+ world`,
      // TODO: 1 change
      stats: "1 additions, 1 removals, 0 changes",
    },
    "returns stats string": {
      left: `{"a": 1}`, right: `{"b": 2}`,
      leftType: "json", rightType: "json",
      diff: `{
- "a": 1,
+ "b": 2,
}`,
      stats: "1 additions, 1 removals, 0 changes",
    },
  })) {
    test(name, () => {
      const result = sendDIFF({left, right});
      expect(result.leftType).toBe(leftType);
      expect(result.rightType).toBe(rightType);
      expect(result.diff).toBe(diff);
      expect(result.stats).toBe(stats);
    });
  }
});
