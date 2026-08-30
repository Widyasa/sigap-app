import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';
import { config as dotenvConfig } from 'dotenv';
import { randomUUID } from 'node:crypto';
import type { Page } from '@playwright/test';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  serviceClient,
  runEmail,
  cleanupTestUser,
  cleanupUserData,
  seededLogin,
} from './web-helpers';

dotenvConfig({ path: resolve(process.cwd(), '.env.smoke') });

const TEST_KELURAHAN = 'Sukamaju';
const TEST_KECAMATAN = 'Cibeunying';

const createdCitizenEmails: string[] = [];
const createdVotingPeriodIds: string[] = [];
const createdBudgetItemIds: string[] = [];

async function createCitizenUser(supabase: SupabaseClient, email: string): Promise<string> {
  const userId = randomUUID();
  const { error: uErr } = await supabase.from('users').insert({
    id: userId,
    email,
    email_verified_at: new Date().toISOString(),
  });
  if (uErr) throw uErr;
  const { error: pErr } = await supabase.from('profiles').insert({
    id: userId,
    full_name: 'Warga Uji Aspirasi',
    role: 'citizen',
    kelurahan: TEST_KELURAHAN,
    kecamatan: TEST_KECAMATAN,
  });
  if (pErr) throw pErr;
  createdCitizenEmails.push(email);
  return userId;
}

async function createActiveVotingPeriod(
  supabase: SupabaseClient,
  overrides: { name?: string; fiscalYear?: number } = {},
): Promise<string> {
  const now = new Date();
  const startsAt = new Date(now.getTime() + 60_000).toISOString();
  const endsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('voting_periods')
    .insert({
      name: overrides.name ?? `Periode Uji ${Date.now()}`,
      fiscal_year: overrides.fiscalYear ?? now.getFullYear(),
      starts_at: startsAt,
      ends_at: endsAt,
    })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('Failed to create voting period');
  createdVotingPeriodIds.push(data.id);
  return data.id;
}

async function createTestAspiration(
  supabase: SupabaseClient,
  userId: string,
  periodId: string,
  title: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('aspirations')
    .insert({
      user_id: userId,
      title,
      description: 'Aspirasi uji Playwright dengan deskripsi yang cukup panjang.',
      kelurahan: TEST_KELURAHAN,
      kecamatan: TEST_KECAMATAN,
      voting_period_id: periodId,
      status: 'voting',
    })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('Failed to create aspiration');
  return data.id;
}

async function cleanupCreatedData() {
  const supabase = serviceClient();

  for (const id of createdBudgetItemIds) {
    await supabase.from('budget_items').delete().eq('id', id);
  }
  createdBudgetItemIds.length = 0;

  for (const id of createdVotingPeriodIds) {
    await supabase.from('voting_periods').delete().eq('id', id);
  }
  createdVotingPeriodIds.length = 0;

  for (const email of createdCitizenEmails) {
    await cleanupUserData(email).catch(() => {});
    await cleanupTestUser(email).catch(() => {});
  }
  createdCitizenEmails.length = 0;
}


