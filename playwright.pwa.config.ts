import { defineConfig, devices } from "@playwright/test";

// Service workers and cache revisions must be tested against the production
// bundle. Keep this separate from Vite's development-server gameplay tests.
const externalBaseURL = process.env.PWA_BASE_URL;
const baseURL = externalBaseURL || "http://127.0.0.1:4173/CuocDuaKyThu/";

export default defineConfig({
  testDir: "./tests",
  testMatch: "pwa.spec.ts",
  timeout: 60_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "test-results/pwa",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/pwa" }],
  ],
  use: {
    baseURL,
    serviceWorkers: "allow",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "pwa-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        launchOptions: {
          args: [
            "--disable-background-timer-throttling",
            "--disable-renderer-backgrounding",
          ],
        },
      },
    },
  ],
  webServer: externalBaseURL
    ? undefined
    : {
        command: "npm run preview -- --host 127.0.0.1 --port 4173 --strictPort",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
