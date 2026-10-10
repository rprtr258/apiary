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
  await pressWith(page, ["Control"], "KeyN");

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

test("handles invalid URL error", async ({page, createRequest}) => {
  const errors = useErrors(page);

  // Create and open a request
  await createRequest("HTTP", "error-request");

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

test("tab closes when request is deleted via sidebar menu", async ({page, createRequest, deleteRequest}) => {
  const errors = useErrors(page);

  await createRequest("HTTP", "test-delete-request");

  // Delete via the sidebar context menu; this test asserts the visible
  // effect: the GoldenLayout tab detaches.
  await deleteRequest("HTTP", "test-delete-request");
  await page.locator(".lm_tab").filter({hasText: "test-delete-request"}).waitFor({state: "detached"});

  expect(errors).toEqual([]); // fails if any console.error occurred
});
