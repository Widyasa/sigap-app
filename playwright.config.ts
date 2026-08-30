import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 180_000,
  expect: { timeout: 15000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8081',
    trace: 'on-first-retry',
    headless: true,
    viewport: { width: 390, height: 844 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['iPhone 14'], browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npx expo start --web --port 8081',
    url: 'http://127.0.0.1:8081',
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
    cwd: 'apps/native',
  },
});
