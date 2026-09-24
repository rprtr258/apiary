import {diffLines} from "diff";
import type {DIFFRequest, DIFFResponse} from "@/types.ts";
import {type JSONValue} from "@/types.ts";

export function detectType(s: string): "json" | "text" {
  try { JSON.parse(s); return "json"; }
  catch { return "text"; }
}

export function sendDIFF(request: DIFFRequest): DIFFResponse {
  const leftType = detectType(request.left);
  const rightType = detectType(request.right);

  const stats = {added: 0, removed: 0, changed: 0};
  const diffs: string[] = (() => {
    if (leftType === "text" || rightType === "text") {
      const changes = diffLines(request.left, request.right);
      return changes.flatMap(change => {
        // TODO: changed ?
        // TODO: handle empty lines correctly
        if (change.added) {
          stats.added += change.count;
          return [...change.value.split("\n").filter(s => s !== "").map(s => "+ " + s)];
        } else if (change.removed) {
          stats.removed += change.count;
          return [...change.value.split("\n").filter(s => s !== "").map(s => "- " + s)];
        } else {
          return [...change.value.split("\n").filter(s => s !== "")];
        }
      });
    } else {
      const left: JSONValue = JSON.parse(request.left) as JSONValue;
      const right: JSONValue = JSON.parse(request.right) as JSONValue;
      return [...diffValues(left, right, "", 0, stats)];
    }
  })();

  const statsStr = [
    `${stats.added} additions`,
    `${stats.removed} removals`,
    `${stats.changed} changes`,
  ].join(", ");

  return {
    diff: (stats.added > 0 || stats.removed > 0 || stats.changed > 0) ? diffs.join("\n") : "No differences",
    stats: statsStr,
    leftType,
    rightType,
  };
}

function* diffValues(
  left: JSONValue,
  right: JSONValue,
  path: string,
  indent: number,
  stats: {added: number, removed: number, changed: number},
): Generator<string> {
  const indentt = "  ".repeat(indent);
  if (left === right) {
    yield indentt + `"${path}": ${JSON.stringify(left)},`;
    return;
  }

  if (typeof left !== typeof right ||
      Array.isArray(left) !== Array.isArray(right) ||
      left === null || right === null) {
    yield indentt + `~ "${path}": ${JSON.stringify(left)} → ${JSON.stringify(right)},`;
    stats.changed++;
    return;
  }

  if (typeof left === "object" && typeof right === "object") {
    if (Array.isArray(left) && Array.isArray(right)) {
      const maxLen = Math.max(left.length, right.length);
      yield indentt + path + ": [";
      for (let i = 0; i < maxLen; i++) {
        if (i >= left.length) {
          yield indentt + `  + ${i}: ${JSON.stringify(right[i])},`;
          stats.added++;
        } else if (i >= right.length) {
          yield indentt + `  - ${i}: ${JSON.stringify(left[i])},`;
          stats.removed++;
        } else {
          yield* diffValues(left[i], right[i], `${i}`, indent+1, stats);
        }
      }
      yield indentt + "],";
    } else {
      const leftObj = left as Record<string, JSONValue>;
      const rightObj = right as Record<string, JSONValue>;
      const allKeys = new Set([
        ...Object.keys(left),
        ...Object.keys(right),
      ]);
      yield indentt + "{";
      for (const key of allKeys) {
        const keyPath = path !== "" ? `${path}.${key}` : key;
        if (!(key in leftObj)) {
          yield indentt + `+ "${keyPath}": ${JSON.stringify(rightObj[key])},`;
          stats.added++;
        } else if (!(key in rightObj)) {
          yield indentt + `- "${keyPath}": ${JSON.stringify(leftObj[key])},`;
          stats.removed++;
        } else {
          yield* diffValues(leftObj[key], rightObj[key], keyPath, indent+1, stats);
        }
      }
      yield indentt + "}";
    }
    return;
  }

  // Primitive mismatch
  yield indentt + `~ "${path}": ${JSON.stringify(left)} → ${JSON.stringify(right)},`;
  stats.changed++;
}
