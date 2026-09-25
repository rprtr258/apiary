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
import {copyFileSync, existsSync, mkdirSync} from "node:fs";
import path from "node:path";
import {ensureVitessShim, run, root, wasmModuleDir} from "./redissql-wasm.ts";

const outDir = path.join(root, "dist-electron");

function main() {
  const goCheck = spawnSync("go", ["version"], {encoding: "utf8"});
  if (goCheck.error !== undefined || goCheck.status !== 0) {
    console.warn("go toolchain not found, skipping redissql.wasm build (install go or run: bun run build:wasm)");
    return;
  }

  // 1. shimmed vitess copy for the wasm build (read-only module cache -> writable build dir)
  ensureVitessShim(true);

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
  if (!existsSync(wasmExec)) {
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
