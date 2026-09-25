// Runs the Go tests of internal/redissql/wasm via `bun run test:go`.
// The root package imports syscall/js, so the whole module runs under
// GOOS=js GOARCH=wasm with go's node-based wasm exec wrapper
// (GOROOT/lib/wasm/go_js_wasm_exec); a plain native `go test` fails on the
// root package ("build constraints exclude all Go files in syscall/js").
// Needs the shimmed vitess copy from build/vitess-js (go.mod replace
// directive); generated on demand when missing. Skips with a warning when
// the go toolchain is absent (e.g. CI without Go), mirroring
// scripts/build.ts.
import {spawnSync} from "node:child_process";
import {existsSync} from "node:fs";
import path from "node:path";
import {ensureVitessShim, run, wasmModuleDir} from "./redissql-wasm.ts";

function main() {
  const goCheck = spawnSync("go", ["version"], {encoding: "utf8"});
  if (goCheck.error !== undefined || goCheck.status !== 0) {
    console.warn("go toolchain not found, skipping Go tests (install go to run them)");
    return;
  }

  ensureVitessShim(false);

  const goroot = run("go", ["env", "GOROOT"]).trim();
  const wasmExecWrapper = path.join(goroot, "lib", "wasm", "go_js_wasm_exec");
  if (!existsSync(wasmExecWrapper)) {
    throw new Error(`go wasm exec wrapper not found at ${wasmExecWrapper}`);
  }
  const stdout = run("go", ["test", "-exec", wasmExecWrapper, "./..."], {
    cwd: wasmModuleDir,
    env: {...process.env, GOOS: "js", GOARCH: "wasm"},
  });
  process.stdout.write(stdout);
  console.log("Go tests passed");
}

try {
  main();
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
