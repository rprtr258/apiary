import {mkdtemp} from "fs/promises";
import {tmpdir} from "os";
import path from "path";
import {_electron as electron} from "playwright";
import type {ElectronApplication} from "playwright";

// Electron runs the built app from dist/ (renderer) + dist-electron/ (main + preload).
// `bun run test:e2e` rebuilds first, so these artifacts are always fresh here.
const main = path.join(process.cwd(), "dist-electron", "main.js");

export async function launchApp(seed?: (dir: string) => Promise<void>): Promise<{app: ElectronApplication, dir: string}> {
  // Fresh cwd per test: db.json lives in the process working directory.
  const dir = await mkdtemp(path.join(tmpdir(), "apiary-e2e-"));
  if (seed !== undefined) {
    await seed(dir);
  }
  const app = await electron.launch({
    args: [main, "--no-sandbox"],
    cwd: dir,
    env: {
      ...process.env,
      // Silence the CSP warning so console-message assertions stay clean.
      ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
    },
  });
  return {app, dir};
}