test.describe.serial('Web Aspirasi Admin', () => {
  test.afterEach(async () => {
    await cleanupCreatedData();
  });

  test('admin creates a voting period and sees it in the list', async ({ page }) => {
    const periodName = `Periode Playwright ${Date.now()}`;
    const fiscalYear = new Date().getFullYear();
    const startsAt = new Date(Date.now() + 60_000);
    const endsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await seededLogin(page, 'admin@sigap.test');
    await page.goto('/aspirasi');
    await expect(page.getByRole('heading', { name: 'Aspirasi', level: 1 })).toBeVisible();

    await page.getByLabel('Nama').fill(periodName);
    await page.getByLabel('Tahun Anggaran').fill(String(fiscalYear));
    await page.locator('#periode-mulai').fill(startsAt.toISOString().slice(0, 16));
    await page.locator('#periode-selesai').fill(endsAt.toISOString().slice(0, 16));
    await page.getByRole('button', { name: 'Buka Periode' }).click();

    await expect(page.getByText(periodName)).toBeVisible();
    await expect(page.locator('table').locator('tr', { hasText: periodName })).toContainText('Aktif');
  });

  test('admin advances aspiration from voting to musrenbang and persists in DB', async ({ page }) => {
    const supabase = serviceClient();
    const citizenEmail = runEmail();
    const citizenId = await createCitizenUser(supabase, citizenEmail);
    const periodId = await createActiveVotingPeriod(supabase, { name: `Periode Aspirasi ${Date.now()}` });
    const title = `Aspirasi Uji Playwright ${Date.now()}`;
    const aspirationId = await createTestAspiration(supabase, citizenId, periodId, title);

    await seededLogin(page, 'admin@sigap.test');
    await page.goto('/aspirasi');
    await expect(page.getByRole('heading', { name: 'Aspirasi', level: 1 })).toBeVisible();

    await expect(page.getByText(title, { exact: true })).toBeVisible();
    const statusSelect = page.getByLabel(`Status aspirasi ${title}`);
    await statusSelect.selectOption({ label: 'Dibahas Musrenbang' });

    await page.locator('tr', { hasText: title }).getByRole('button', { name: 'Simpan' }).click();
    await expect(page.getByText('Perubahan aspirasi tersimpan.')).toBeVisible();

    const { data } = await supabase.from('aspirations').select('status').eq('id', aspirationId).single();
    expect(data?.status).toBe('musrenbang');
  });

  test('non-admin is blocked from /aspirasi', async ({ page }) => {
    const profile = await seededLogin(page, 'pupr@sigap.test');
    expect(profile.role).not.toBe('admin');
    expect(profile.role).not.toBe('dinas_head');

    await page.goto('/aspirasi');
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });
});

test.describe.serial('Web Anggaran Admin', () => {
  test.afterEach(async () => {
    await cleanupCreatedData();
  });

  async function importCsv(page: Page, programName: string, row: string) {
    const header =
      'fiscal_year,dinas_id,program_name,activity_name,budget_allocated,budget_realized,location_address,kelurahan,kecamatan,progress_percent,contractor';
    const csv = `${header}\n${row}`;
    await page.goto('/anggaran');
    await expect(page.getByRole('heading', { name: 'Anggaran', level: 1 })).toBeVisible();
    await page.locator('#csv-anggaran').fill(csv);
    await page.getByRole('button', { name: 'Impor CSV' }).click();
    await expect(page.locator('table').locator('tr', { hasText: programName })).toBeVisible({ timeout: 15000 });
  }

  test('admin imports budget CSV and sees new item in status table', async ({ page }) => {
    const programName = `Program Playwright ${Date.now()}`;
    const fiscalYear = new Date().getFullYear();

    await seededLogin(page, 'admin@sigap.test');
    await importCsv(
      page,
      programName,
      `${fiscalYear},pupr,${programName},Kegiatan Uji,100000000,0,Jl. Test No. 1,Sukamaju,Cibeunying,0,CV Test`,
    );

    await expect(page.locator('table').locator('tr', { hasText: programName })).toContainText('Belum Terindeks');

    const supabase = serviceClient();
    const { data } = await supabase.from('budget_items').select('id').eq('program_name', programName).single();
    if (data?.id) createdBudgetItemIds.push(data.id);
  });

  test('import does not reject budget_realized greater than budget_allocated', async ({ page }) => {
    test.info().annotations.push({
      type: 'gap',
      description:
        'UI parser and DB CHECK do not enforce budget_realized <= budget_allocated; row is accepted instead of rejected.',
    });

    const programName = `Program Over Budget ${Date.now()}`;
    const fiscalYear = new Date().getFullYear();

    await seededLogin(page, 'admin@sigap.test');
    await importCsv(
      page,
      programName,
      `${fiscalYear},pupr,${programName},Kegiatan Over Budget,100000000,200000000,Jl. Test No. 2,Sukamaju,Cibeunying,0,CV Over`,
    );

    const supabase = serviceClient();
    const { data } = await supabase.from('budget_items').select('id').eq('program_name', programName).single();
    expect(data).toBeTruthy();
    if (data?.id) createdBudgetItemIds.push(data.id);
  });

  test('non-admin is blocked from /anggaran', async ({ page }) => {
    const profile = await seededLogin(page, 'pupr@sigap.test');
    expect(profile.role).not.toBe('admin');

    await page.goto('/anggaran');
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });
});
