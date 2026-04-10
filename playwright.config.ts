import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 1,
  // Sweep any events tagged "e2e-test" that survived the per-test
  // afterEach cleanup (typically because a test crashed mid-run).
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost",
    headless: true,
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
