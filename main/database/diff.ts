import {diffLines} from "diff";
import {DiffRequest, DiffResponse} from "@/types.ts";
import {JSONValue} from "@/types.ts";

type Stats = {
  added: number,
  removed: number,
  changed: number,
};

export const EmptyRequest: DiffRequest = {left: "", right: ""};

export function detectType(s: string): "json" | "text" {
  try { JSON.parse(s); return "json"; }
  catch { return "text"; }
}

export function send(request: DiffRequest): DiffResponse {
  const leftType = detectType(request.left);
  const rightType = detectType(request.right);

  const stats: Stats = {added: 0, removed: 0, changed: 0};
  const diffs = [...(() => {
    if (leftType === "text" || rightType === "text") {
      return diffText(
        request.left,
        request.right,
        stats,
      );
    } else {
      return diffValues(
        JSON.parse(request.left) as JSONValue,
        JSON.parse(request.right) as JSONValue,
        "", 0, stats,
      );
    }
  })()];

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

// diffLines chunk values terminate every line with "\n"; the split remainder
// after the last terminator is a splitting artifact, not a rendered blank line.
function chunkLines(value: string): string[] {
  const lines = value.split("\n");
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}

function* diffText(
  left: string,
  right: string,
  stats: Stats,
): Generator<string> {
  const changes = diffLines(left, right);
  // jsdiff emits each hunk's removals before its additions, so a removed
  // chunk directly followed by an added one is an edit.
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    const lines = chunkLines(change.value);
    if (change.added) {
      stats.added += lines.length;
      yield* lines.map(s => "+ " + s);
    } else if (change.removed) {
      const next = i + 1 < changes.length ? changes[i + 1] : undefined;
      if (next !== undefined && next.added) {
        const nextLines = chunkLines(next.value);
        // jsdiff tokenizes a missing EOF newline as a token change, so an
        // edit hunk can contain identical lines; only differing line pairs
        // count as changes, identical ones render unchanged.
        const paired = Math.min(lines.length, nextLines.length);
        for (let j = 0; j < paired; j++) {
          if (lines[j] === nextLines[j]) {
            yield lines[j];
          } else {
            yield "- " + lines[j];
            yield "+ " + nextLines[j];
            stats.changed++;
          }
        }
        for (let j = paired; j < lines.length; j++) {
          yield "- " + lines[j];
          stats.removed++;
        }
        for (let j = paired; j < nextLines.length; j++) {
          yield "+ " + nextLines[j];
          stats.added++;
        }
        i++;
      } else {
        stats.removed += lines.length;
        yield* lines.map(s => "- " + s);
      }
    } else {
      yield* lines;
    }
  }

  // jsdiff folds the EOF newline into the last line token, so a trailing-
  // newline disagreement shows up as a phantom edit of the (identical) last
  // line and cancels out of the pairing above; without this marker the texts
  // would render as "No differences". An empty side has no lines and thus no
  // EOF newline to disagree about.
  const leftNoNl = left !== "" && !left.endsWith("\n");
  const rightNoNl = right !== "" && !right.endsWith("\n");
  if (leftNoNl !== rightNoNl) {
    yield `\\ No newline at end of file (${leftNoNl ? "left" : "right"})`;
    stats.changed++;
  }
}

function* diffValues(
  left: JSONValue,
  right: JSONValue,
  path: string,
  indent: number,
  stats: Stats,
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
      yield indentt + (path === "" ? "" : `"${path}": `) + "[";
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
      yield indentt + "]";
    } else {
      const leftObj = left as Record<string, JSONValue>;
      const rightObj = right as Record<string, JSONValue>;
      const allKeys = new Set([
        ...Object.keys(left),
        ...Object.keys(right),
      ]);
      yield indentt + (path === "" ? "" : `"${path}": `) + "{";
      for (const key of allKeys) {
        if (!(key in leftObj)) {
          yield indentt + `+ "${key}": ${JSON.stringify(rightObj[key])},`;
          stats.added++;
        } else if (!(key in rightObj)) {
          yield indentt + `- "${key}": ${JSON.stringify(leftObj[key])},`;
          stats.removed++;
        } else {
          yield* diffValues(leftObj[key], rightObj[key], key, indent+1, stats);
        }
      }
      yield indentt + "}";
    }
    return;
  }

  yield indentt + `~ "${path}": ${JSON.stringify(left)} → ${JSON.stringify(right)},`;
  stats.changed++;
}
