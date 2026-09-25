import {spawn, spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {build as electronBuild} from "vite-plugin-electron";
import {mainProcessOptions, preloadProcessOptions} from "../vite.electron-options.ts";

// The renderer build and the electron main/preload builds are independent
// (separate outDirs), so run them concurrently. Driven from vite.config.ts
// the plugin builds its sub-builds sequentially; its exported build() runs
// the same sub-builds directly. Must run under node (not bun): bun
// externalizes a different builtin set, which changes what main.js bundles.
const viteBin = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const renderer = spawn(process.execPath, [viteBin, "build"], {
  env: {...process.env, APIARY_SKIP_ELECTRON: "1"},
  stdio: "inherit",
});

const [rendererExitCode, electronError] = await Promise.all([
  new Promise(resolve => renderer.on("close", resolve)),
  (async () => {
    await electronBuild(mainProcessOptions);
    await electronBuild(preloadProcessOptions);
    // the wasm engine build needs the go toolchain; skip with a warning when
    // absent (e.g. CI without go) instead of failing the whole build
    if (spawnSync("go", ["version"]).error === undefined) {
      await new Promise((resolve, reject) => {
        const wasm = spawn("bun", ["scripts/build-wasm.ts"], {stdio: "inherit"});
        wasm.on("close", code => code === 0 ? resolve(null) : reject(new Error(`build-wasm exited ${code}`)));
      });
    } else {
      console.warn("go not found, skipping redissql.wasm build (bun run build:wasm)");
    }
  })().then(
    () => null,
    (err: unknown) => err,
  ),
]);

if (electronError !== null) {
  console.error(electronError);
}
if (rendererExitCode !== 0 || electronError !== null) {
  process.exit(1);
}
