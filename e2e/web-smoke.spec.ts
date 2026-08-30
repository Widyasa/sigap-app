// Smoke test for the Next.js web dashboard.
// Verifies that the web app serves a recognizable page and the /login route
// renders the "Masuk Petugas SIGAP" heading used by petugas sign-in.
//
// If this test fails because the dev server didn't start, check that
// `apps/web/.env.local` exists and that `npm run dev` inside `apps/web` boots
// a Next.js server on http://127.0.0.1:3000.
import { test, expect } from '@playwright/test';

test.describe('web smoke', () => {
  test('login page renders SIGAP heading', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Masuk Petugas SIGAP/i })).toBeVisible();
  });

  test('root responds with HTML', async ({ page }) => {
    const response = await page.goto('/');
    expect(response, 'root should respond').not.toBeNull();
    expect(response!.status()).toBeLessThan(500);
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
