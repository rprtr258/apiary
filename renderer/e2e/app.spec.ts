import {expect} from "@playwright/test";
import type {Page} from "@playwright/test";
import {pressWith, test} from "./launch.ts";

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

test("creates HTTP request via sidebar dropdown", async ({page}) => {
  const errors = useErrors(page);

  const kindSelect = page.locator("select").first();

  await kindSelect.selectOption({label: "HTTP"});

  await page.waitForSelector("input");

  const input = page.locator("input").first();
  await input.fill("test-request-dropdown");

  const createButton = page.getByRole("button", {name: "Create", exact: true});
  await createButton.click();

  await page.waitForSelector("text=test-request-dropdown");

  await page.click("text=test-request-dropdown");

  const urlInput = page.locator("input[placeholder='URL']");
  await urlInput.fill("https://httpbin.org/get");

  const sendButton = page.getByRole("button", {name: "Send", disabled: false});
  await sendButton.click();

  await page.waitForSelector("text=200", {timeout: 10000});

  const responseText = await page.textContent("body");
  expect(responseText).toContain("200");

  expect(errors).toEqual([]);
});

test("creates HTTP request via command palette", async ({page}) => {
  const errors = useErrors(page);

  await pressWith(page, ["Control"], "KeyN");

  expect(errors).toEqual([]);

  await page.waitForSelector("text=HTTP");

  await page.click("text=HTTP");

  await page.waitForSelector("input");

  const input = page.locator("input").first();
  await input.fill("test-request");
  await page.keyboard.press("Enter");

  await page.waitForSelector("text=test-request");

  await page.click("text=test-request");

  const urlInput = page.locator("input[placeholder='URL']");
  await urlInput.fill("https://httpbin.org/get");

  const sendButton = page.getByRole("button", {name: "Send", disabled: false});
  await sendButton.click();

  await page.waitForSelector("text=200", {timeout: 10000});

  const responseText = await page.textContent("body");
  expect(responseText).toContain("200");
});

test("handles invalid URL error", async ({page, createRequest}) => {
  const errors = useErrors(page);

  await createRequest("HTTP", "error-request");

  const urlInput = page.locator("input[placeholder='URL']");
  await urlInput.fill("://invalid-url");

  const sendButton = page.getByRole("button", {name: "Send"});
  await sendButton.click();

  await page.waitForSelector("text=Could not perform request");

  expect(errors).toEqual([]);
});

test("tab closes when request is deleted via sidebar menu", async ({page, createRequest, deleteRequest}) => {
  const errors = useErrors(page);

  await createRequest("HTTP", "test-delete-request");

  await deleteRequest("HTTP", "test-delete-request");
  await page.locator(".lm_tab").filter({hasText: "test-delete-request"}).waitFor({state: "detached"});

  expect(errors).toEqual([]);
});
