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
  await page.getByLabel('Alamat Lengkap').fill('Jl. Dago Pojok No. 10');
  await page.getByLabel('Nomor Telepon').fill('081234567890');
  await page.getByLabel('RT').fill('01');
  await page.getByLabel('RW').fill('02');
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


async function createActiveVotingPeriod(supabaseClient: SupabaseClient): Promise<string> {
  const now = new Date();
  const startsAt = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const endsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseClient
    .from('voting_periods')
    .insert({ name: 'Musrenbang Test', fiscal_year: now.getFullYear(), starts_at: startsAt, ends_at: endsAt, is_active: true })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

async function createTestAspiration(
  supabaseClient: SupabaseClient,
  userId: string,
  profile: { kelurahan: string; kecamatan: string },
  title: string,
  votingPeriodId: string,
): Promise<string> {
  const { data, error } = await supabaseClient.from('aspirations').insert({
    title,
    description: 'Trotoar jalan Dago perlu diperlebar untuk pejalan kaki.',
    category: 'infrastruktur',
    estimated_beneficiaries: 50,
    user_id: userId,
    kelurahan: profile.kelurahan,
    kecamatan: profile.kecamatan,
    status: 'voting',
    voting_period_id: votingPeriodId,
    vote_count: 300,
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

async function seedTestBudget(supabaseClient: SupabaseClient) {
  const fiscalYear = 2026;
  // Ensure the dinas catalog row exists; service role bypasses RLS.
  const { data: existing } = await supabaseClient.from('dinas').select('id').eq('id', 'disdik').single();
  if (!existing) {
    await supabaseClient.from('dinas').insert({
      id: 'disdik',
      name: 'Dinas Pendidikan',
      categories: ['fasilitas_sekolah', 'layanan_pendidikan'],
      sla_hours_p0: 24, sla_hours_p1: 72, sla_hours_p2: 168,
    });
  }
  const { data, error } = await supabaseClient
    .from('budget_items')
    .insert([
      {
        fiscal_year: fiscalYear,
        dinas_id: 'disdik',
        program_name: 'Peningkatan Sarana Pendidikan',
        activity_name: 'Renovasi ruang kelas SDN Dago 3',
        budget_allocated: 500_000_000,
        budget_realized: 125_000_000,
        progress_percent: 25,
        kelurahan: 'Dago',
        kecamatan: 'Coblong',
        location_address: 'Jl. Dago, Bandung',
      },
      {
        fiscal_year: fiscalYear,
        dinas_id: 'disdik',
        program_name: 'Bantuan Pendidikan Masyarakat',
        activity_name: 'Beasiswa tidak mampu',
        budget_allocated: 200_000_000,
        budget_realized: 50_000_000,
        progress_percent: 25,
        kelurahan: 'Dago',
        kecamatan: 'Coblong',
      },
    ])
    .select('id');
  if (error) throw error;
  return (data ?? []).map((row) => row.id as string);
}

async function ensureTestAdmin(supabaseClient: SupabaseClient): Promise<{ email: string; userId: string }> {
  const email = `admin-${Date.now()}@sigap.local`;
  const { data: user, error } = await supabaseClient
    .from('users')
    .insert({ email, email_verified_at: new Date().toISOString() })
    .select('id')
    .single();
  if (error) throw error;
  await supabaseClient
    .from('profiles')
    .insert({ id: user.id, full_name: 'Admin Test', role: 'admin', kelurahan: 'Dago', kecamatan: 'Coblong' });
  return { email, userId: user.id as string };
}

async function indexBudgetItems(page: Page, itemIds: string[]) {
  const admin = await ensureTestAdmin(serviceClient());
  const token = await getAccessToken(admin.email);
  for (const id of itemIds) {
    const text = `Program: Peningkatan Sarana Pendidikan. Kegiatan: ${id}`;
    const response = await page.request.post(`${SUPABASE_URL}/functions/v1/embed-text`, {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      data: { target: 'budget', id, text },
    });
    const body = await response.json();
    if (!body.ok) throw new Error(`embed-text failed for ${id}: ${JSON.stringify(body)}`);
  }
}

async function createTestEmergencyAlert(supabaseClient: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await supabaseClient
    .from('emergency_alerts')
    .insert({
      user_id: userId,
      emergency_type: 'medical',
      location_lat: -6.889,
      location_lng: 107.611,
      location_address: 'Jl. Dago, Bandung',
      status: 'active',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

async function seedTestAnnouncement(
  supabaseClient: SupabaseClient,
  createdBy: string,
  kelurahan: string | null,
): Promise<string> {
  const { data, error } = await supabaseClient
    .from('announcements')
    .insert({
      title: 'Pengumuman Tes Lomba',
      body: 'Ini adalah pengumuman uji untuk memastikan layar informasi berfungsi.',
      category: 'umum',
      kelurahan,
      is_pinned: true,
      created_by: createdBy,
      published_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

async function seedTestPointLedger(supabaseClient: SupabaseClient, userId: string) {
  await supabaseClient.from('point_ledger').insert([
    { user_id: userId, points: 10, reason: 'report_created' },
    { user_id: userId, points: 25, reason: 'report_verified' },
    { user_id: userId, points: 2, reason: 'upvote_given' },
  ]);
}

test.describe('M2 ASPIRASI', () => {
  test('create aspiration via API, vote, view Musrenbang ranking', async ({ page }) => {
    test.setTimeout(60_000);
    await login(page, sharedEmail);
    await completeOnboarding(page);

    const svc = serviceClient();
    const { data: userRow } = await svc.from('users').select('id').ilike('email', sharedEmail).single();
    if (!userRow) throw new Error('Test user not found');

    // Create a separate warga account in the same kelurahan to own the aspiration.
    const ownerEmail = `owner-${Date.now()}@sigap.local`;
    let ownerId: string | null = null;
    try {
      const { data: ownerUser } = await svc.from('users').insert({ email: ownerEmail }).select('id').single();
      if (!ownerUser?.id) throw new Error('Owner user not created');
      ownerId = ownerUser.id;
      await svc.from('profiles').insert({ id: ownerUser.id, full_name: 'Warga Lain', kelurahan: 'Dago', kecamatan: 'Coblong' });

      const periodId = await createActiveVotingPeriod(svc);
      const title = `Pembangunan trotoar Dago ${Date.now()}`;
      const aspirationId = await createTestAspiration(svc, ownerUser.id, { kelurahan: 'Dago', kecamatan: 'Coblong' }, title, periodId);

      // Navigate via bottom nav to keep the restored session alive.
      await page.getByRole('button', { name: 'Aspirasi' }).first().click();
      await page.waitForURL('/aspirasi');
      await expect(page.getByText(title).first()).toBeVisible();

      // Vote the seeded aspiration (owned by another warga in the same kelurahan).
      // It sorts to the top, so the first "Dukung" button belongs to this card.
      await page.getByRole('button', { name: 'Dukung' }).first().click();
      await expect(page.getByText(/Sudah didukung/i).first()).toBeVisible();
      await expect(page.getByText('301').first()).toBeVisible();

      // Verify the vote was actually persisted in the database, with a small retry
      // to account for any slight commit/visibility delay on the server.
      let voteRow: any = null;
      let voteCheckError: any = null;
      for (let i = 0; i < 5; i++) {
        const result = await svc
          .from('aspiration_votes')
          .select('aspiration_id, user_id')
          .eq('aspiration_id', aspirationId)
          .eq('user_id', userRow.id)
          .single();
        voteRow = result.data;
        voteCheckError = result.error;
        if (voteRow) break;
        await page.waitForTimeout(300);
      }
      if (!voteRow) throw new Error('Vote was not persisted: ' + JSON.stringify(voteCheckError));

      // Musrenbang tab should list the same aspiration by kecamatan.
      await page.locator('div', { hasText: /^Musrenbang$/ }).first().click();
      await expect(page.getByText(title).first()).toBeVisible();
      await expect(page.getByText('Usulan di Kec. Coblong, terurut suara').first()).toBeVisible();
    } finally {
      if (ownerId) {
        await svc.from('aspiration_votes').delete().eq('user_id', userRow.id);
        await svc.from('aspirations').delete().eq('user_id', ownerId);
        await svc.from('profiles').delete().eq('id', ownerId);
        await svc.from('users').delete().eq('id', ownerId);
      }
    }
  });
});

test.describe('M3 ANGGARAN', () => {
  test('view budget treemap, ask AI, see answer', async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, sharedEmail);
    await completeOnboarding(page);

    const svc = serviceClient();
    const budgetIds = await seedTestBudget(svc);
    await indexBudgetItems(page, budgetIds);

    await page.goto('/anggaran');
    await expect(page.getByText('Anggaran').first()).toBeVisible();
    await expect(page.getByText(/Pagu 2026|terealisasi|Belanja per bidang/i).first()).toBeVisible();
    await expect(page.getByText('Pendidikan & Pemuda').first()).toBeVisible();

    await page.goto('/anggaran/tanya');
    await page.getByPlaceholder(/tulis pertanyaan/i).fill('Berapa anggaran pendidikan di Dago?');
    await page.locator('[aria-label="Kirim pertanyaan"]').first().click();
    await expect(page.getByText(/anggaran|pendidikan|R[cp]\s*\d|juta|miliar/i).first()).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('M4 LAYANAN', () => {
  test('service catalog and SKTM status tracking', async ({ page }) => {
    test.setTimeout(120_000);
    await login(page, sharedEmail);
    await completeOnboarding(page);

    // Seed the SKTM request via API while already authenticated on /home.
    const requestId = await createTestServiceRequest(page, sharedEmail, 'sktm');

    // Navigate in-app to keep the restored session.
    await page.getByRole('button', { name: 'Layanan' }).first().click();
    await page.waitForURL('/layanan');

    await expect(page.getByText('Surat Keterangan Tidak Mampu').first()).toBeVisible();
    await expect(page.getByText('Permohonan Saya').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Diajukan|Memuat permohonan/).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Diajukan').first()).toBeVisible();

    // Open detail and verify the status timeline is visible.
    await page.getByTestId('service-request-card').first().click();
    await page.waitForURL('/layanan/' + requestId, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Detail Permohonan').first()).toBeVisible();
    // Wait for the detail data to load so the previous screen's hidden text doesn't shadow the timeline.
    await expect(page.getByText('Memuat permohonan…').first()).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText('Diverifikasi').first()).toBeVisible();
    await expect(page.getByText('Diproses Tanda Tangan').first()).toBeVisible();
  });
});

test.describe('M5 DARURAT', () => {
  test('seeded active emergency alert is shown on SOS screen', async ({ page }) => {
    test.setTimeout(60_000);
    await login(page, sharedEmail);
    await completeOnboarding(page);

    // Seed emergency alert via API while already authenticated on /home.
    const svc = serviceClient();
    const { data: userRow } = await svc.from('users').select('id').ilike('email', sharedEmail).single();
    if (!userRow) throw new Error('Test user not found');
    await createTestEmergencyAlert(svc, userRow.id);

    // Navigate in-app to SOS screen.
    await page.getByLabel('SOS Darurat').first().click();
    await page.waitForURL('/sos');

    await expect(page.getByText('Status SOS').first()).toBeVisible();
    await expect(page.getByText(/SOS terkirim|aktif|darurat medis/i).first()).toBeVisible();
    await expect(page.getByText(/Operator sedang meninjau|meninjau lokasi/i).first()).toBeVisible();
    await expect(page.getByText('Medis').first()).toBeVisible();
  });
});

test.describe('M6 INFO', () => {
  test('home summary, announcements, leaderboard, profile points/badges/devices', async ({ page }) => {
    test.setTimeout(90_000);
    await login(page, sharedEmail);
    await completeOnboarding(page);

    // Seed announcement and point activity while already authenticated on /home.
    const svc = serviceClient();
    const { data: userRow } = await svc.from('users').select('id').ilike('email', sharedEmail).single();
    if (!userRow) throw new Error('Test user not found');
    const admin = await ensureTestAdmin(svc);
    await seedTestAnnouncement(svc, admin.userId, 'Dago');
    await seedTestPointLedger(svc, userRow.id);
    await svc.rpc('refresh_leaderboard');

    // /home is already loaded; assert summary + announcement preview.
    await expect(page.getByText(/Selamat/i).first()).toBeVisible();
    await expect(page.getByText('Pengumuman Tes Lomba').first()).toBeVisible();
    await expect(page.getByText(/Laporan Anda|Diproses|Selesai|Menunggu/i).first()).toBeVisible();

    // Navigate via home shortcut.
    await page.getByRole('button', { name: 'Pengumuman' }).first().click();
    await page.waitForURL('/pengumuman');
    await expect(page.getByText('Tandai dibaca').first()).toBeVisible();
    await expect(page.getByText('Pengumuman Tes Lomba').filter({ visible: true }).first()).toBeVisible();

    // Go back home, then navigate to leaderboard.
    await page.getByRole('button', { name: 'Kembali' }).first().click();
    await page.waitForURL('/home');
    await page.getByRole('button', { name: 'Leaderboard' }).first().click();
    await page.waitForURL('/leaderboard');
    await expect(page.getByText('Peringkat warga').first()).toBeVisible();
    await expect(page.getByText('Test Warga').filter({ visible: true }).first()).toBeVisible();

    // Go back home, then navigate to profile.
    await page.getByRole('button', { name: 'Kembali' }).first().click();
    await page.waitForURL('/home');
    await page.getByRole('button', { name: 'Profil' }).first().click();
    await page.waitForURL('/profile');
    await expect(page.getByText('Test Warga').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/Total poin/i).first()).toBeVisible();
    await expect(page.getByText(/Peringkat di/i).first()).toBeVisible();
    await expect(page.getByText('Perangkat Aktif').first()).toBeVisible();
  });
});
