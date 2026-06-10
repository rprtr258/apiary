import {defineConfig} from "@playwright/test";

const isCI = process.env.CI !== undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !isCI,
  retries: 0,
  workers: isCI ? undefined : 1,
  reporter: "html",
  timeout: 6*1000,
  globalTimeout: 5*60*1000,
  quiet: false,
  use: {
    baseURL: "http://localhost:34116",
    trace: "on",
    browserName: "chromium",
    headless: true,
  },
  projects: [
    {
      name: "chromium",
    },
  ],
  webServer: {
    command: "vite --port 34116",
    url: "http://localhost:34116",
    reuseExistingServer: !isCI,
    timeout: isCI ? 5*60*1000 : 60*1000,
    gracefulShutdown: {
      timeout: 10000,
      signal: "SIGTERM",
    },
  },
});