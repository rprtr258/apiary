import path from "path";
import {ElectronOptions} from "vite-plugin-electron";

// Node-only packages reachable from main.ts, loaded from node_modules at
// runtime instead of being bundled (keeps main.js small and the main build
// fast). Exact specifiers on purpose:
//   - "protobufjs/google/protobuf/descriptor.json" (rolldown drops the
//     `with {type: "json"}` attribute when externalizing) stays bundled.
//   - type-only imports (openapi-types, sdk/shared/transport.js) are elided
//     before rolldown sees them and are not listed.
// protobufjs itself is not a direct dependency: it arrives transitively via
// @grpc/proto-loader, which electron-builder packages.
const MAIN_EXTERNAL = [
  "better-sqlite3",
  "@clickhouse/client",
  "@grpc/grpc-js",
  "@modelcontextprotocol/sdk/client/index.js",
  "@modelcontextprotocol/sdk/client/sse.js",
  "@modelcontextprotocol/sdk/client/stdio.js",
  "@modelcontextprotocol/sdk/client/streamableHttp.js",
  "diff",
  "jq-wasm",
  "marked",
  "mysql2/promise.js",
  "nanoid",
  "pg",
  "pg-types",
  "protobufjs",
  "protobufjs/ext/descriptor/index.js",
  "redis",
  "sanitize-html",
  "undici",
];

export function onwarn<M extends {message: string}>(warning: M, warn: (log: M) => void) {
  // zod ships prose comments mentioning @__PURE__ that Rollup misreads (harmless)
  // jq-wasm's node require()s sit behind ENVIRONMENT_IS_NODE guards (dead in renderer)
  if (
    warning.message.includes("contains an annotation that Rollup cannot interpret") ||
    warning.message.includes("has been externalized for browser compatibility")
  ) {
    return;
  }
  warn(warning);
}

// Shared by vite.config.ts (dev + renderer build) and scripts/build.mjs,
// which runs these electron sub-builds in parallel with the renderer build.
// Plain JS so node can import it without TypeScript tooling.
export const mainProcessOptions: ElectronOptions = {
  entry: "main.ts",
  vite: {
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "shared"),
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
        external: MAIN_EXTERNAL,
        output: {
          // Bundled CJS deps (@apidevtools/swagger-parser et al.) emit runtime
          // `require` calls; main.js is ESM, where `require` is undefined.
          // Provide it via createRequire so those calls work.
          banner: [
            "import {createRequire as __createRequire} from \"node:module\";",
            "const require = __createRequire(import.meta.url);",
          ].join("\n"),
        },
        onwarn,
      },
    },
  },
};

export const preloadProcessOptions: ElectronOptions = {
  entry: "preload.ts",
  onstart(args) {
    args.reload();
  },
  vite: {
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "shared"),
      },
    },
    build: {
      outDir: "dist-electron",
      rollupOptions: {
        external: ["electron/renderer"],
      },
    },
  },
};
