import {expect} from "@playwright/test";
import type {Page} from "@playwright/test";
import http from "node:http";
import type {AddressInfo} from "node:net";
import {pressWith, test as base} from "./launch.ts";

type Fixtures = {
  // Local target for the requests under test: the HTTP request is performed by
  // the main process, so Playwright routing cannot intercept it, and an
  // external host would make these tests flaky.
  url: string,
};

const test = base.extend<Fixtures>({
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

// Create an HTTP request, open it in the workspace and point it at the local
// server, leaving focus on the tab header so global shortcuts reach App.ts
// (they are ignored when targeted at an input).
async function openRequestReadyToRun(page: Page, url: string, name: string): Promise<void> {
  const kindSelect = page.locator("select").first();
  await kindSelect.selectOption({label: "HTTP"});
  await page.waitForSelector("input");
  const nameInput = page.locator("input").first();
  await nameInput.fill(name);
  await page.getByRole("button", {name: "Create", exact: true}).click();
  await page.waitForSelector(`text=${name}`);
  await page.click(`text=${name}`);
  await page.waitForSelector(".lm_header .lm_tab");
  await page.locator("input[placeholder='URL']").fill(url);
  await page.locator(".lm_header .lm_tab", {hasText: name}).click();
}

function useErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", msg => {
    if (["error", "warning", "info"].includes(msg.type())) {
      errors.push(msg.text());
    }
  });
  return errors;
}

test("ctrl+enter performs the current request", async ({page, url}) => {
  const errors = useErrors(page);

  await openRequestReadyToRun(page, url, "ctrl-enter-request");

  await pressWith(page, ["Control"], "Enter");

  await page.waitForSelector("text=200", {timeout: 10*1000});
  expect(errors).toEqual([]);
});

test("command palette Run performs the current request", async ({page, url}) => {
  const errors = useErrors(page);

  await openRequestReadyToRun(page, url, "palette-run-request");

  await pressWith(page, ["Control", "Shift"], "KeyP");

  const paletteInput = page.locator("input[placeholder='Type a command or search...']");
  await expect(paletteInput).toBeVisible();
  await paletteInput.click();
  // Filter to the "Run" item; it is the first match, Enter selects it.
  await page.keyboard.type("run");
  await page.keyboard.press("Enter");

  await page.waitForSelector("text=200", {timeout: 10*1000});
  expect(errors).toEqual([]);
});
