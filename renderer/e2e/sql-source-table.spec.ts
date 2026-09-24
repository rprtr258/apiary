import {execFileSync} from "child_process";
import {rm, writeFile} from "fs/promises";
import path from "path";
import {test as base, expect} from "@playwright/test";
import type {ElectronApplication, Page} from "@playwright/test";
import {launchApp} from "./launch.ts";

// SQLite fixture can't use better-sqlite3: node_modules was rebuilt for the
// Electron ABI, so it only loads inside the app. bun:sqlite runs under bun.
function createSqliteDatabase(file: string): void {
  // TODO: WAT ZE FAK
  const script = `
import {Database} from "bun:sqlite";
const db = new Database(${JSON.stringify(file)});
db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)");
db.exec("INSERT INTO users (name) VALUES ('alice'), ('bob')");
db.close();
`;
  execFileSync("bun", ["-e", script], {stdio: "pipe"});
}

// SQL source created before app launch: db.json is seeded before the app
// starts, so the request was never opened in this session.
const sourceID = "e2e-sql-source-1";

const test = base.extend<{app: ElectronApplication, page: Page}>({
  app: async ({}, use) => {
    const {app, dir} = await launchApp(async dir => {
      const sqlitePath = path.join(dir, "source.db");
      createSqliteDatabase(sqlitePath);
      await writeFile(path.join(dir, "db.json"), JSON.stringify({
        $version: 1,
        request: [{id: sourceID, kind: "sql-source", path: "mydb"}],
        "sql-source": {[sourceID]: {database: "sqlite", dsn: sqlitePath, readOnly: false}},
      }));
    });
    await use(app);
    await app.close();
    await rm(dir, {recursive: true, force: true}).catch(() => {});
  },
  page: async ({app}, use) => {
    const page = await app.firstWindow();
    await use(page);
  },
});

test("SQL source created before launch: expand and open table viewer", async ({page}) => {
  // localStorage persists in the Electron profile between runs (expanded-keys, layout tabs).
  // Reset it and reload so the app starts in a pristine state.
  await page.waitForSelector("body");
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // 1. The source exists in the sidebar (created before app launch, not yet opened).
  const sourceLabel = page.getByText("mydb", {exact: true});
  await expect(sourceLabel).toBeVisible();
  const sourceBadge = page.getByText("SQL*", {exact: true});
  await expect(sourceBadge).toBeVisible();

  // 2. Expand it and see all tables in it. (Clicking the label opens the
  // request panel instead — it stops propagation; the badge bubbles up to the
  // tree node and toggles expansion.)
  await sourceBadge.click();
  const tableRow = page.getByText(/^users \(\d+ rows?,/); // "users (2 rows, ...)"
  await expect(tableRow).toBeVisible();

  // 3. Click the table: the table viewer must open.
  await tableRow.click();
  const tab = page.locator(".lm_tab").filter({hasText: "mydb/users"});
  await expect(tab).toBeVisible();
  await expect(page.getByText("alice")).toBeVisible(); // table data loaded
  await expect(page.getByText("Could not open table viewer")).toHaveCount(0);
});
