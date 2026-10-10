import {defineConfig} from "@playwright/test";
import os from "os";

const isCI = process.env.CI !== undefined;

export default defineConfig({
  testDir: "./renderer/e2e",
  fullyParallel: true,
  forbidOnly: !isCI,
  retries: 0,
  workers: Math.max(1, Math.floor(os.cpus().length / 2)),
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
