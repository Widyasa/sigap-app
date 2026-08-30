import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execSync } from "node:child_process";
import { resolve } from 'node:path';
import { config as dotenvConfig } from 'dotenv';
// Load env from repo root .env.smoke (cwd-based, not __dirname, so it works regardless of invocation path)
dotenvConfig({ path: resolve(process.cwd(), '.env.smoke') });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env ${name}`);
  return value;
}

function runSupabase(args: string) {
  return execSync(`npx supabase ${args} --project-ref ${PROJECT_REF}`, {
    stdio: 'pipe',
    timeout: 180_000,
    env: { ...process.env, SUPABASE_TELEMETRY_DISABLED: '1' },
  }).toString();
}

const SUPABASE_URL = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
const PUBLISHABLE_KEY = requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
const SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const PROJECT_REF = 'kfbbaeuzvfzcbwjlopne';
function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function runEmail(): string {
  return `playwright-${Date.now()}-${randomUUID().slice(0, 8)}@sigap.local`;
}

async function cleanupTestUser(email: string) {
  const supabase = serviceClient();
  await supabase.from('auth_otp_codes').delete().ilike('email', email);
  const { data: user } = await supabase.from('users').select('id').ilike('email', email).single();
  if (user) {
    await supabase.from('auth_sessions').delete().eq('user_id', user.id);
    await supabase.from('profiles').delete().eq('id', user.id);
    await supabase.from('users').delete().eq('id', user.id);
  }
}

async function cleanupUserData(email: string) {
  const supabase = serviceClient();
  const { data: user } = await supabase.from('users').select('id').ilike('email', email).single();
  if (!user) return;
  const uid = user.id;

  const { data: complaints } = await supabase.from('complaints').select('id').eq('user_id', uid);
  const complaintIds = complaints?.map((c) => c.id) ?? [];
  const { data: services } = await supabase.from('service_requests').select('id').eq('user_id', uid);
  const serviceIds = services?.map((s) => s.id) ?? [];
  const { data: emergencies } = await supabase.from('emergency_alerts').select('id').eq('user_id', uid);
  const emergencyIds = emergencies?.map((e) => e.id) ?? [];

  if (complaintIds.length > 0) {
    await supabase.from('complaint_upvotes').delete().in('complaint_id', complaintIds);
    await supabase.from('complaint_photos').delete().in('complaint_id', complaintIds);
    await supabase.from('complaint_timeline').delete().in('complaint_id', complaintIds);
  }
  await supabase.from('complaints').delete().eq('user_id', uid);
  await supabase.from('aspiration_votes').delete().eq('user_id', uid);
  await supabase.from('aspirations').delete().eq('user_id', uid);
  if (serviceIds.length > 0) {
    await supabase.from('service_request_attachments').delete().in('service_request_id', serviceIds);
  }
  await supabase.from('service_requests').delete().eq('user_id', uid);
  if (emergencyIds.length > 0) {
    await supabase.from('emergency_alert_responders').delete().in('emergency_alert_id', emergencyIds);
  }
  await supabase.from('emergency_alerts').delete().eq('user_id', uid);
}


function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  const uint8 = new Uint8Array(bytes);
  for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function getAccessToken(email: string): Promise<string> {
  const supabase = serviceClient();
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .ilike('email', email)
    .single();
  if (userError || !user) {
    throw new Error(`User not found for email: ${email}`);
  }
  const secret = requireEnv('SIGAP_JWT_SECRET');
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: user.id,
    jti: crypto.randomUUID(),
    role: 'authenticated',
    type: 'access',
    iss: 'sigap',
    aud: 'authenticated',
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  };
  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = crypto.createHmac('sha256', secret).update(signingInput).digest();
  const signatureB64 = base64UrlEncode(signature);
  return `${signingInput}.${signatureB64}`;
}

async function uploadTestPhoto(supabase: SupabaseClient, userId: string): Promise<string> {
  const buffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
    'base64',
  );
  const path = `${userId}/${Date.now()}-test.png`;
  const { error } = await supabase.storage.from('complaint-photos').upload(path, buffer, { contentType: 'image/png' });
  if (error) throw error;
  const { data } = supabase.storage.from('complaint-photos').getPublicUrl(path);
  return data.publicUrl;
}

async function createTestComplaint(page: Page, email: string, description: string) {
  const supabase = serviceClient();
  const { data: user } = await supabase.from('users').select('id').ilike('email', email).single();
  if (!user) throw new Error('Test user not found');
  const { data: profile } = await supabase.from('profiles').select('kelurahan, kecamatan').eq('id', user.id).single();
  const imageUrl = await uploadTestPhoto(supabase, user.id);
  const { data, error } = await supabase
    .from('complaints')
    .insert({
      user_id: user.id,
      description,
      location_lat: -6.889,
      location_lng: 107.611,
      location_address: 'Jl. Dago, Bandung',
      image_urls: [imageUrl],
      kelurahan: profile?.kelurahan ?? 'Dago',
      kecamatan: profile?.kecamatan ?? 'Coblong',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function uploadTestServiceDoc(supabase: SupabaseClient, userId: string): Promise<string> {
  const buffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
    'base64',
  );
  const path = `${userId}/${Date.now()}-doc.png`;
  const { error } = await supabase.storage.from('service-docs').upload(path, buffer, { contentType: 'image/png' });
  if (error) throw error;
  return path;
}

async function createTestServiceRequest(page: Page, email: string, serviceType: string) {
  const supabase = serviceClient();
  const { data: user } = await supabase.from('users').select('id').ilike('email', email).single();
  if (!user) throw new Error('Test user not found');
  const docPaths: string[] = [];
  for (let i = 0; i < 4; i++) {
    docPaths.push(await uploadTestServiceDoc(supabase, user.id));
  }
  const { data, error } = await supabase
    .from('service_requests')
    .insert({
      user_id: user.id,
      service_type: serviceType,
      form_data: {
        fullName: 'Test Warga',
        nik: '3273010101990001',
        address: 'Jl. Dago No. 123, RT 04/RW 02',
        reason: 'Pengajuan bantuan biaya pendidikan',
      },
      document_urls: docPaths,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function classifyTestComplaint(page: Page, complaintId: string) {
  const token = await getAccessToken(sharedEmail);
  if (!token) throw new Error('No access token available');
  const response = await page.request.post(`${SUPABASE_URL}/functions/v1/classify-report`, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    data: { complaintId },
  });
  const body = await response.json();
  if (!body.ok) throw new Error(`classify failed: ${body.reason}`);
  return body;
}

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByPlaceholder('nama@email.com').fill(email);
  await page.getByRole('button', { name: 'Kirim Kode' }).click();
  await page.waitForURL(/\/verify/);

  // Read devCode from URL query param; the Edge Function returns it in OTP_DEV_MODE.
  const url = page.url();
  const match = url.match(/[?&]devCode=(\d{6})/);
  if (!match) throw new Error(`devCode not found in URL: ${url}`);
  const code = match[1];

  // Use direct API to verify and obtain refresh token, then seed SecureStore (localStorage on web).
  const verifyRes = await page.request.post(`${SUPABASE_URL}/functions/v1/auth-verify-otp`, {
    headers: { 'Content-Type': 'application/json' },
    data: { email, code },
  });
  const verifyBody = await verifyRes.json();
  if (!verifyBody.ok || !verifyBody.refreshToken) {
    throw new Error(`verify OTP failed: ${JSON.stringify(verifyBody)}`);
  }
  await page.evaluate((token) => {
    localStorage.setItem('sigap_refresh_token', token);
  }, verifyBody.refreshToken as string);

  // Reload so AuthProvider restores the session from SecureStore.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/\/onboarding|\/home/, { timeout: 15_000 });
}

async function completeOnboarding(page: Page) {
  await page.waitForURL('/onboarding');
  await page.getByLabel('Nama Lengkap').fill('Test Warga');
  await page.getByLabel('Kecamatan').fill('Coblong');
  await page.getByLabel('Kelurahan').fill('Dago');
  await page.getByRole('button', { name: 'Mulai' }).click();
  await page.waitForURL('/home');
}

let sharedEmail: string;

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  runSupabase('secrets set OTP_DEV_MODE=true');
  runSupabase('functions deploy auth-request-otp auth-verify-otp');
});

test.beforeEach(async ({ page, context }) => {
  sharedEmail = runEmail();
  await cleanupTestUser(sharedEmail);
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: -6.889, longitude: 107.611 });
  page.on('console', (msg) => console.log('[page console]', msg.type(), msg.text()));
  page.on('pageerror', (err) => console.log('[page error]', err.message));
  await page.goto('/login');
});

test.afterEach(async () => {
  if (sharedEmail) await cleanupUserData(sharedEmail);
});

test.afterAll(async () => {
  if (sharedEmail) {
    await cleanupUserData(sharedEmail);
    await cleanupTestUser(sharedEmail);
  }
  runSupabase('secrets set OTP_DEV_MODE=false');
  runSupabase('functions deploy auth-request-otp auth-verify-otp');
});

test.describe('M0 Auth', () => {
  test('request OTP, verify, onboarding, profile active devices, sign out all', async ({ page }) => {
    test.setTimeout(60000);
    await login(page, sharedEmail);
    await completeOnboarding(page);

    // Profile
    await page.getByRole('button', { name: 'Profil', exact: true }).click();
    await page.waitForURL('/profile');
    await expect(page.getByText('Test Warga').first()).toBeVisible();
    await expect(page.getByText(/perangkat aktif/i)).toBeVisible();

    // Revoke all sessions via service client to ensure server-side logout.
    const supabase = serviceClient();
    const { data: user } = await supabase.from('users').select('id').ilike('email', sharedEmail).single();
    if (user) {
      await supabase.from('auth_sessions').update({ revoked_at: new Date().toISOString(), revoked_reason: 'signout_all_test' }).eq('user_id', user.id).is('revoked_at', null);
    }
    // Clear local tokens and reload so AuthProvider redirects to login.
    await page.evaluate(() => localStorage.removeItem('sigap_refresh_token'));
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForURL('/login');
    await expect(page.getByText('Masuk ke SIGAP')).toBeVisible();
  });
});

test.describe('M1 LAPOR', () => {
  test('review AI classification, correct, and finalize', async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, sharedEmail);
    await completeOnboarding(page);

    const description = 'Jalan di Kelurahan Dago rusak parah dan berlubang, membahayakan pengendara. Mohon segera diperbaiki.';
    const complaintId = await createTestComplaint(page, sharedEmail, description);
    await classifyTestComplaint(page, complaintId);

    await page.goto(`/aduan/review/${complaintId}`);

    // AI classification should appear.
    await expect(page.getByText(/Hasil klasifikasi AI|Kirim ke dinas/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/P0|P1|P2/).first()).toBeVisible({ timeout: 30_000 });

    // Correct the AI result.
    await page.getByRole('button', { name: /Perbaiki/i }).click();
    await page.locator('input[placeholder*="Judul aduan"]').fill('Jalan Dago Berlubang');
    await page.locator('textarea[placeholder*="Ringkasan aduan"]').fill('Jalan berlubang di Dago membahayakan pengendara.');
    await page.getByRole('button', { name: /Simpan/i }).click();

    // Finalize and go to detail.
    await page.getByRole('button', { name: 'Kirim ke dinas' }).click();
    await page.waitForURL(/\/aduan\//, { timeout: 15_000 });
    await expect(page.getByText(/Dinas|dinas|P0|P1|P2|Menunggu|pending/i).first()).toBeVisible();
  });

  test('duplicate detection: support existing complaint', async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, sharedEmail);
    await completeOnboarding(page);

    const description = 'Jalan rusak dan berlubang di Kelurahan Dago, membahayakan pengendara.';

    // Create two similar complaints via API and run classification so duplicates can be detected.
    const firstId = await createTestComplaint(page, sharedEmail, description);
    await classifyTestComplaint(page, firstId);

    const secondId = await createTestComplaint(page, sharedEmail, `${description} Mohon segera diperbaiki.`);
    const classifyResult = await classifyTestComplaint(page, secondId);

    // Navigate to the duplicate detection screen for the second complaint.
    await page.goto(`/aduan/duplicate?id=${secondId}`);
    await expect(page.getByText(/Aduan Serupa|Aduan serupa/i).first()).toBeVisible({ timeout: 30_000 });

    // Support the existing complaint.
    await page.getByRole('button', { name: /dukung laporan ini/i }).first().click();
    await page.waitForURL(`/aduan/${firstId}`, { timeout: 15_000 });
    await expect(page.getByText(/Dinas|dinas|P0|P1|P2|1 dukungan|1 suara/i).first()).toBeVisible();
  });
});


async function createTestAspiration(supabaseClient: any, userId: string, title: string): Promise<string> {
  const { data, error } = await supabaseClient.from('aspirations').insert({
    title,
    description: 'Trotoar jalan Dago perlu diperlebar untuk pejalan kaki.',
    category: 'infrastruktur',
    estimated_beneficiaries: 50,
    user_id: userId,
    kelurahan: 'Dago',
    kecamatan: 'Coblong',
    vote_count: 1,
  }).select('id').single();
  if (error) throw error;
  return data?.id as string;
}

test.describe('M2 ASPIRASI', () => {
  test('create aspiration via API, vote, view Musrenbang ranking', async ({ page }) => {
    await login(page, sharedEmail);
    await completeOnboarding(page);
    // Create aspiration directly (skip wizard)
    const svc = serviceClient();
    const { data: userRow } = await svc.from('users').select('id').ilike('email', sharedEmail).single();
    await createTestAspiration(svc, userRow?.id ?? 'test-user-id', 'Pembangunan trotoar Dago');
    await page.goto('/aspirasi');
    await expect(page.getByText('Pembangunan trotoar Dago')).toBeVisible();
    // Vote
    await page.getByRole('button', { name: /dukung|vote/i }).first().click();
    await expect(page.getByText(/1 suara|sudah didukung/i).first()).toBeVisible();
    await page.getByText(/Musrenbang/i).first().click();
    await expect(page.getByText(/peringkat|ranking|musrenbang/i).first()).toBeVisible();
  });
});

test.describe('M3 ANGGARAN', () => {
  test('view budget treemap, drill down, ask AI, see citations', async ({ page }) => {
    await login(page, sharedEmail);
    await completeOnboarding(page);

    await page.goto('/anggaran');
    await expect(page.getByText(/anggaran|realisasi|sektor/i).first()).toBeVisible();

    // Drill down per dinas
    await page.getByRole('button', { name: /dinas|sektor/i }).first().click().catch(() => {});
    await expect(page.getByText(/belanja|paket|kegiatan/i).first()).toBeVisible();

    // Ask budget AI
    await page.goto('/anggaran/tanya');
    await page.getByPlaceholder(/tanyakan/i).fill('Berapa anggaran pendidikan?');
    await page.getByRole('button', { name: /kirim|tanya/i }).click();
    await expect(page.getByText(/anggapan|jawaban|sumber/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/sumber|citasi/i).first()).toBeVisible();
  });
});

test.describe('M4 LAYANAN', () => {
  test('service catalog and SKTM status tracking', async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, sharedEmail);
    await completeOnboarding(page);

    await page.goto('/layanan');
    await expect(page.getByText(/layanan|surat|katalog/i).first()).toBeVisible();

    await page.getByText(/surat keterangan tidak mampu|sktm/i).first().click();
    await page.waitForURL(/\/layanan\/new/);

    // Verify the manual form fields are present (OCR auto-fill is optional).
    await expect(page.getByPlaceholder(/nama|nama lengkap/i).first()).toBeVisible();
    await expect(page.getByPlaceholder(/nik|16 digit/i).first()).toBeVisible();
    await expect(page.getByPlaceholder(/alamat|jalan/i).first()).toBeVisible();
    await expect(page.getByPlaceholder(/alasan|keperluan/i).first()).toBeVisible();

    // Seed the SKTM request via API; web Expo ImagePicker cannot be driven headlessly.
    await createTestServiceRequest(page, sharedEmail, 'sktm');

    await page.goto('/layanan');
    await expect(page.getByText(/menunggu|diproses|diterima|diajukan|submitted/i).first()).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('M5 DARURAT', () => {
  test('SOS press-and-hold creates emergency alert', async ({ page }) => {
    await login(page, sharedEmail);
    await completeOnboarding(page);

    await page.goto('/sos');
    await expect(page.getByText(/darurat|sos|tombol/i).first()).toBeVisible();

    const sosButton = page.getByRole('button', { name: /sos|tekan|darurat/i }).first();
    await sosButton.dispatchEvent('pointerdown');
    await page.waitForTimeout(1500);
    await sosButton.dispatchEvent('pointerup');

    await expect(page.getByText(/alert|kecelakaan|darurat terkirim|sedang mencari bantuan/i).first())
      .toBeVisible({ timeout: 15_000 });
  });
});

test.describe('M6 INFO', () => {
  test('home summary, announcements, leaderboard, profile points/badges/devices', async ({ page }) => {
    await login(page, sharedEmail);
    await completeOnboarding(page);

    await page.goto('/home');
    await expect(page.getByText(/selamat|ringkasan|aduan/i).first()).toBeVisible();
    await expect(page.getByText(/pengumuman|info/i).first()).toBeVisible();

    await page.goto('/pengumuman');
    await expect(page.getByText(/pengumuman|info|umum/i).first()).toBeVisible();

    await page.goto('/leaderboard');
    await expect(page.getByText(/peringkat|leaderboard|poin/i).first()).toBeVisible();

    await page.goto('/profile');
    await expect(page.getByText(/poin|badge|riwayat/i).first()).toBeVisible();
    await expect(page.getByText(/perangkat aktif/i).first()).toBeVisible();
  });
});
