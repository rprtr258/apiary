import {defineConfig} from "@playwright/test";

const isCI = process.env.CI !== undefined;

export default defineConfig({
  testDir: "./renderer/e2e",
  fullyParallel: false,
  forbidOnly: !isCI,
  retries: 0,
  workers: 1,
  reporter: "html",
  timeout: 30*1000,
  globalTimeout: 5*60*1000,
  quiet: false,
  use: {
    trace: "on",
  },
  projects: [
    {
      name: "electron",
    },
  ],
});
