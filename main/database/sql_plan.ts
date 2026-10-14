import {SQLPlan, SQLPlanNode} from "@/types.ts";

export function node(title: string): SQLPlanNode {
  return {title, kind: "other", details: [], metrics: {}, children: []};
}

// A parsed line: an operator with its tree depth, or a detail line belonging
// to the most recently seen operator.
export type PlanLine =
  | {operator: true, depth: number, n: SQLPlanNode}
  | {operator: false, text: string}
;

export function buildTree(lines: PlanLine[]): SQLPlan | undefined {
  let root: SQLPlanNode | undefined = undefined;
  const stack: SQLPlanNode[] = [];
  let base: number | undefined = undefined;
  for (const line of lines) {
    if (!line.operator) {
      if (stack.length > 0)
        stack[stack.length - 1].details.push(line.text);
      continue;
    }
    if (base === undefined)
      base = line.depth; // first operator is the root
    const depth = line.depth - base;
    while (stack.length > depth)
      stack.pop();
    if (stack.length === 0) {
      if (root !== undefined)
        return undefined; // several roots: not a tree
      root = line.n;
    } else {
      stack[stack.length - 1].children.push(line.n);
    }
    stack.push(line.n);
  }
  return root === undefined ? undefined : {root};
}

// ---- shared text helpers ----------------------------------------------------

// Splits "Seq Scan on t  (cost=..) (actual ..)" into the title and the metric
// parenthesized groups (in order). Groups not recognized as metrics stay part
// of the title (e.g. mysql's "Index lookup on t using i (c = 5)").
export function splitMetricGroups(text: string): {title: string, groups: string[]} {
  const groups: string[] = [];
  let rest = text.trim();
  for (;;) {
    const match = /\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)$/.exec(rest);
    if (match === null)
      break;
    const group = match[1];
    if (!/^(?:cost=|actual\b|never executed$|rows=)/.test(group))
      break;
    groups.unshift(group);
    rest = rest.slice(0, match.index).trim();
  }
  return {title: rest, groups};
}

export function metricsFromGroups(groups: string[]): Record<string, string> {
  const metrics: Record<string, string> = {};
  for (const group of groups) {
    if (group === "never executed") {
      metrics["actual"] = "never executed";
      continue;
    }
    const actual = group.startsWith("actual ");
    const body = actual ? group.slice("actual ".length) : group;
    for (const pair of body.split(/\s+(?=[a-z_]+=)/)) {
      const eq = pair.indexOf("=");
      if (eq <= 0)
        continue;
      const key = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      const name = actual
        ? (key === "time" ? "actual time" : key)
        : (key === "rows" ? "rows (est)" : key);
      metrics[name] = value;
    }
  }
  return metrics;
}
