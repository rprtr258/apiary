import path from "path";
import {defineConfig} from "vite";
import electron from "vite-plugin-electron";
import {mainProcessOptions, preloadProcessOptions, onwarn} from "./vite.electron-options.ts";

export default defineConfig({
  base: "./",
  plugins: [
    // scripts/build.mjs sets APIARY_SKIP_ELECTRON=1 to build the renderer
    // alone; the electron sub-builds then run in parallel via the plugin's
    // exported build() under node (bun externalizes a different builtin set
    // and changes what main.js bundles).
    ...(process.env.APIARY_SKIP_ELECTRON === "1" ? [] : [
      electron([
        mainProcessOptions,
        preloadProcessOptions,
      ]),
    ]),
  ],
  build: {
    outDir: "dist",
    // Sourcemaps cost ~0.8s of the renderer build; off by default. The
    // dist* tasks in package.json set APIARY_SOURCEMAP=1 to debug packaged
    // releases' stack traces; set it manually for ad-hoc builds.
    sourcemap: process.env.APIARY_SOURCEMAP === "1",
    // minify: false,
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      onwarn,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "shared"),
    },
  },
});
