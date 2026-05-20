import { defineConfig } from "@playwright/test";
import * as path from "node:path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, ".env.local") });

export default defineConfig({
  testDir: "./tests",
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "escrow-e2e"
      // Do NOT use devices["Desktop Chrome"] — it sets channel: "chrome",
      // which makes Playwright launch installed Google Chrome and prevents
      // Synpress from sideloading the MetaMask extension. Synpress requires
      // bundled Chromium with --load-extension (the default browserType).
    }
  ]
});
