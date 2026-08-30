import { test, expect, type Page } from '@playwright/test';
import { serviceClient, seededLogin, runEmail, cleanupTestUser, cleanupUserData } from './web-helpers';
import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

// Module-level serial describe to avoid concurrent mutations to shared DB state.
const createdCitizenEmails: string[] = [];
const createdStaffEmails: string[] = [];
const createdAnnouncementIds: string[] = [];

async function createCitizenUser(supabase: SupabaseClient, email: string, overrides: { fullName?: string } = {}) {
  const userId = randomUUID();
  const { error: uErr } = await supabase.from('users').insert({
    id: userId,
    email,
    email_verified_at: new Date().toISOString(),
  });
  if (uErr) throw uErr;
  const { error: pErr } = await supabase.from('profiles').insert({
    id: userId,
    full_name: overrides.fullName ?? 'Warga Uji',
    role: 'citizen',
    kelurahan: 'Sukamaju',
    kecamatan: 'Cibeunying',
  });
  if (pErr) throw pErr;
  createdCitizenEmails.push(email);
  return userId;
}

async function createStaffUser(
  supabase: SupabaseClient,
  email: string,
  role: 'verifier' | 'dinas_staff' | 'dinas_head' | 'emergency_operator' | 'admin' = 'verifier',
  dinasId?: string,
) {
  const userId = randomUUID();
  const { error: uErr } = await supabase.from('users').insert({
    id: userId,
    email,
    email_verified_at: new Date().toISOString(),
  });
  if (uErr) throw uErr;
  const { error: pErr } = await supabase.from('profiles').insert({
    id: userId,
    full_name: `Petugas Uji ${role}`,
    role,
    dinas_id: dinasId ?? null,
    kelurahan: 'Sukamaju',
    kecamatan: 'Cibeunying',
  });
  if (pErr) throw pErr;
  createdStaffEmails.push(email);
  return userId;
}

async function createServiceRequest(supabase: SupabaseClient, userId: string, serviceType: string) {
  const { data, error } = await supabase
    .from('service_requests')
    .insert({
      user_id: userId,
      service_type: serviceType,
      form_data: { reason: 'uji e2e' },
      status: 'submitted',
    })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('Failed to create service request');
  return data.id;
}

async function createEmergencyAlert(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from('emergency_alerts')
    .insert({
      user_id: userId,
      emergency_type: 'other',
      status: 'active',
      location_lat: -6.889,
      location_lng: 107.611,
      location_address: 'Jl. Uji E2E',
      description: 'Uji E2E darurat',
    })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('Failed to create emergency alert');
  return data.id;
}

async function cleanupAll() {
  const supabase = serviceClient();

  for (const id of createdAnnouncementIds) {
    await supabase.from('announcements').delete().eq('id', id);
  }
  createdAnnouncementIds.length = 0;

  for (const email of createdStaffEmails) {
    await cleanupUserData(email).catch(() => {});
    await cleanupTestUser(email).catch(() => {});
  }
  createdStaffEmails.length = 0;

  for (const email of createdCitizenEmails) {
    await cleanupUserData(email).catch(() => {});
    await cleanupTestUser(email).catch(() => {});
  }
  createdCitizenEmails.length = 0;
}

test.describe.serial('Web Ops — Layanan', () => {
  test.afterEach(async () => {
    await cleanupAll();
  });

  test('Admin updates service request status from submitted to verifying', async ({ page }) => {
    const supabase = serviceClient();
    const email = runEmail();
    const userId = await createCitizenUser(supabase, email);
    await createServiceRequest(supabase, userId, 'domisili');

    await seededLogin(page, 'admin@sigap.test');
    await page.goto('/layanan');
    await expect(page.getByRole('heading', { name: 'Layanan', level: 1 })).toBeVisible();

    const row = page.locator('table tbody tr', { hasText: email });
    await expect(row).toBeVisible();
    const select = row.locator('select').first();
    await select.selectOption({ label: 'Diverifikasi' });
    await row.getByRole('button', { name: 'Simpan' }).click();

    await expect(page.getByText(/Status permohonan diubah menjadi "Diverifikasi"/)).toBeVisible();
    await expect(row).toContainText('Diverifikasi');
  });

  test('Rejection requires reason', async ({ page }) => {
    const supabase = serviceClient();
    const email = runEmail();
    const userId = await createCitizenUser(supabase, email);
    await createServiceRequest(supabase, userId, 'sktm');

    await seededLogin(page, 'verifier@sigap.test');
    await page.goto('/layanan');
    await expect(page.getByRole('heading', { name: 'Layanan', level: 1 })).toBeVisible();

    const row = page.locator('table tbody tr', { hasText: email });
    await expect(row).toBeVisible();
    const select = row.locator('select').first();
    await select.selectOption({ label: 'Ditolak' });
    await row.getByRole('button', { name: 'Simpan' }).click();

    await expect(page.getByRole('dialog', { name: 'Alasan Penolakan' })).toBeVisible();
    await page.getByLabel('Alasan penolakan').fill('Alasan uji');
    await page.getByRole('button', { name: 'Konfirmasi' }).click();

    await expect(page.getByText(/Status permohonan diubah menjadi "Ditolak"/)).toBeVisible();
    await expect(row).toContainText('Ditolak');
  });
});

