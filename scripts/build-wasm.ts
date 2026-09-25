// Builds the redissql SQL-over-redis engine as a js/wasm module for the
// electron main process:
//
//	1. copies dolthub/vitess from the module cache into build/vitess-js and
//	   shims syscall.SIGHUP -> syscall.Signal(1) (see wasm/go.mod rationale),
//	2. compiles internal/redissql/wasm with GOOS=js GOARCH=wasm,
//	3. copies Go's wasm_exec.js glue next to it.
//
// Outputs (packaged via electron-builder's dist-electron/**/* glob):
//
//	dist-electron/redissql.wasm
//	dist-electron/redissql-wasm-exec.js
//
// Requires the go toolchain (skipped with a warning when absent, e.g. in CI
// without Go; the runtime loader fails with a clear message instead).
import {spawnSync} from "node:child_process";
import {chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const wasmModuleDir = path.join(root, "internal", "redissql", "wasm");
const buildDir = path.join(root, "build");
const vitessShimDir = path.join(buildDir, "vitess-js");
const outDir = path.join(root, "dist-electron");

function run(command: string, args: string[], options: {cwd?: string, env?: NodeJS.ProcessEnv} = {}): string {
  const result = spawnSync(command, args, {encoding: "utf8", ...options});
  if (result.status !== 0 || result.error !== undefined) {
    throw new Error(`${command} ${args.join(" ")} failed:\n${result.stderr}${result.error ?? ""}`);
  }
  return result.stdout;
}

// Module cache files are read-only; make the shim copy writable (0o666/
// 0o777 clears the read-only bit on Windows and grants u+w elsewhere).
function chmodWritable(dir: string): void {
  chmodSync(dir, 0o777);
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      chmodWritable(entryPath);
    } else {
      chmodSync(entryPath, 0o666);
    }
  }
}

function main() {
  const goCheck = spawnSync("go", ["version"], {encoding: "utf8"});
  if (goCheck.error !== undefined || goCheck.status !== 0) {
    console.warn("go toolchain not found, skipping redissql.wasm build (install go or run: bun run build:wasm)");
    return;
  }

  // 1. shimmed vitess copy for the wasm build (read-only module cache -> writable build dir)
  // go mod download first: on a cold cache `go list -m -f {{.Dir}}` reports
  // an empty dir instead of fetching the module (graph pruning)
  run("go", ["mod", "download", "github.com/dolthub/vitess"], {cwd: root});
  const vitessDir = run("go", ["list", "-m", "-f", "{{.Dir}}", "github.com/dolthub/vitess"], {cwd: root}).trim();
  if (vitessDir === "") {
    throw new Error("could not resolve dolthub/vitess module dir; is it in the root go.mod graph?");
  }
  rmSync(vitessShimDir, {recursive: true, force: true});
  cpSync(vitessDir, vitessShimDir, {recursive: true, verbatimSymlinks: false});
  chmodWritable(vitessShimDir);
  const authServerPath = path.join(vitessShimDir, "go", "mysql", "auth_server_static.go");
  const authServer = readFileSync(authServerPath, "utf8");
  writeFileSync(authServerPath, authServer
    .replaceAll("signal.Notify(a.sigChan, syscall.SIGHUP)", "signal.Notify(a.sigChan, syscall.Signal(1))")
    .replaceAll("a.sigChan <- syscall.SIGHUP", "a.sigChan <- syscall.Signal(1)"));

  // 2. wasm build (tidy keeps go.sum in sync with go.mod)
  run("go", ["mod", "tidy"], {cwd: wasmModuleDir, env: {...process.env, GOFLAGS: "-mod=mod"}});
  mkdirSync(outDir, {recursive: true});
  run("go", ["build", "-ldflags", "-s -w", "-o", path.join(outDir, "redissql.wasm"), "."], {
    cwd: wasmModuleDir,
    env: {...process.env, GOOS: "js", GOARCH: "wasm"},
  });

  // 3. wasm_exec glue from the same toolchain that built the module
  const goroot = run("go", ["env", "GOROOT"]).trim();
  const wasmExec = path.join(goroot, "lib", "wasm", "wasm_exec.js");
  if (existsSync(wasmExec) === false) {
    throw new Error(`wasm_exec.js not found at ${wasmExec}`);
  }
  copyFileSync(wasmExec, path.join(outDir, "redissql-wasm-exec.js"));

  console.log("redissql.wasm built");
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
