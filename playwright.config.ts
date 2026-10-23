import { defineConfig, devices } from "@playwright/test";
import { createServer } from "node:net";

async function availablePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not allocate a browser test port.");
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return String(address.port);
}

process.env.FIGURE_E2E_APP_PORT ||= await availablePort();
process.env.FIGURE_E2E_PROVIDER_PORT ||= await availablePort();
const origin = `http://127.0.0.1:${process.env.FIGURE_E2E_APP_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  timeout: 60_000,
  use: {
    baseURL: origin,
    actionTimeout: 10_000,
    trace: "retain-on-failure",
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
  webServer: {
    command: "node --import tsx e2e/server.ts",
    url: `${origin}/api/status`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_TELEMETRY_DISABLED: "1",
      FIGURE_E2E_APP_PORT: process.env.FIGURE_E2E_APP_PORT,
      FIGURE_E2E_PROVIDER_PORT: process.env.FIGURE_E2E_PROVIDER_PORT,
    },
  },
});
