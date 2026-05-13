import {defineConfig} from "vite";
import electron from "vite-plugin-electron";

export default defineConfig({
  base: "./",
  plugins: [
    electron([
      {
        entry: "main.ts",
        vite: {
          build: {
            outDir: "dist-electron",
            rollupOptions: {
              external: ["electron"],
            },
          },
        },
      },
      {
        entry: "preload.ts",
        onstart(args) {
          args.reload();
        },
        vite: {
          build: {
            outDir: "dist-electron",
            rollupOptions: {
              external: ["electron"],
            },
          },
        },
      },
    ]),
  ],
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});