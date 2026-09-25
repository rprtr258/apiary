import {spawn} from "node:child_process";
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
    // build-wasm.ts skips with a warning when the go toolchain is absent
    // (e.g. CI without go) instead of failing the whole build
    await new Promise((resolve, reject) => {
      const wasm = spawn("bun", ["scripts/build-wasm.ts"], {stdio: "inherit"});
      wasm.on("close", code => code === 0 ? resolve(null) : reject(new Error(`build-wasm exited ${code}`)));
    });
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
