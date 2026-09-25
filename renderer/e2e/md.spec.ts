import {rm} from "fs/promises";
import type {ElectronApplication} from "playwright";
import {test as base, expect} from "@playwright/test";
import type {Page} from "@playwright/test";
import {launchApp} from "./launch.ts";

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

test.beforeEach(async ({page}) => {
  await page.waitForSelector("body");
});

// Regression test: creating a new MD request must seed raw markdown.
test("new MD request is seeded with raw markdown content", async ({page}) => {
  const kindSelect = page.locator("select").first();
  await kindSelect.selectOption({label: "MD"});

  // Create modal
  await page.waitForSelector("input");
  const input = page.locator("input").first();
  await input.fill("test-md-request");
  await page.getByRole("button", {name: "Create", exact: true}).click();

  // Open the request from the sidebar
  await page.waitForSelector("text=test-md-request");
  await page.click("text=test-md-request");

  // The MD editor shows what api.Create() seeded. CodeMirror virtualizes the
  // DOM below the fold, so assert the distinctive start of default.md rather
  // than the whole file — a seeded data URI would fail the first assertion, and
  // the second guards the old base64-inlining bug directly.
  await expect(page.locator(".cm-content")).toContainText("# Welcome to apiary!");
  await expect(page.locator(".cm-content")).not.toContainText("data:text/markdown;base64");
});
