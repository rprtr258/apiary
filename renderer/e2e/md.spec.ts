import {expect} from "@playwright/test";
import {test} from "./launch.ts";

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
