import {diffLines} from "diff";
import type {DIFFRequest, DIFFResponse} from "../shared/types/models.ts";

type JSONValue = string | number | boolean | null | JSONValue[] | {[key: string]: JSONValue};

export function sendDIFF(request: DIFFRequest): DIFFResponse {
  let left: JSONValue;
  let right: JSONValue;
  let leftType = "json";
  let rightType = "json";
  try { left = JSON.parse(request.left) as JSONValue; }
  catch { left = request.left; leftType = "text"; }

  try { right = JSON.parse(request.right) as JSONValue; }
  catch { right = request.right; rightType = "text"; }

  const diffs: string[] = [];
  const stats = {added: 0, removed: 0, changed: 0};
  if (leftType === "text" || rightType === "text") {
    const changes = diffLines(request.left, request.right);
    for (const change of changes) {
      // TODO: changed ?
      // TODO: handle empty lines correctly
      if (change.added) {
        stats.added += change.count;
        diffs.push(...change.value.split("\n").filter(s => s !== "").map(s => "+ " + s));
      } else if (change.removed) {
        stats.removed += change.count;
        diffs.push(...change.value.split("\n").filter(s => s !== "").map(s => "- " + s));
      } else {
        diffs.push(...change.value.split("\n").filter(s => s !== ""));
      }
    }
  } else {
    diffValues(left, right, "", 0, diffs, stats);
  }

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

function diffValues(
  left: JSONValue,
  right: JSONValue,
  path: string,
  indent: number,
  diffs: string[],
  stats: {added: number, removed: number, changed: number},
): void {
  const indentt = "  ".repeat(indent);
  if (left === right) {
    diffs.push(indentt + `"${path}": ${JSON.stringify(left)},`);
    return;
  }

  if (typeof left !== typeof right ||
      Array.isArray(left) !== Array.isArray(right) ||
      left === null || right === null) {
    diffs.push(indentt + `~ "${path}": ${JSON.stringify(left)} → ${JSON.stringify(right)},`);
    stats.changed++;
    return;
  }

  if (typeof left === "object" && typeof right === "object") {
    if (Array.isArray(left) && Array.isArray(right)) {
      const maxLen = Math.max(left.length, right.length);
      diffs.push(indentt + path + ": [");
      for (let i = 0; i < maxLen; i++) {
        if (i >= left.length) {
          diffs.push(indentt + `  + ${i}: ${JSON.stringify(right[i])},`);
          stats.added++;
        } else if (i >= right.length) {
          diffs.push(indentt + `  - ${i}: ${JSON.stringify(left[i])},`);
          stats.removed++;
        } else {
          diffValues(left[i], right[i], `${i}`, indent+1, diffs, stats);
        }
      }
      diffs.push(indentt + "],");
    } else {
      const leftObj = left as Record<string, JSONValue>;
      const rightObj = right as Record<string, JSONValue>;
      const allKeys = new Set([
        ...Object.keys(left),
        ...Object.keys(right),
      ]);
      diffs.push(indentt + "{");
      for (const key of allKeys) {
        const keyPath = path !== "" ? `${path}.${key}` : key;
        if (!(key in leftObj)) {
          diffs.push(indentt + `+ "${keyPath}": ${JSON.stringify(rightObj[key])},`);
          stats.added++;
        } else if (!(key in rightObj)) {
          diffs.push(indentt + `- "${keyPath}": ${JSON.stringify(leftObj[key])},`);
          stats.removed++;
        } else {
          diffValues(leftObj[key], rightObj[key], keyPath, indent+1, diffs, stats);
        }
      }
      diffs.push(indentt + "}");
    }
    return;
  }

  // Primitive mismatch
  diffs.push(indentt + `~ "${path}": ${JSON.stringify(left)} → ${JSON.stringify(right)},`);
  stats.changed++;
}
