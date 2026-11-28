// Runtime import-graph cycle check for CI. knip's "cycles" rule is a no-op
// on this repo (verified: an injected runtime cycle passes its check), so
// this script is the enforcer of the acyclic-module-graph standard.
//
// Edges are import statements with at least one runtime specifier: explicit
// `import type` (and `export type ... from`) lines are erased by the
// transpiler and do not count. Bare specifiers (node_modules, node:, bun:)
// and assets (?raw, .json) are not project modules. The graph is walked from
// the runtime entry points, so test-only files are out of scope.

import {readdir, readFile} from "node:fs/promises";
import {join, dirname, resolve} from "node:path";

const repo = import.meta.dir + "/..";

const entries = [
  "main.ts",
  "preload.ts",
  "global.ts",
  "renderer/renderer.ts",
  "main/database/mock_mcp_server.ts",
];

const root = resolve(repo);
const files = await readdir(join(root, "scripts"));
for (const f of files) {
  if (f.endsWith(".ts")) {
    entries.push(`scripts/${f}`);
  }
}

// Import lines that carry a runtime edge. `import type` and `export type .. from`
// are type-only; everything else (default, namespace, named) counts. Mixed
// `import {A, type B}` counts because A is runtime; the codebase convention is
// to split type-only imports into their own `import type` statement.
const edgeRe = /(?:^|\n)((?:import|export)[^\n;]*?from\s*["']([^"']+)["'])/g;

function isTypeOnly(statement: string): boolean {
  return /^import\s+type\b/.test(statement) || /^export\s+type\b/.test(statement);
}

function resolveSpecifier(fromFile: string, spec: string): string | undefined {
  if (spec.startsWith("@/")) {
    return join(root, "shared", spec.slice(2));
  }
  if (spec.startsWith(".")) {
    const base = resolve(dirname(join(root, fromFile)), spec);
    if (!base.startsWith(root)) {
      return undefined;
    }
    return base;
  }
  // Bare specifier: package or node/bun builtin - outside the graph.
  return undefined;
}

function edgeTarget(fromFile: string, specifier: string): string | undefined {
  const path = resolveSpecifier(fromFile, specifier);
  if (path === undefined || !path.endsWith(".ts")) {
    return undefined;
  }
  return path.slice(root.length + 1);
}

type Graph = Map<string, string[]>;

const graph: Graph = new Map();
const stack: string[] = [...entries];
while (stack.length > 0) {
  const file = stack.pop()!;
  if (graph.has(file)) {
    continue;
  }
  graph.set(file, []);
  let text: string;
  try {
    text = await readFile(join(root, file), "utf8");
  } catch {
    continue;
  }
  // Strip block comments first: import-looking text inside them is not code.
  const code = text.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of code.matchAll(edgeRe)) {
    const [statement, specifier] = [match[1], match[2]];
    if (isTypeOnly(statement) || specifier.endsWith("?raw") || specifier.endsWith(".json")) {
      continue;
    }
    const target = edgeTarget(file, specifier);
    if (target !== undefined) {
      graph.get(file)!.push(target);
      stack.push(target);
    }
  }
}

// DFS cycle detection reporting each distinct cycle once (normalized by its
// smallest member so a cycle reached from several entries prints one line).
const inStack = new Set<string>();
const path: string[] = [];
const seenCycles = new Set<string>();
const cycles: string[][] = [];

function visit(file: string): void {
  if (inStack.has(file)) {
    const start = path.indexOf(file);
    const cycle = path.slice(start);
    const key = [...cycle].sort().join("|");
    if (!seenCycles.has(key)) {
      seenCycles.add(key);
      cycles.push(cycle);
    }
    return;
  }
  if (graph.get(file) === undefined) {
    return;
  }
  inStack.add(file);
  path.push(file);
  for (const next of graph.get(file)!) {
    visit(next);
  }
  inStack.delete(file);
  path.pop();
}

for (const file of graph.keys()) {
  visit(file);
}

if (cycles.length > 0) {
  console.error(`Found ${cycles.length} runtime import cycle(s):`);
  for (const cycle of cycles) {
    console.error(`  ${cycle.join(" > ")} > ${cycle[0]}`);
  }
  console.error("Break the cycle: split the shared part out, or make type-only edges explicit with `import type`.");
  process.exit(1);
}
console.log(`No runtime import cycles across ${graph.size} modules reachable from the entry points.`);
