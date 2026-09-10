import path from "path";
import {defineConfig, type Plugin} from "vite";
import electron, {ElectronOptions} from "vite-plugin-electron";
import type {LoggingFunction, RollupLog} from "rollup";

const onwarn = (warning: RollupLog, warn: LoggingFunction) => {
  // zod ships prose comments mentioning @__PURE__ that Rollup misreads (harmless)
  // jq-wasm's node require()s sit behind ENVIRONMENT_IS_NODE guards (dead in renderer)
  if (
    warning.message.includes("contains an annotation that Rollup cannot interpret") ||
    warning.message.includes("has been externalized for browser compatibility")
  ) {
    return;
  }
  warn(warning);
};

export default defineConfig({
  base: "./",
  plugins: [
    (electron as unknown as (options: ElectronOptions | ElectronOptions[]) => Plugin[])([ // TODO: fix/remove
      {
        entry: "main.ts",
        vite: {
          resolve: {
            alias: {
              "@": path.resolve(__dirname, "shared"),
            },
          },
          assetsInclude: ["**/*.md", "**/*.proto"],
          define: {
            __dirname: "import.meta.dirname",
            __filename: "import.meta.filename",
          },
          build: {
            outDir: "dist-electron",
            rollupOptions: {
              external: ["better-sqlite3"],
              onwarn,
            },
          },
        },
      },
      {
        entry: "preload.ts",
        onstart(args: { reload: () => void }) {
          args.reload();
        },
        vite: {
          resolve: {
            alias: {
              "@": path.resolve(__dirname, "shared"),
            },
          },
          build: {
            outDir: "dist-electron",
            rollupOptions: {
              external: ["electron/renderer"],
            },
          },
        },
      },
    ]),
  ],
  build: {
    outDir: "dist",
    sourcemap: true,
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