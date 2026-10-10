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
      // Main process points db.json at the per-user app data dir unless overridden —
      // send it to this test's temp dir where the seed writes db.json.
      APIARY_DB_PATH: path.join(dir, "db.json"),
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
    // Wait for the app to mount, not just body: App.ts mounts asynchronously
    // (store.fetch().then(preApp)) and attaches the global keydown listener in
    // the same synchronous step that appends the app DOM — an app element being
    // present guarantees keyboard handlers are live. Without this, keys
    // dispatched right after launch race the mount and get dropped (flaky
    // under xvfb/CI where startup timing differs).
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
