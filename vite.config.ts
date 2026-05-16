import {defineConfig, type Plugin} from "vite";
import electron, {ElectronOptions} from "vite-plugin-electron";

export default defineConfig({
  base: "./",
  plugins: [
    (electron as unknown as (options: ElectronOptions | ElectronOptions[]) => Plugin[])([ // TODO: fix/remove
      {
        entry: "main.ts",
        vite: {
          assetsInclude: ["**/*.md"],
          define: {
            __dirname: "import.meta.dirname",
            __filename: "import.meta.filename",
          },
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
        onstart(args: { reload: () => void }) {
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
