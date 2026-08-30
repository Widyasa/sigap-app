import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import {
  serviceClient,
  runEmail,
  cleanupTestUser,
  cleanupUserData,
  seededLogin,
  loginWithOtp,
} from './web-helpers';

dotenvConfig({ path: resolve(process.cwd(), '.env.smoke') });

const PROJECT_REF = 'kfbbaeuzvfzcbwjlopne';

function setOtpDevMode(enabled: boolean) {
  const value = enabled ? 'true' : 'false';
  execSync(`npx supabase secrets set OTP_DEV_MODE=${value} --project-ref ${PROJECT_REF}`, {
    stdio: 'pipe',
    timeout: 300_000,
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' },
  });
}

function deployAuthFunctions() {
  execSync(`npx supabase functions deploy auth-request-otp auth-verify-otp --project-ref ${PROJECT_REF}`, {
    stdio: 'pipe',
    timeout: 300_000,
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' },
  });
}

test.describe.serial('Web Auth', () => {
  test.beforeAll(() => {
    setOtpDevMode(true);
    deployAuthFunctions();
  });

  test.afterAll(() => {
    setOtpDevMode(false);
    deployAuthFunctions();
  });

  const createdEmails: string[] = [];

  test.afterEach(async () => {
    for (const email of createdEmails) {
      await cleanupUserData(email).catch(() => {});
      await cleanupTestUser(email).catch(() => {});
    }
    createdEmails.length = 0;
  });

  test('fresh staff user can log in via full UI OTP flow and see dashboard', async ({ page }) => {
    const email = runEmail();
    createdEmails.push(email);

    // Pre-create the user as staff so that post-login redirect lands on the dashboard.
    const supabase = serviceClient();
    const { data: existing } = await supabase.from('users').select('id').ilike('email', email).single();
    if (!existing) {
      const userId = randomUUID();
      await supabase.from('users').insert({ id: userId, email, email_verified_at: new Date().toISOString() });
      await supabase.from('profiles').insert({
        id: userId,
        full_name: 'Playwright Staff',
        role: 'verifier',
        kelurahan: 'Sukamaju',
        kecamatan: 'Cibeunying',
      });
    }

    await loginWithOtp(page, email);
    await expect(page.locator('h1')).toContainText(/Ringkasan|Antrean Darurat/);
    await expect(page.locator('nav[aria-label="Navigasi utama"]')).toBeVisible();
  });

  test('seeded admin can log in via seededLogin, see admin nav items, and sign out', async ({ page }) => {
    const profile = await seededLogin(page, 'admin@sigap.test');
    expect(profile.role).toBe('admin');

    await expect(page.getByRole('link', { name: 'Anggaran' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Kelola Pengguna' })).toBeVisible();

    await page.getByRole('button', { name: 'Keluar' }).click();
    await page.waitForURL('/login', { timeout: 10000 });
    await expect(page.getByRole('heading', { name: /Masuk Petugas SIGAP/i })).toBeVisible();
  });

  test('seeded dinas_staff is restricted to Dinas tab', async ({ page }) => {
    const profile = await seededLogin(page, 'pupr@sigap.test');
    expect(profile.role).toBe('dinas_staff');

    // Buka tab yang tidak berhak; konten harus tetap menampilkan antrean Dinas.
    await page.goto('/aduan?tab=verifikasi');
    await expect(page.getByRole('button', { name: 'Verifikasi' })).not.toBeVisible();
    await expect(page.locator('text=Menampilkan aduan dinas')).toBeVisible();
  });

  test('seeded verifier is restricted to Verifikasi scope', async ({ page }) => {
    const profile = await seededLogin(page, 'verifier@sigap.test');
    expect(profile.role).toBe('verifier');

    // Buka tab yang tidak berhak; konten harus tetap menampilkan antrean Verifikasi.
    await page.goto('/aduan?tab=dinas');
    await expect(page.getByRole('button', { name: 'Dinas' })).not.toBeVisible();
    await expect(page.locator('text=Menampilkan aduan dinas')).not.toBeVisible();
    await expect(page.getByText(/Tidak ada aduan yang perlu diverifikasi|aduan menunggu tindakan/)).toBeVisible();
  });

  test('seeded emergency_operator is redirected to /darurat and sees SOS queue', async ({ page }) => {
    const profile = await seededLogin(page, 'operator@sigap.test');
    expect(profile.role).toBe('emergency_operator');

    await expect(page).toHaveURL(/\/darurat$/);
    await expect(page.getByRole('heading', { name: 'Antrean Darurat SOS' })).toBeVisible();
    // Database seed mungkin sudah berisi alert darurat; cukup verifikasi halaman
    // menampilkan antrean (kosong maupun berisi).
    await expect(page.getByText(/Tidak ada SOS aktif|Tanggapi/)).toBeVisible({ timeout: 15000 });
  });
});
