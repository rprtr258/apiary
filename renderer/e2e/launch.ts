import {mkdtemp, rm} from "fs/promises";
import {tmpdir} from "os";
import path from "path";
import {_electron as electron} from "playwright";
import type {ElectronApplication, Page} from "playwright";
import {test as base} from "@playwright/test";

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

// Shared app/page fixtures for every spec that launches a plain app. Specs
// with a different setup (e.g. seeded db.json) extend `base` themselves.
export type Fixtures = {
  app: ElectronApplication,
  page: Page,
};

export const test = base.extend<Fixtures>({
  app: async ({}, use) => {
    const {app, dir} = await launchApp();
    await use(app);
    await app.close();
    await rm(dir, {recursive: true, force: true}).catch(() => {});
  },
  page: async ({app}, use) => {
    const page = await app.firstWindow();
    await page.waitForSelector("body"); // wait for the app to render
    await use(page);
  },
});
