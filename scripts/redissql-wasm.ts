// Shared helpers for the redissql wasm module (internal/redissql/wasm):
// module paths, a command runner, and generation of the shimmed
// dolthub/vitess copy under build/vitess-js that the module's go.mod
// replace directive points at (see internal/redissql/wasm/go.mod for the
// rationale). Used by scripts/build-wasm.ts (wasm build) and
// scripts/test-go.ts (Go tests).
import {spawnSync} from "node:child_process";
import {chmodSync, cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import path from "node:path";
import {tmpdir} from "node:os";

export const root = path.resolve(import.meta.dirname, "..");
export const wasmModuleDir = path.join(root, "internal", "redissql", "wasm");
export const vitessShimDir = path.join(root, "build", "vitess-js");

export function run(command: string, args: string[], options: {cwd?: string, env?: NodeJS.ProcessEnv} = {}): string {
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

// Generates the shimmed vitess copy: resolves the dolthub/vitess version
// from the wasm module's go.mod, copies it from the module cache into
// build/vitess-js and rewrites syscall.SIGHUP -> syscall.Signal(1)
// (identical value; the auth-server code using it is dead in a wasm build
// with no wire server). Reuses an existing copy unless force: build-wasm
// regenerates to pick up version bumps, the go tests reuse it to stay fast.
export function ensureVitessShim(force: boolean): void {
  if (!force && existsSync(vitessShimDir)) {
    return;
  }

  // resolved in a throwaway module because the wasm module replaces vitess with
  // build/vitess-js, which does not exist until after this copy. go mod edit
  // -json is a pure file parse, safe to run against the wasm module directly.
  const modJson = JSON.parse(run("go", ["mod", "edit", "-json"], {cwd: wasmModuleDir})) as {Require?: Array<{Path: string, Version: string}>};
  const vitessVersion = modJson.Require?.find((r) => r.Path === "github.com/dolthub/vitess")?.Version;
  if (vitessVersion === undefined) {
    throw new Error("dolthub/vitess not in the require list of internal/redissql/wasm/go.mod");
  }
  const resolveDir = mkdtempSync(path.join(tmpdir(), "vitess-resolve-"));
  writeFileSync(path.join(resolveDir, "go.mod"), "module vitessresolve\n\ngo 1.25\n");
  const resolved = run("go", ["mod", "download", "-json", `github.com/dolthub/vitess@${vitessVersion}`], {cwd: resolveDir});
  rmSync(resolveDir, {recursive: true, force: true});
  const vitessDir = (JSON.parse(resolved) as {Dir?: string}).Dir ?? "";
  if (vitessDir === "") {
    throw new Error(`could not resolve dolthub/vitess@${vitessVersion} module dir`);
  }
  rmSync(vitessShimDir, {recursive: true, force: true});
  cpSync(vitessDir, vitessShimDir, {recursive: true, verbatimSymlinks: false});
  chmodWritable(vitessShimDir);
  const authServerPath = path.join(vitessShimDir, "go", "mysql", "auth_server_static.go");
  const authServer = readFileSync(authServerPath, "utf8");
  writeFileSync(authServerPath, authServer
    .replaceAll("signal.Notify(a.sigChan, syscall.SIGHUP)", "signal.Notify(a.sigChan, syscall.Signal(1))")
    .replaceAll("a.sigChan <- syscall.SIGHUP", "a.sigChan <- syscall.Signal(1)"));
}