test.describe.serial('Web Ops — Darurat', () => {
  test.afterEach(async () => {
    await cleanupAll();
  });

  test('Operator responds and resolves SOS', async ({ page }) => {
    const supabase = serviceClient();
    const email = runEmail();
    const userId = await createCitizenUser(supabase, email);
    const alertId = await createEmergencyAlert(supabase, userId);

    await seededLogin(page, 'operator@sigap.test');
    await page.goto('/darurat');
    await expect(page.getByRole('heading', { name: 'Antrean Darurat SOS', level: 1 })).toBeVisible();

    const card = page.locator('div', { hasText: 'Uji E2E darurat' });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Menunggu Operator');

    await card.getByRole('button', { name: 'Tanggapi' }).click();
    await expect(card).toContainText('Ditanggapi');

    await card.getByRole('button', { name: 'Selesai' }).click();
    await page.getByRole('button', { name: 'Konfirmasi' }).click();
    await expect(card).toContainText('Selesai');

    const { data } = await supabase.from('emergency_alerts').select('status').eq('id', alertId).single();
    expect(data?.status).toBe('resolved');
  });
});

test.describe.serial('Web Ops — Pengumuman', () => {
  test.afterEach(async () => {
    await cleanupAll();
  });

  test('Admin creates, pins, edits, deletes announcement', async ({ page }) => {
    await seededLogin(page, 'admin@sigap.test');
    await page.goto('/pengumuman');
    await expect(page.getByRole('heading', { name: 'Pengumuman', level: 1 })).toBeVisible();

    const originalTitle = `Pengumuman Uji E2E ${Date.now()}`;
    await page.getByLabel('Judul').fill(originalTitle);
    await page.getByLabel('Isi').fill('Isi pengumuman uji');
    await page.getByRole('button', { name: 'Buat Pengumuman' }).click();
    await expect(page.getByText(originalTitle)).toBeVisible();

    const row = page.locator('table tbody tr', { hasText: originalTitle });
    await row.getByRole('button', { name: 'Ubah' }).click();
    await page.getByLabel('Judul pengumuman').fill(`${originalTitle} Diedit`);
    await page.getByLabel('Sematkan di atas').check();
    await page.getByRole('button', { name: 'Simpan' }).click();

    const editedTitle = `${originalTitle} Diedit`;
    await expect(page.getByText(editedTitle)).toBeVisible();
    const editedRow = page.locator('table tbody tr', { hasText: editedTitle });
    await expect(editedRow).toContainText('Ya');

    await editedRow.getByRole('button', { name: 'Hapus' }).click();
    await page.getByRole('button', { name: 'Konfirmasi' }).click();
    await expect(page.getByText(editedTitle)).not.toBeVisible();
  });
});

test.describe.serial('Web Ops — Pengguna', () => {
  test.afterEach(async () => {
    await cleanupAll();
  });

  test('Admin changes role, assigns dinas, disables/enables', async ({ page }) => {
    const supabase = serviceClient();
    const email = runEmail();
    await createStaffUser(supabase, email, 'verifier');

    await seededLogin(page, 'admin@sigap.test');
    await page.goto('/pengguna');
    await expect(page.getByRole('heading', { name: 'Pengguna', level: 1 })).toBeVisible();

    const row = page.locator('table tbody tr', { hasText: email });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Verifikator');

    const roleSelect = row.locator('select').first();
    await roleSelect.selectOption({ label: 'Staf Dinas' });

    const dialog = page.getByRole('dialog', { name: 'Ubah peran pengguna' });
    await expect(dialog).toBeVisible();
    await dialog.locator('select', { hasText: 'Dinas Pekerjaan Umum & Penataan Ruang' }).selectOption('pupr');
    await dialog.getByRole('button', { name: 'Ubah Peran' }).click();

    await expect(row).toContainText('Staf Dinas');
    await expect(row).toContainText('Dinas Pekerjaan Umum & Penataan Ruang');

    await row.getByRole('button', { name: 'Nonaktifkan' }).click();
    const disableDialog = page.getByRole('dialog', { name: 'Nonaktifkan akun' });
    await expect(disableDialog).toBeVisible();
    await disableDialog.getByRole('button', { name: 'Nonaktifkan' }).click();
    await expect(row).toContainText('Nonaktif');

    await row.getByRole('button', { name: 'Aktifkan' }).click();
    const enableDialog = page.getByRole('dialog', { name: 'Aktifkan akun' });
    await expect(enableDialog).toBeVisible();
    await enableDialog.getByRole('button', { name: 'Aktifkan' }).click();
    await expect(row).toContainText('Aktif');
  });
});

test.describe.serial('Web Ops — Warga', () => {
  test.afterEach(async () => {
    await cleanupAll();
  });

  test('Verifier sees directory and stats', async ({ page }) => {
    const supabase = serviceClient();
    const email = runEmail();
    await createCitizenUser(supabase, email, { fullName: 'Warga Uji Direktori' });

    await seededLogin(page, 'verifier@sigap.test');
    await page.goto('/warga');
    await expect(page.getByRole('heading', { name: 'Direktori Warga', level: 1 })).toBeVisible();

    await expect(page.getByText('Total warga')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Total Poin' })).toBeVisible();
    await expect(page.getByText('Warga Uji Direktori')).toBeVisible();
  });
});

test.describe.serial('Web Ops — Role Gates', () => {
  test('Verifier blocked from /pengguna', async ({ page }) => {
    await seededLogin(page, 'verifier@sigap.test');
    await page.goto('/pengguna');
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('Admin can access /pengguna', async ({ page }) => {
    await seededLogin(page, 'admin@sigap.test');
    await page.goto('/pengguna');
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('Dinas_staff blocked from /darurat', async ({ page }) => {
    await seededLogin(page, 'pupr@sigap.test');
    await page.goto('/darurat');
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });
});
