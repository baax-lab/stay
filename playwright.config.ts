import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    locale: "de-DE",
    // Lokal/CI mit anderem Browserpfad: PW_CHROMIUM_PATH=/pfad/zu/chromium
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    // Dev-Server, damit der Entwickler-Login (nur außerhalb von Produktion) verfügbar ist
    command: `pnpm dev -p ${PORT}`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    env: { ...process.env, APP_URL: `http://localhost:${PORT}`, AUTH_DEV_LOGIN: "true", NODE_ENV: "development" } as Record<string, string>,
    timeout: 120_000,
  },
});
