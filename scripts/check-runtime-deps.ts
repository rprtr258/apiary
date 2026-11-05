// CI gate: every bare package import reachable from the runtime entry points
// (ENTRIES) must be declared in package.json "dependencies". devDependencies are
// for the dev toolchain only (eslint config, typings, tests). Static walk over
// literal import specifiers — the only kind this repo uses (no computed dynamic
// imports); node:/bun: builtins are skipped, dynamic import() counts too.
import {builtinModules} from "node:module";
import {dirname, extname, relative} from "node:path";
import pkgJson from "../package.json";

const ENTRIES = ["./main.ts"]; // runtime entry points; extend when a new one is added

type PkgJson = {
  dependencies?: Record<string, string>,
  devDependencies?: Record<string, string>,
};
const pkg: PkgJson = pkgJson;
const deps = new Set(Object.keys(pkg.dependencies ?? {}));
const devDeps = new Set(Object.keys(pkg.devDependencies ?? {}));
const builtins = new Set([...builtinModules, "bun"]);
// electron is a devDependency by design: electron-builder supplies the runtime
// binary, and declaring it in "dependencies" would bundle Electron into the app
const ignored = new Set(["electron"]);

const transpiler = new Bun.Transpiler({loader: "ts"});

function pkgName(spec: string): string {
  return spec.startsWith("@") ?
    spec.split("/").slice(0, 2).join("/") :
    spec.split("/")[0];
}

// Bun's resolver reads tsconfig "paths", so the "@/*" alias resolves here
// without manual mapping; Vite raw-import suffixes select the same file and
// are stripped first.
function resolveRel(fromDir: string, spec: string): string {
  return Bun.resolveSync(spec.split("?")[0], fromDir);
}

const bare = new Map<string, string>(); // package name -> first runtime importer
const visited = new Set<string>();
async function walk(abs: string): Promise<void> {
  if (visited.has(abs))
    return;
  visited.add(abs);
  // scanImports uses the ts loader; non-TS targets (e.g. package.json imported
  // with {type: "json"}) fail to parse and carry no imports to walk into anyway.
  if (extname(abs) !== ".ts")
    return;
  for (const {path: spec} of transpiler.scanImports(await Bun.file(abs).text())) {
    if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("@/")) {
      await walk(resolveRel(dirname(abs), spec));
    } else if (!spec.startsWith("node:") && !builtins.has(spec)) {
      const name = pkgName(spec);
      if (!bare.has(name))
        bare.set(name, abs);
    }
  }
}

for (const entry of ENTRIES)
  await walk(resolveRel(process.cwd(), entry));

const problems = [...bare.entries()].filter(([name]) => !deps.has(name) && !ignored.has(name));
if (problems.length > 0) {
  const p = problems
    .map(([name, from]) => `${name}: imported at runtime by ${relative(process.cwd(), from)} but ${devDeps.has(name) ? `declared as devDependency (move to "dependencies")` : `not declared in package.json`}`)
    .sort()
    .map(p => `  - ${p}`)
    .join("\n");
  console.error(`runtime dependency check failed:\n${p}`);
  process.exit(1);
}
