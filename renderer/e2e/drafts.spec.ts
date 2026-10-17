import {_electron as electron, expect} from "@playwright/test";
import type {Locator, Page} from "@playwright/test";
import {readFile, writeFile} from "fs/promises";
import http from "node:http";
import {DatabaseSync} from "node:sqlite";
import path from "path";
import type {AddressInfo} from "node:net";
import {pressWith, test as base, type Fixtures} from "./launch.ts";
import v2 from "../../main/db.v2.ts";

const MAIN = path.join(process.cwd(), "dist-electron", "main.js");

// db.json writes are debounced in main/db.ts (only flushed on quit), so an
// assertion on file contents right after a UI action races the pending write:
// always expect.poll until the flush lands instead of reading immediately.
const readDB = async (dir: string) =>
  JSON.parse(await readFile(path.join(dir, "db.json"), "utf8")) as v2;

// SQLite fixture can't use better-sqlite3: node_modules was rebuilt for the
// Electron ABI, so it only loads inside the app. node:sqlite ships with the
// node binary that runs Playwright.
function createSqliteDatabase(file: string): void {
  const db = new DatabaseSync(file);
  db.close();
}

const draftTab = (page: Page, title: string): Locator =>
  page.locator(".lm_tab").filter({hasText: title});

// Command palette -> "New draft" -> kind picker; returns the opened draft tab
async function newDraftViaPalette(page: Page, kind: string): Promise<Locator> {
  await pressWith(page, ["Control", "Shift"], "KeyP");
  const paletteInput = page.locator("input[placeholder='Type a command or search...']");
  await expect(paletteInput).toBeVisible();
  await paletteInput.fill("New draft");
  await page.keyboard.press("Enter");
  const kindInput = page.locator("input[placeholder='Enter kind of new draft']");
  await expect(kindInput).toBeVisible();
  await kindInput.fill(kind);
  await page.keyboard.press("Enter");
  const tab = draftTab(page, "draft 1");
  await expect(tab).toBeVisible();
  return tab;
}

// Primary close path: the tab's close button deletes a draft record
async function closeDraft(tab: Locator): Promise<void> {
  await tab.getByText("×", {exact: true}).click();
  await tab.waitFor({state: "detached"});
}

const test = base.extend<Pick<Fixtures, "seedDB"> & {url: string}>({
  // SQLite + sql-source seed: the source-bound draft test needs it; harmless
  // for the HTTP-only tests. SQLite can't use better-sqlite3: node_modules was
  // rebuilt for the Electron ABI, so it only loads inside the app.
  seedDB: async ({dir}, use) => {
    await use(async () => {
      const sqlitePath = path.join(dir, "source.db");
      createSqliteDatabase(sqlitePath);
      await writeFile(path.join(dir, "db.json"), JSON.stringify({
        $version: 1,
        request: [{id: "e2e-sql-source-1", kind: "sql-source", path: "mydb"}],
        "sql-source": {"e2e-sql-source-1": {database: "sqlite", dsn: sqlitePath, readOnly: false}},
      }));
    });
  },
  // Local target for performed requests: the request is performed by the main
  // process, so Playwright routing cannot intercept it, and an external host
  // would make these tests flaky.
  url: async ({}, use) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, {"content-type": "application/json"});
      res.end(JSON.stringify({ok: true}));
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    await use(`http://127.0.0.1:${(server.address() as AddressInfo).port}/`);
    await new Promise<void>(resolve => server.close(() => resolve()));
  },
});

test("new draft via command palette: gray untitled tab, absent from the sidebar", async ({page}) => {
  const tab = await newDraftViaPalette(page, "http");

  // The tab title is the only "draft 1" on the page: drafts never render in
  // the sidebar (rows would look like "HTTPdraft 1")
  await expect(page.getByText("HTTPdraft 1")).toHaveCount(0);

  await closeDraft(tab);
});

test("source-bound draft: context menu preselects dsn and database", async ({page}) => {
  const sourceRow = page.getByText("SQL*mydb");
  await expect(sourceRow).toBeVisible();
  await sourceRow.click({button: "right"});
  await page.getByText("New draft query").click();

  const tab = draftTab(page, "draft 1");
  await expect(tab).toBeVisible();
  await expect(page.locator("input[placeholder='DSN']")).toHaveValue("mydb");

  await closeDraft(tab);
});

