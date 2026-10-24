import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30000,
  reporter: [
    ["list"],
    ["junit", { outputFile: "../evidence/tduck-vue3/e2e-results.xml" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:5180",
    channel: "msedge",
    headless: true,
    viewport: { width: 1440, height: 1000 },
    trace: "off",
    screenshot: "off",
  },
});
