import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:3000', viewport: { width: 1280, height: 720 }, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], browserName: 'chromium' } }],
  webServer: { command: 'npm run dev', url: 'http://127.0.0.1:3000', reuseExistingServer: true, timeout: 120_000, cwd: 'apps/web' },
});
