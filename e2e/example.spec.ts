import { test, expect } from '@playwright/test';

test.describe('SIGAP E2E Smoke Test', () => {
  test('home page loads and displays content', async ({ page }) => {
    // The Expo web build serves the native app at the root URL.
    // We navigate to /home because the Expo Router app uses /home
    // as the initial screen (home.tsx under apps/native/app/).
    await page.goto('/home');

    // Assert the page title contains the app name or a heading exists.
    // The app title is set in apps/native/app.json (name: "SIGAP").
    await expect(page).toHaveTitle(/SIGAP/);

    // Additional assertion: at least one heading / text is visible.
    await expect(page.locator('text=SIGAP').first()).toBeVisible();
  });
});
