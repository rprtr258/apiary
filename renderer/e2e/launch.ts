import {mkdtemp, rm, writeFile} from "fs/promises";
import {tmpdir} from "os";
import path from "path";
import {_electron as electron} from "playwright";
import type {ElectronApplication, Page} from "playwright";
import {test as base} from "@playwright/test";

// Electron runs the built app from dist/ (renderer) + dist-electron/ (main + preload).
// `bun run test:e2e` rebuilds first, so these artifacts are always fresh here.
const main = path.join(process.cwd(), "dist-electron", "main.js");

// One Electron app per worker instead of per test: launching dominates the
// suite's runtime. Each test still starts pristine because seedDB rewrites
// db.json (the app re-reads it on every IPC call, nothing is cached) and the
// page fixture clears the profile's localStorage and reloads before the body.
export type Fixtures = {
  page: Page,
  // Per-test db.json contents; override to start a test with pre-seeded data.
  seedDB: (dir: string) => Promise<void>,
};

export type WorkerFixtures = {
  dir: string,
  app: ElectronApplication,
};

export const test = base.extend<Fixtures, WorkerFixtures>({
  dir: [async ({}, use) => {
    // Fresh cwd per worker: db.json lives in the process working directory.
    const dir = await mkdtemp(path.join(tmpdir(), "apiary-e2e-"));
    await use(dir);
    await rm(dir, {recursive: true, force: true}).catch(() => {});
  }, {scope: "worker"}],
  app: [async ({dir}, use) => {
    const app = await electron.launch({
      args: [main, "--no-sandbox"],
      cwd: dir,
      env: {
        ...process.env,
        // Main process points db.json at the per-user app data dir unless overridden —
        // send it to this worker's temp dir where seedDB writes db.json.
        APIARY_DB_PATH: path.join(dir, "db.json"),
        // Silence the CSP warning so console-message assertions stay clean.
        ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      },
    });
    await use(app);
    await app.close();
  }, {scope: "worker"}],
  seedDB: async ({dir}, use) => {
    // Same shape load() produces for a missing db.json.
    await use(async () => {
      await writeFile(path.join(dir, "db.json"), JSON.stringify({}));
    });
  },
  page: async ({app, dir, seedDB}, use) => {
    const page = await app.firstWindow();
    // Wait for the app to mount, not just body: App.ts mounts asynchronously
    // (store.fetch().then(preApp)) and attaches the global keydown listener in
    // the same synchronous step that appends the app DOM — an app element being
    // present guarantees keyboard handlers are live. Without this, keys
    // dispatched right after launch race the mount and get dropped (flaky
    // under xvfb/CI where startup timing differs). The same race applies after
    // the per-test reload below.
    await page.waitForSelector("select");
    // Reset to a pristine per-test state: fresh db.json plus clean localStorage
    // (expanded keys, layout tabs persist in the shared Electron profile).
    await seedDB(dir);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector("select");
    await use(page);
  },
});

// Keyboard shortcuts (App.ts handleKeyDown) are dispatched as synthetic
// KeyboardEvents on `document` — the app's contract is that document-level
// handler, and this triggers it deterministically regardless of window focus
// state (relevant under xvfb/CI, where there is no window manager to grant
// focus).
export async function pressWith(page: Page, modifiers: string[], key: string): Promise<void> {
  const ctrl = modifiers.includes("Control");
  const shift = modifiers.includes("Shift");
  const alt = modifiers.includes("Alt");
  const meta = modifiers.includes("Meta");
  const base = key.startsWith("Key") ? key.slice(3).toLowerCase() : key;
  const keyName = shift && base.length === 1 ? base.toUpperCase() : base;
  await page.evaluate(({key, code, ctrl, shift, alt, meta}) => {
    document.dispatchEvent(new KeyboardEvent("keydown", {key, code, ctrlKey: ctrl, shiftKey: shift, altKey: alt, metaKey: meta, bubbles: true, cancelable: true}));
  }, {key: keyName, code: key, ctrl, shift, alt, meta});
}
