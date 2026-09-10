import {mkdtemp, rm} from "fs/promises";
import {tmpdir} from "os";
import path from "path";
import {_electron as electron} from "playwright";
import type {ElectronApplication} from "playwright";
import {test as base, expect} from "@playwright/test";
import type {Page} from "@playwright/test";

// Electron runs the built app from dist/ (renderer) + dist-electron/ (main + preload).
// `bun run test:e2e` rebuilds first, so these artifacts are always fresh here.
const main = path.join(process.cwd(), "dist-electron", "main.js");

async function launchApp(): Promise<{app: ElectronApplication, dir: string}> {
  // Fresh cwd per test: db.json lives in the process working directory.
  const dir = await mkdtemp(path.join(tmpdir(), "apiary-e2e-"));
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

type Fixtures = {
  app: ElectronApplication,
  page: Page,
};

const test = base.extend<Fixtures>({
  app: async ({}, use) => {
    const {app, dir} = await launchApp();
    await use(app);
    await app.close();
    await rm(dir, {recursive: true, force: true}).catch(() => {});
  },
  page: async ({app}, use) => {
    const page = await app.firstWindow();
    await use(page);
  },
});

// The Electron window isn't focused under Playwright, so a single
// `page.keyboard.press("Control+N")` is dropped and never reaches the renderer
// (handleKeyDown in App.ts never fires). Bring the window to front and send the
// modifiers+key as separate events so the keydown is delivered.
async function openNewRequestPalette(page: Page): Promise<void> {
  await page.bringToFront();
  // Let the focused window settle before sending keys, else they get dropped.
  await page.waitForTimeout(500);
  await page.keyboard.down("Control");
  await page.keyboard.press("KeyN");
  await page.keyboard.up("Control");
}

function useErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", msg => {
    if (["error", "warning", "info"].includes(msg.type())) {
      const text = msg.text();
      if (text === "Autofocus processing was blocked because a document already has a focused element.")
        return; // benign Chromium notice when the create-modal input autofocuses while the sidebar select is focused
      errors.push(text);
    }
  });
  return errors;
}

test.beforeEach(async ({page}) => {
  // Electron already opens the app window; just wait for it to render.
  await page.waitForSelector("body");
});

test("creates HTTP request via sidebar dropdown", async ({page}) => {
  const errors = useErrors(page);

  // Find the select element for new request kind in sidebar
  const kindSelect = page.locator("select").first(); // Assuming it's the first select in sidebar

  // Select HTTP from dropdown
  await kindSelect.selectOption({label: "HTTP"});

  // Wait for create modal to appear
  await page.waitForSelector("input");

  // Enter request name
  const input = page.locator("input").first();
  await input.fill("test-request-dropdown");

  // Click Create button
  const createButton = page.getByRole("button", {name: "Create", exact: true});
  await createButton.click();

  // Wait for request to appear in sidebar
  await page.waitForSelector("text=test-request-dropdown");

  // Click on request to open it
  await page.click("text=test-request-dropdown");

  // Fill in request details (URL)
  const urlInput = page.locator("input[placeholder='URL']");
  await urlInput.fill("https://httpbin.org/get");

  // Click send button
  const sendButton = page.getByRole("button", {name: "Send", disabled: false});
  await sendButton.click();

  // Wait for response
  await page.waitForSelector("text=200", {timeout: 10000});

  // Verify response appears
  const responseText = await page.textContent("body");
  expect(responseText).toContain("200");

  expect(errors).toEqual([]); // fails if any console.error occurred
});

test("creates HTTP request via command palette", async ({page}) => {
  const errors = useErrors(page);

  // Open command palette with Ctrl+N
  await openNewRequestPalette(page);

  expect(errors).toEqual([]); // fails if any console.error occurred

  // Wait for kind selection dialog
  await page.waitForSelector("text=HTTP");

  // Select HTTP
  await page.click("text=HTTP");

  // Wait for create dialog
  await page.waitForSelector("input");

  // Enter request name
  const input = page.locator("input").first();
  await input.fill("test-request");
  await page.keyboard.press("Enter");

  // Wait for request to appear in sidebar
  await page.waitForSelector("text=test-request");

  // Click on request to open it
  await page.click("text=test-request");

  // Fill in request details (URL)
  const urlInput = page.locator("input[placeholder='URL']");
  await urlInput.fill("https://httpbin.org/get");

  // Click send button
  const sendButton = page.getByRole("button", {name: "Send", disabled: false});
  await sendButton.click();

  // Wait for response
  await page.waitForSelector("text=200", {timeout: 10000});

  // Verify response appears
  const responseText = await page.textContent("body");
  expect(responseText).toContain("200");
});

test("handles invalid URL error", async ({page}) => {
  const errors = useErrors(page);

  // Create and open a request
  await openNewRequestPalette(page);
  await page.waitForSelector("text=HTTP");
  await page.click("text=HTTP");
  await page.waitForSelector("input");
  const input = page.locator("input").first();
  await input.fill("error-request");
  await page.keyboard.press("Enter");
  await page.waitForSelector("text=error-request");
  await page.click("text=error-request");

  // Enter invalid URL
  const urlInput = page.locator("input[placeholder='URL']");
  await urlInput.fill("://invalid-url");

  // Click send
  const sendButton = page.getByRole("button", {name: "Send"});
  await sendButton.click();

  // Wait for error notification
  await page.waitForSelector("text=Could not perform request");

  expect(errors).toEqual([]); // fails if any console.error occurred
});

test("tab closes when request is deleted via sidebar menu", async ({page}) => {
  const errors = useErrors(page);

  // Find the select element for new request kind in sidebar
  const kindSelect = page.locator("select").first();

  // Select HTTP from dropdown
  await kindSelect.selectOption({label: "HTTP"});

  // Wait for create modal to appear
  await page.waitForSelector("input");

  // Enter request name
  const input = page.locator("input").first();
  await input.fill("test-delete-request");

  // Click Create button
  const createButton = page.getByRole("button", {name: "Create", exact: true});
  await createButton.click();

  // Wait for request to appear in sidebar
  await page.waitForSelector("text=test-delete-request");

  // Click on request to open it
  await page.click("text=test-delete-request");

  // Wait for tab to open (check for tab title or content)
  await page.waitForSelector(".lm_header .lm_tab", {timeout: 5000}); // GoldenLayout tab

  // Find request row by name
  const treeRow = page.getByText("HTTPtest-delete-request");
  await treeRow.click({button: "right"});

  // Wait for dropdown menu to appear
  await page.waitForSelector("text=Delete");

  // Click Delete
  await page.click("text=Delete");

  // Wait for tab to close - check that tab with title "test-delete-request" is detached
  await page.locator(".lm_tab").filter({hasText: "test-delete-request"}).waitFor({state: "detached"});

  expect(errors).toEqual([]); // fails if any console.error occurred
});