test("draft performs, persists history, and Ctrl+W deletes the record", async ({page, url, dir}) => {
  const tab = await newDraftViaPalette(page, "http");
  await page.locator("input[placeholder='URL']").fill(url);
  await tab.click();

  await pressWith(page, ["Control"], "Enter");
  await page.waitForSelector("text=200", {timeout: 10*1000});

  // The response is persisted on the draft record: real record, real history.
  // The url enters the db with the draft record, so once it is on disk the
  // drafts section must carry the single entry too.
  await expect.poll(async () => JSON.stringify(await readDB(dir)), {timeout: 5*1000}).toContain(url);
  expect((await readDB(dir)).drafts).toHaveLength(1);

  await pressWith(page, ["Control"], "KeyW");
  await tab.waitFor({state: "detached"});

  await expect.poll(async () => (await readDB(dir)).drafts, {timeout: 5*1000}).toHaveLength(0);
  expect((await readDB(dir)).request?.some(r => r.path === "draft 1")).toBe(false);
});

test("saving a draft via Ctrl+S renames it into a stored request", async ({page, url, dir}) => {
  const tab = await newDraftViaPalette(page, "http");
  await page.locator("input[placeholder='URL']").fill(url);
  await tab.click();

  await pressWith(page, ["Control"], "KeyS");
  // The rename modal's input: the only input inside the "Rename request" modal
  const nameInput = page.locator("xpath=//h3[text()='Rename request']/following-sibling::div/input");
  await expect(nameInput).toHaveValue("draft 1");
  await nameInput.fill("saved-from-draft");
  await page.getByRole("button", {name: "Rename", exact: true}).click();

  const savedTab = draftTab(page, "saved-from-draft");
  await expect(savedTab).toBeVisible();
  await expect(page.getByText("HTTPsaved-from-draft")).toBeVisible();

  await expect.poll(async () => (await readDB(dir)).drafts, {timeout: 5*1000}).toHaveLength(0);
  expect((await readDB(dir)).request?.some(r => r.path === "saved-from-draft")).toBe(true);
});

test("draft survives app relaunch", async ({url, dir}) => {
  const launchApp = async () => {
    const app = await electron.launch({
      args: [MAIN, "--no-sandbox", `--user-data-dir=${path.join(dir, "profile")}`],
      cwd: dir,
      env: {
        ...process.env,
        APIARY_DB_PATH: path.join(dir, "db.json"),
        ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      },
    });
    const win = await app.firstWindow();
    await win.waitForSelector("select");
    return {app, win};
  };

  await writeFile(path.join(dir, "db.json"), JSON.stringify({$version: 1, request: [], drafts: []}));
  const first = await launchApp();
  try {
    const tab = await newDraftViaPalette(first.win, "http");
    await first.win.locator("input[placeholder='URL']").fill(url);
    await tab.click();
    await pressWith(first.win, ["Control"], "Enter");
    await first.win.waitForSelector("text=200", {timeout: 10*1000});
  } finally {
    // App quit must not fire tab-close deletions: the draft record survives
    await first.app.close();
  }

  const second = await launchApp();
  try {
    const tab = draftTab(second.win, "draft 1");
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(second.win.locator("input[placeholder='URL']")).toHaveValue(url);
    expect((await readDB(dir)).drafts).toHaveLength(1);
  } finally {
    await second.app.close();
  }
});

test("lost layout config: startup sweep deletes drafts whose tabs did not restore", async ({page, url, dir}) => {
  const tab = await newDraftViaPalette(page, "http");
  await page.locator("input[placeholder='URL']").fill(url);
  await tab.click();
  await pressWith(page, ["Control"], "Enter");
  await page.waitForSelector("text=200", {timeout: 10*1000});
  await expect.poll(async () => (await readDB(dir)).drafts, {timeout: 5*1000}).toHaveLength(1);

  // Losing the persisted layout config (clearing the profile's localStorage
  // and reloading the renderer is equivalent to a fresh startup without it)
  // leaves the open draft tab unrestored, so the startup sweep deletes the
  // orphaned records — the tab is the only referent (ARCHITECTURE.md).
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForSelector("select");
  await expect(draftTab(page, "draft 1")).toHaveCount(0);
  await expect.poll(async () => (await readDB(dir)).drafts, {timeout: 10*1000}).toHaveLength(0);
  expect((await readDB(dir)).request?.some(r => r.path === "draft 1")).toBe(false);
});
