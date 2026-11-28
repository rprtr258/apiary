// Runtime import-graph cycle check for CI. knip's "cycles" rule is a no-op
// on this repo (verified: an injected runtime cycle passes its check), so
// this script is the enforcer of the acyclic-module-graph standard.
//
// Edges are what bun would actually load at runtime: each file is
// transpiled (erasing `import type` / `export type` statements, comments and
// type positions), and an import keeps its edge only if one of its bindings
// survives in the transpiled body - bun elides imports used purely in type
// positions even when they are not written with `import type`. Bare
// specifiers (node_modules, node:, bun:) and assets (?raw, .json) are not
// project modules. The graph is walked from the runtime entry points, so
// test-only files are out of scope.

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

// Import statements surviving transpilation, normalized onto one line by the
// transpiler. `export ... from` re-exports are always runtime edges;
// `import ... from` ones are checked against body usage below, since bun
// elides imports whose bindings never appear in value positions.
const edgeRe = /(?:^|\n)((?:import|export)[^\n;]*?from\s*["']([^"']+)["'])/g;
const edgeStripRe = /(?:^|\n)\s*(?:import|export)\b[^\n;]*?from\s*["'][^"']+["'];?/g;

// Local names an import statement binds: default, namespace and named
// (aliases resolved to the local name).
function localNames(statement: string): string[] {
  const names: string[] = [];
  const clause = statement.replace(/\s*from\s*["'][^"']+["']\s*;?\s*$/, "");
  const braceStart = clause.indexOf("{");
  const head = (braceStart === -1 ? clause : clause.slice(0, braceStart)).replace(/^\s*import\s*/, "").replace(/,\s*$/, "").trim();
  for (const part of head.split(",")) {
    const p = part.trim();
    if (p === "") {
      continue;
    }
    const ns = p.match(/^\*\s*as\s+([A-Za-z_$][\w$]*)$/);
    names.push(ns !== null ? ns[1] : p);
  }
  if (braceStart !== -1) {
    const braceEnd = clause.indexOf("}", braceStart);
    for (const item of clause.slice(braceStart + 1, braceEnd).split(",")) {
      const cleaned = item.trim().replace(/^type\s+/, "");
      if (cleaned === "") {
        continue;
      }
      const asIdx = cleaned.lastIndexOf(" as ");
      names.push(asIdx === -1 ? cleaned : cleaned.slice(asIdx + 4).trim());
    }
  }
  return names;
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

const transpiler = new Bun.Transpiler({loader: "ts"});
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
  // Transpiled output has no comments and no type positions, so an import
  // statement whose bindings appear nowhere else carries no runtime edge.
  const js = transpiler.transformSync(text);
  const body = js.replace(edgeStripRe, "\n");
  for (const match of js.matchAll(edgeRe)) {
    const [statement, specifier] = [match[1], match[2]];
    if (specifier.endsWith("?raw") || specifier.endsWith(".json")) {
      continue;
    }
    if (/^\s*import\b/.test(statement)) {
      const names = localNames(statement);
      if (names.length > 0 && !names.some((name) => new RegExp(`\\b${name}\\b`).test(body))) {
        continue;
      }
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
  console.error("Break the cycle: split the shared part out.");
  process.exit(1);
}
console.log(`No runtime import cycles across ${graph.size} modules reachable from the entry points.`);
