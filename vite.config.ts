import path from "path";
import {defineConfig, type Plugin} from "vite";
import electron, {ElectronOptions} from "vite-plugin-electron";

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
          assetsInclude: ["**/*.md"],
          define: {
            __dirname: "import.meta.dirname",
            __filename: "import.meta.filename",
          },
          build: {
            outDir: "dist-electron",
            rollupOptions: {
              external: ["sqlite3"],
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
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "shared"),
    },
  },
});