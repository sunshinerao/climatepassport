import { defineConfig, devices } from "@playwright/test";

/**
 * Climate Passport 混合流程测试 - Playwright 配置
 *
 * The npm script loads an isolated test environment before this file is read.
 * This config never falls back to the development .env file.
 */
const baseURL = process.env.CP_TEST_BASE_URL;
if (!baseURL) throw new Error("CP_TEST_BASE_URL is required. Run Playwright through npm run test:e2e.");
const serverUrl = new URL(baseURL);

export default defineConfig({
  testDir: "./tests/e2e",
  // The suite shares one isolated database and a Next dev compiler. Serial execution
  // prevents cross-test state races and partial manifest reads during route compilation.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["json", { outputFile: "playwright-report/results.json" }],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `node scripts/run-with-test-env.mjs node node_modules/next/dist/bin/next dev apps/passport-web --hostname ${serverUrl.hostname} --port ${serverUrl.port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180 * 1000,
  },
});
